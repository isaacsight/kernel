(async function () {
    const canvas = document.getElementById("graphCanvas");
    const hint = document.getElementById("graphHint");
    const filterInput = document.getElementById("graphFilter");
    const canonOnly = document.getElementById("graphCanonOnly");
    const resetBtn = document.getElementById("graphReset");
    const directionSel = document.getElementById("graphDirection");
    const pinBar = document.getElementById("pinBar");
    const pinTitle = document.getElementById("pinTitle");
    const copyPinLinkBtn = document.getElementById("copyPinLink");
    const clearPinBtn = document.getElementById("clearPin");

    let directionMode = "all";
    if (directionSel) {
        directionMode = directionSel.value || "all";
        directionSel.addEventListener("change", () => {
            directionMode = directionSel.value || "all";
            if (!running) { tick(); draw(); }
        });
    }

    if (!canvas) return;

    // Hint initial state
    if (hint) hint.innerHTML = `<span class="muted">Hover a node to see connections.</span>`;

    // Pin Logic Helpers
    let pinnedNode = null;

    function setPinUI(node) {
        if (!pinBar || !pinTitle) return;
        if (!node) {
            pinBar.style.display = "none";
            pinTitle.textContent = "";
            pinTitle.href = "#";
            return;
        }
        pinBar.style.display = "";
        pinTitle.textContent = node.title || node.id;
        const url = node.url || ("../posts/" + node.id + ".html");
        pinTitle.href = url;
    }

    if (clearPinBtn) {
        clearPinBtn.addEventListener("click", () => {
            pinnedNode = null;
            setPinUI(null);
            if (hint) hint.innerHTML = `<span class="muted">Hover a node to see connections.</span>`;
            // redraw to clear highlight
            if (!running) { tick(); draw(); }
        });
    }

    if (copyPinLinkBtn) {
        copyPinLinkBtn.addEventListener("click", async () => {
            if (!pinnedNode) return;
            const url = pinnedNode.url || ("../posts/" + pinnedNode.id + ".html");
            const fullUrl = new URL(url, window.location.href).href;
            // Fix: window.location.href might be /map/graph.html, so relative path needs resolution. 
            // Actually, if we use new URL(rel, base), base is current page.
            // If url is "../posts/foo", and we are at "/map/graph.html", result is "/posts/foo". Correct.
            try {
                await navigator.clipboard.writeText(fullUrl);
                copyPinLinkBtn.textContent = "Copied";
                setTimeout(() => (copyPinLinkBtn.textContent = "Copy link"), 900);
            } catch (e) {
                window.prompt("Copy link:", fullUrl);
            }
        });
    }

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            pinnedNode = null;
            setPinUI(null);
            if (hint) hint.innerHTML = `<span class="muted">Hover a node to see connections.</span>`;
            // redraw
            if (!running) { tick(); draw(); }
        }
    });

    const ctx = canvas.getContext("2d");
    const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    function resize() {
        const parent = canvas.parentElement;
        const w = Math.min(1200, parent.clientWidth);
        const h = Math.min(780, Math.max(520, Math.floor(window.innerHeight * 0.62)));
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        canvas.width = w * DPR;
        canvas.height = h * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener("resize", () => {
        resize();
        resetLayout(true);
    });

    let graph;
    try {
        const res = await fetch("graph.json", { cache: "no-store" });
        graph = await res.json();
    } catch (e) {
        if (hint) hint.textContent = "Failed to load graph.json";
        return;
    }

    // Build node lookup
    const nodesAll = graph.nodes.map((n, i) => ({
        ...n,
        id: n.id || n.slug,
        i,
        x: Math.random(),
        y: Math.random(),
        vx: 0,
        vy: 0,
        r: n.canonical ? 8 : 5,
        visible: true,
    }));
    const byId = new Map(nodesAll.map(n => [n.id, n]));

    const linksAll = graph.edges
        .map(e => ({ source: byId.get(e.source), target: byId.get(e.target) }))
        .filter(l => l.source && l.target);

    // Directed neighbors for hover highlighting
    const outNeighbors = new Map(); // slug -> Set(targetSlug)
    const inNeighbors = new Map(); // slug -> Set(sourceSlug)

    function add(map, a, b) {
        if (!map.has(a)) map.set(a, new Set());
        map.get(a).add(b);
    }

    for (const l of linksAll) {
        add(outNeighbors, l.source.id, l.target.id);
        add(inNeighbors, l.target.id, l.source.id);
    }

    // Helpers for Hint
    function escapeHtml(s) {
        return String(s || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function nodeLinkHTML(slug) {
        const n = byId.get(slug);
        if (!n) return "";
        const title = (n.title || slug);
        // Build URL: graph.json nodes might have 'url' if I added it, otherwise construct it
        // The previous write of graph.json in build.py added 'url' to map_rows but NOT explicitly to graph.json payload
        // Wait, I updated build.py to write graph.json but I did NOT add "url" to the nodes there.
        // I should fix graph.json generation later, but here I can fallback.
        const url = n.url || ("../posts/" + slug + ".html");
        return `<li><a href="${url}">${escapeHtml(title)}</a></li>`;
    }

    // Normalize initial positions on a circle
    function resetLayout(keepVel) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) * 0.32;
        const visibleNodes = nodesAll.filter(n => n.visible);

        visibleNodes.forEach((n, k) => {
            const a = (k / Math.max(1, visibleNodes.length)) * Math.PI * 2;
            n.x = cx + Math.cos(a) * radius;
            n.y = cy + Math.sin(a) * radius;
            if (!keepVel) { n.vx = 0; n.vy = 0; }
        });
    }

    // Degree for sizing / centering (Calculate degree based on visible links? 
    // Usually static degree is better for stability, but let's stick to initial degree)
    const degree = new Map();
    linksAll.forEach(l => {
        degree.set(l.source.id, (degree.get(l.source.id) || 0) + 1);
        degree.set(l.target.id, (degree.get(l.target.id) || 0) + 1);
    });
    nodesAll.forEach(n => {
        const d = degree.get(n.id) || 0;
        n.r = n.canonical ? 9 : 5 + Math.min(5, Math.floor(d / 2));
    });

    // Physics params
    let running = true;
    const params = {
        linkDistance: 64,
        linkStrength: 0.06,
        charge: 220,
        centerStrength: 0.02,
        damping: 0.86,
        maxSpeed: 8,
    };

    function getVisibleNodes() {
        return nodesAll.filter(n => n.visible);
    }
    function getVisibleLinks() {
        return linksAll.filter(l => l.source.visible && l.target.visible);
    }

    function applyFilter() {
        const q = (filterInput.value || "").trim().toLowerCase();
        const canon = canonOnly.checked;

        nodesAll.forEach(n => {
            const hay = `${n.title} ${n.pillar} ${n.mode}`.toLowerCase();
            const matchQ = !q || hay.includes(q);
            const matchCanon = !canon || n.canonical;
            n.visible = matchQ && matchCanon;
        });

        if (!getVisibleNodes().length) {
            nodesAll.forEach(n => (n.visible = !canon || n.canonical));
        }
        resetLayout(false);
    }

    if (filterInput) filterInput.addEventListener("input", applyFilter);
    if (canonOnly) canonOnly.addEventListener("change", applyFilter);
    if (resetBtn) resetBtn.addEventListener("click", () => resetLayout(false));

    resetLayout(false);

    // Interaction
    let hoverNode = null;
    let dragNode = null;
    let dragOffset = { x: 0, y: 0 };

    function dist2(a, b) {
        const dx = a.x - b.x, dy = a.y - b.y;
        return dx * dx + dy * dy;
    }

    function findNodeAt(x, y) {
        const m = { x, y };
        const visible = getVisibleNodes();
        let best = null;
        let bestD = Infinity;
        for (const n of visible) {
            const d = dist2(n, m);
            const rr = (n.r + 6) * (n.r + 6);
            if (d <= rr && d < bestD) {
                best = n; bestD = d;
            }
        }
        return best;
    }

    function canvasPos(evt) {
        const rect = canvas.getBoundingClientRect();
        return { x: (evt.clientX - rect.left), y: (evt.clientY - rect.top) };
    }

    canvas.addEventListener("mousemove", (evt) => {
        const p = canvasPos(evt);
        if (dragNode) {
            dragNode.x = p.x + dragOffset.x;
            dragNode.y = p.y + dragOffset.y;
            dragNode.vx = 0;
            dragNode.vy = 0;
            return;
        }

        // If pinned, keep focus pinned but allow drag
        if (pinnedNode) {
            canvas.style.cursor = dragNode ? "grabbing" : "default";
            // We still update hoverNode if we want to show non-pinned hover? 
            // Request says: "Pinned node remains the focus while you move around."
            // Meaning highlighting stays on pinned. 
            // But do we update the hover variable? 
            // "hoverNode = findNodeAt..." logic might overwrite highlighting if draw() uses hoverNode fallback.
            // draw() usage: const focus = (pinnedNode && ...) ? pinnedNode : (hoverNode...)
            // So draw() respects pinnedNode.
            // But we shouldn't update sidebar (hint) if pinned.
            return;
        }

        const prevHover = hoverNode;
        hoverNode = findNodeAt(p.x, p.y);
        canvas.style.cursor = hoverNode ? "pointer" : "default";

        // Update Hint if changed
        if (hint && hoverNode !== prevHover) {
            if (!hoverNode) {
                hint.innerHTML = `<span class="muted">Hover a node to see connections.</span>`;
            } else {
                renderHint(hoverNode);
            }
        }
    });

    // Extracted renderHint for reuse
    function renderHint(node) {
        const outSet = outNeighbors.get(node.id) || new Set();
        const inSet = inNeighbors.get(node.id) || new Set();

        const outList = Array.from(outSet).sort((a, b) => {
            const A = (byId.get(a)?.title || a).toLowerCase();
            const B = (byId.get(b)?.title || b).toLowerCase();
            return A.localeCompare(B);
        });
        const inList = Array.from(inSet).sort((a, b) => {
            const A = (byId.get(a)?.title || a).toLowerCase();
            const B = (byId.get(b)?.title || b).toLowerCase();
            return A.localeCompare(B);
        });

        const title = escapeHtml(node.title || node.id);
        const mode = escapeHtml(node.mode || "");
        const pillar = escapeHtml((node.pillar || "").replaceAll("-", " "));
        const url = node.url || ("../posts/" + node.id + ".html");

        hint.innerHTML = `
          <h3>${url ? `<a href="${url}">${title}</a>` : title}</h3>
          <div class="row">
            ${mode ? `<span class="pill">${mode}</span>` : ""}
            ${pillar ? `<span class="pill">${pillar}</span>` : ""}
            ${node.canonical ? `<span class="pill">canon</span>` : ""}
            ${pinnedNode && pinnedNode.id === node.id ? `<span class="pill">pinned</span>` : ""}
            <span class="pill">out: ${outList.length}</span>
            <span class="pill">in: ${inList.length}</span>
          </div>
    
          <div class="cols">
            <div>
              <div class="muted">Outgoing</div>
              ${outList.length ? `<ul>${outList.map(nodeLinkHTML).join("")}</ul>` : `<div class="muted">None</div>`}
            </div>
            <div>
              <div class="muted">Incoming</div>
              ${inList.length ? `<ul>${inList.map(nodeLinkHTML).join("")}</ul>` : `<div class="muted">None</div>`}
            </div>
          </div>
        `;
    }

    canvas.addEventListener("mousedown", (evt) => {
        const p = canvasPos(evt);
        const n = findNodeAt(p.x, p.y);
        if (!n) return;
        dragNode = n;
        dragOffset.x = n.x - p.x;
        dragOffset.y = n.y - p.y;
    });

    window.addEventListener("mouseup", () => {
        dragNode = null;
    });

    canvas.addEventListener("click", (evt) => {
        const p = canvasPos(evt);
        const n = findNodeAt(p.x, p.y);

        // Empty click clears pin
        if (!n) {
            pinnedNode = null;
            setPinUI(null);
            if (hint) hint.innerHTML = `<span class="muted">Hover a node to see connections.</span>`;
            return;
        }

        const url = n.url || ("../posts/" + n.id + ".html");

        // Cmd/Ctrl Click -> Open
        if (evt.metaKey || evt.ctrlKey) {
            window.open(url, "_blank");
            return;
        }

        // Toggle Pin
        if (pinnedNode && pinnedNode.id === n.id) {
            pinnedNode = null;
            setPinUI(null);
            if (hint) hint.innerHTML = `<span class="muted">Hover a node to see connections.</span>`;
        } else {
            pinnedNode = n;
            setPinUI(pinnedNode);
            // Force sidebar render
            hoverNode = n;
            renderHint(n);
        }
    });

    canvas.addEventListener("dblclick", (evt) => {
        const p = canvasPos(evt);
        const n = findNodeAt(p.x, p.y);
        if (n) {
            const url = n.url || ("../posts/" + n.id + ".html");
            window.location.href = url;
        }
    });

    function tick() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const cx = w / 2, cy = h / 2;

        const nodes = getVisibleNodes();
        const links = getVisibleLinks();

        // Forces
        for (const l of links) {
            const a = l.source, b = l.target;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            const diff = dist - params.linkDistance;
            const fx = (dx / dist) * diff * params.linkStrength;
            const fy = (dy / dist) * diff * params.linkStrength;
            a.vx += fx; a.vy += fy;
            b.vx -= fx; b.vy -= fy;
        }

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d2 = dx * dx + dy * dy;
                if (d2 === 0) continue;
                const dist = Math.sqrt(d2);
                const minDist = a.r + b.r + 6;
                const strength = params.charge / d2;
                const overlap = Math.max(0, minDist - dist);
                const push = strength + overlap * 0.02;
                const fx = (dx / dist) * push;
                const fy = (dy / dist) * push;
                a.vx -= fx; a.vy -= fy;
                b.vx += fx; b.vy += fy;
            }
        }

        for (const n of nodes) {
            if (n === dragNode) continue;
            n.vx += (cx - n.x) * params.centerStrength * 0.01;
            n.vy += (cy - n.y) * params.centerStrength * 0.01;
            n.vx *= params.damping;
            n.vy *= params.damping;
            const sp = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
            if (sp > params.maxSpeed) {
                n.vx = (n.vx / sp) * params.maxSpeed;
                n.vy = (n.vy / sp) * params.maxSpeed;
            }
            n.x += n.vx;
            n.y += n.vy;
            const pad = 24;
            n.x = Math.max(pad, Math.min(w - pad, n.x));
            n.y = Math.max(pad, Math.min(h - pad, n.y));
        }
    }

    function draw() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);

        const nodes = getVisibleNodes();
        const links = getVisibleLinks();

        // Priority: Pinned > Hover
        // But if pinned, we might still want to see hover?
        // Request says: "highlighting uses pinned node first."
        const focus = (pinnedNode && pinnedNode.visible)
            ? pinnedNode
            : ((hoverNode && hoverNode.visible) ? hoverNode : null);

        let focusSet = null;
        if (focus) {
            if (directionMode === "out") focusSet = outNeighbors.get(focus.id) || new Set();
            else if (directionMode === "in") focusSet = inNeighbors.get(focus.id) || new Set();
            else {
                // all
                const outS = outNeighbors.get(focus.id) || new Set();
                const inS = inNeighbors.get(focus.id) || new Set();
                focusSet = new Set([...outS, ...inS]);
            }
        }

        function isConnected(n) {
            if (!focus) return true;
            if (n.id === focus.id) return true;
            return focusSet.has(n.id);
        }

        // Links
        ctx.lineWidth = 1;
        ctx.globalAlpha = focus ? 0.10 : 0.35;
        ctx.beginPath();
        for (const l of links) {
            ctx.moveTo(l.source.x, l.source.y);
            ctx.lineTo(l.target.x, l.target.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (focus) {
            ctx.globalAlpha = 0.75;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (const l of links) {
                // Check Directional Hit
                let hit = false;
                if (directionMode === "out") {
                    hit = (l.source.id === focus.id && focusSet.has(l.target.id));
                } else if (directionMode === "in") {
                    hit = (l.target.id === focus.id && focusSet.has(l.source.id));
                } else {
                    hit = (l.source.id === focus.id && focusSet.has(l.target.id)) ||
                        (l.target.id === focus.id && focusSet.has(l.source.id));
                }

                if (!hit) continue;
                ctx.moveTo(l.source.x, l.source.y);
                ctx.lineTo(l.target.x, l.target.y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
        }

        // Nodes
        for (const n of nodes) {
            const connected = isConnected(n);
            ctx.globalAlpha = focus ? (connected ? 1 : 0.18) : 1;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fill();

            if (n.canonical) {
                ctx.globalAlpha = focus ? (connected ? 0.65 : 0.12) : 0.6;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.lineWidth = 1;
            }
        }
        ctx.globalAlpha = 1;

        // No canvas hover label needed anymore; we use the sidebar hint
    }

    function frame() {
        if (!running) return;
        tick();
        draw();
        requestAnimationFrame(frame);
    }
    frame();
})();
