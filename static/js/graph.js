(async function () {
    const canvas = document.getElementById("graphCanvas");
    const inspector = document.getElementById("graphInspector");
    const filterInput = document.getElementById("graphFilter");
    const canonOnly = document.getElementById("graphCanonOnly");
    const resetBtn = document.getElementById("graphReset");
    const directionSel = document.getElementById("graphDirection");

    let directionMode = "all";
    if (directionSel) {
        directionMode = directionSel.value || "all";
        directionSel.addEventListener("change", () => {
            directionMode = directionSel.value || "all";
            if (!running) { tick(); draw(); }
        });
    }

    if (!canvas) return;

    let selectedNode = null;
    let hoverNode = null;

    // --- INSPECTOR Logic ---
    function renderInspector(node) {
        if (!inspector) return;

        if (!node) {
            // LANDING STATE: "Suggested Paths" if nothing selected
            // Pick 3 random core nodes (if available)
            const coreNodes = nodesAll.filter(n => n.canonical).sort(() => 0.5 - Math.random()).slice(0, 3);

            let suggestionHTML = "";
            if (coreNodes.length > 0) {
                suggestionHTML = `
                <div class="inspector__section" style="margin-top:24px;">
                    <div class="inspector__section-title">Suggested Paths</div>
                    <ul class="inspector__list">
                        ${coreNodes.map(n => nodeLinkHTML(n.id)).join("")}
                    </ul>
                </div>`;
            }

            inspector.innerHTML = `
            <div class="graph__empty-state">
                <div class="empty-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="muted">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </div>
                <p>Click a node to focus</p>
                <small class="muted">Drag to pan • Scroll to zoom</small>
            </div>
            ${suggestionHTML}
            `;
            return;
        }

        const outSet = outNeighbors.get(node.id) || new Set();
        const inSet = inNeighbors.get(node.id) || new Set();

        const sortFn = (a, b) => (byId.get(a)?.title || a).localeCompare(byId.get(b)?.title || b);
        const outList = Array.from(outSet).sort(sortFn);
        const inList = Array.from(inSet).sort(sortFn);

        const title = escapeHtml(node.title || node.id);
        const mode = escapeHtml(node.mode || "");
        const pillar = escapeHtml((node.pillar || "").replaceAll("-", " "));
        const url = node.url || ("../posts/" + node.id + ".html");

        const absoluteUrl = new URL(url, window.location.href).href;

        inspector.innerHTML = `
          <div class="inspector__header">
            <span class="inspector__overline">${pillar || "Thought"}</span>
            <h2 class="inspector__title"><a href="${url}">${title}</a></h2>
            <div class="inspector__meta">
               ${mode ? `<span class="pill-tag">${mode}</span>` : ""}
               ${node.canonical ? `<span class="pill-tag canon">Core</span>` : ""}
            </div>
            
            <div class="inspector__actions">
                <a href="${url}" class="btn-primary-small">Open</a>
                <button id="btnCopyLink" class="btn-secondary-small">Copy Link</button>
            </div>
          </div>

          <div class="inspector__section">
             <div class="inspector__section-title">Connections</div>
             <div class="inspector__meta" style="gap:16px;">
                <div title="Outgoing"><span class="muted">Out:</span> ${outList.length}</div>
                <div title="Incoming"><span class="muted">In:</span> ${inList.length}</div>
             </div>
          </div>

          <div class="inspector__section">
            ${outList.length ? `<div class="inspector__section-title">Outgoing</div><ul class="inspector__list">${outList.map(nodeLinkHTML).join("")}</ul>` : ""}
            ${inList.length ? `<div class="inspector__section-title" style="margin-top:16px">Incoming</div><ul class="inspector__list">${inList.map(nodeLinkHTML).join("")}</ul>` : ""}
          </div>
        `;

        const btnCopy = document.getElementById("btnCopyLink");
        if (btnCopy) {
            btnCopy.addEventListener("click", () => {
                navigator.clipboard.writeText(absoluteUrl).then(() => {
                    btnCopy.textContent = "Copied!";
                    setTimeout(() => btnCopy.textContent = "Copy Link", 2000);
                });
            });
        }
    }

    function escapeHtml(s) {
        return String(s || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    }

    function nodeLinkHTML(slug) {
        const n = byId.get(slug);
        if (!n) return `<li><span class="muted">${slug}</span></li>`;
        const title = escapeHtml(n.title || slug);
        return `<li><a href="#" onclick="window.graphSelect('${n.id}'); return false;">${title}</a></li>`;
    }

    window.graphSelect = (id) => {
        const n = byId.get(id);
        if (n) {
            selectedNode = n;
            renderInspector(n);
            if (!running) draw();
        }
    };

    const ctx = canvas.getContext("2d");
    const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    function resize() {
        const parent = canvas.parentElement;
        if (parent) {
            const w = parent.clientWidth;
            const h = parent.clientHeight;
            canvas.width = w * DPR;
            canvas.height = h * DPR;
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        }
    }
    window.addEventListener("resize", () => { resize(); if (!running) draw(); });

    let graph;
    try {
        const res = await fetch("graph.json", { cache: "no-store" });
        graph = await res.json();
    } catch (e) { return; }

    // Init Logic
    resize();

    // Node Init
    const nodesAll = graph.nodes.map((n, i) => ({
        ...n,
        id: n.id || n.slug,
        i,
        x: Math.random(),
        y: Math.random(),
        vx: 0, vy: 0,
        r: 5, // Base size, recalculated later
        visible: true,
    }));
    const byId = new Map(nodesAll.map(n => [n.id, n]));
    const linksAll = graph.edges
        .map(e => ({ source: byId.get(e.source), target: byId.get(e.target) }))
        .filter(l => l.source && l.target);

    const outNeighbors = new Map();
    const inNeighbors = new Map();
    function add(map, a, b) { if (!map.has(a)) map.set(a, new Set()); map.get(a).add(b); }
    for (const l of linksAll) {
        add(outNeighbors, l.source.id, l.target.id);
        add(inNeighbors, l.target.id, l.source.id);
    }

    // Degree & Size Scaling
    const degree = new Map();
    linksAll.forEach(l => {
        degree.set(l.source.id, (degree.get(l.source.id) || 0) + 1);
        degree.set(l.target.id, (degree.get(l.target.id) || 0) + 1);
    });

    nodesAll.forEach(n => {
        const d = degree.get(n.id) || 0;
        // Core/Canon nodes get a boost, plus degree scaling
        // Hierarchy: Canon (Big) > High Degree (Med) > Small (Low)
        const base = n.canonical ? 18 : 6;
        const scale = n.canonical ? 1.5 : 2.5; // Degree impacts small nodes more
        n.r = base + Math.min(12, Math.floor(Math.sqrt(d) * scale));
    });

    const camera = { x: 0, y: 0, k: 0.8 };
    function toWorld(sx, sy) { return { x: (sx - camera.x) / camera.k, y: (sy - camera.y) / camera.k }; }

    function resetLayout(keepVel) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const radius = Math.min(w, h) * 0.5;
        const visible = nodesAll.filter(n => n.visible);
        visible.forEach((n, k) => {
            const a = (k / Math.max(1, visible.length)) * Math.PI * 2;
            n.x = Math.cos(a) * radius; n.y = Math.sin(a) * radius;
            if (!keepVel) { n.vx = 0; n.vy = 0; }
        });
        camera.x = w / 2; camera.y = h / 2; camera.k = 0.85;
        if (!keepVel) for (let i = 0; i < 40; i++) tick();
    }
    if (resetBtn) resetBtn.addEventListener("click", () => resetLayout(false));

    function getVisibleNodes() { return nodesAll.filter(n => n.visible); }
    function getVisibleLinks() { return linksAll.filter(l => l.source.visible && l.target.visible); }
    function applyFilter() {
        const q = (filterInput.value || "").trim().toLowerCase();
        const canon = canonOnly.checked;
        nodesAll.forEach(n => {
            const h = `${n.title} ${n.pillar} ${n.mode}`.toLowerCase();
            n.visible = (!q || h.includes(q)) && (!canon || n.canonical);
        });
        resetLayout(false);
    }
    if (filterInput) filterInput.addEventListener("input", applyFilter);
    if (canonOnly) canonOnly.addEventListener("change", applyFilter);

    let running = true;
    const params = { linkDistance: 100, linkStrength: 0.04, charge: 600, centerStrength: 0.012, damping: 0.85, maxSpeed: 12 };

    let dragNode = null;
    let isPanning = false;
    let lastMouse = { x: 0, y: 0 };

    function dist2(ax, ay, bx, by) { return (ax - bx) ** 2 + (ay - by) ** 2; }
    function findNodeAt(wx, wy) {
        const visible = getVisibleNodes();
        let best = null, bestD = Infinity;
        for (const n of visible) {
            const d = dist2(n.x, n.y, wx, wy);
            const rr = (n.r + 8) ** 2; // Hit target padding
            if (d <= rr && d < bestD) { best = n; bestD = d; }
        }
        return best;
    }

    function getMousePos(evt) {
        const r = canvas.getBoundingClientRect();
        return { x: evt.clientX - r.left, y: evt.clientY - r.top };
    }

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const m = getMousePos(e);
        const w1 = toWorld(m.x, m.y);
        const speed = 0.0015;
        const zoom = Math.exp(-e.deltaY * speed);
        camera.k = Math.max(0.1, Math.min(5, camera.k * zoom));
        camera.x = m.x - w1.x * camera.k;
        camera.y = m.y - w1.y * camera.k;
        if (!running) draw();
    }, { passive: false });

    canvas.addEventListener("mousedown", (e) => {
        const m = getMousePos(e);
        const w = toWorld(m.x, m.y);
        const n = findNodeAt(w.x, w.y);
        lastMouse = m;
        if (n) { dragNode = n; n.vx = 0; n.vy = 0; return; }
        isPanning = true;
        canvas.style.cursor = "grabbing";
    });

    window.addEventListener("mouseup", () => {
        dragNode = null;
        if (isPanning) { isPanning = false; canvas.style.cursor = "default"; }
    });

    canvas.addEventListener("mousemove", (e) => {
        const m = getMousePos(e);
        const w = toWorld(m.x, m.y);

        if (dragNode) {
            dragNode.x = w.x; dragNode.y = w.y;
            dragNode.vx = 0; dragNode.vy = 0;
            if (!running) { tick(); draw(); }
            return;
        }
        if (isPanning) {
            camera.x += m.x - lastMouse.x;
            camera.y += m.y - lastMouse.y;
            lastMouse = m;
            if (!running) draw();
            return;
        }
        lastMouse = m;

        const prevHover = hoverNode;
        hoverNode = findNodeAt(w.x, w.y);
        canvas.style.cursor = hoverNode ? "pointer" : "default";

        if (hoverNode !== prevHover) {
            if (!running) draw();
        }
    });

    canvas.addEventListener("click", (e) => {
        const m = getMousePos(e);
        const w = toWorld(m.x, m.y);
        const n = findNodeAt(w.x, w.y);
        if (n) {
            if (e.metaKey || e.ctrlKey) { window.open(n.url || `../posts/${n.id}.html`, "_blank"); }
            else {
                selectedNode = n;
                renderInspector(n);
                draw();
            }
        } else {
            selectedNode = null;
            renderInspector(null);
            draw();
        }
    });

    function tick() {
        const nodes = getVisibleNodes();
        const links = getVisibleLinks();
        for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
                const b = nodes[j];
                const dx = b.x - a.x, dy = b.y - a.y;
                let d2 = dx * dx + dy * dy;
                if (d2 === 0) d2 = 0.1;
                if (d2 > 250000) continue;
                const f = params.charge / (d2 + 100);
                const dp = Math.sqrt(d2);
                const fx = (dx / dp) * f, fy = (dy / dp) * f;
                a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
            }
        }
        for (const l of links) {
            const a = l.source, b = l.target;
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const f = (dist - params.linkDistance) * params.linkStrength;
            const fx = (dx / dist) * f, fy = (dy / dist) * f;
            a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
        for (const n of nodes) {
            if (n === dragNode) continue;
            n.vx -= n.x * params.centerStrength; n.vy -= n.y * params.centerStrength;
            n.vx *= params.damping; n.vy *= params.damping;
            const sp = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
            if (sp > params.maxSpeed) { n.vx = (n.vx / sp) * params.maxSpeed; n.vy = (n.vy / sp) * params.maxSpeed; }
            n.x += n.vx; n.y += n.vy;
        }
    }

    function draw() {
        const w = canvas.width / DPR;
        const h = canvas.height / DPR;

        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.setTransform(DPR * camera.k, 0, 0, DPR * camera.k, camera.x * DPR, camera.y * DPR);

        const nodes = getVisibleNodes();
        const links = getVisibleLinks();

        const focus = selectedNode || hoverNode;
        const active = selectedNode;

        let focusSet = null;
        if (focus) {
            if (directionMode === "out") focusSet = outNeighbors.get(focus.id) || new Set();
            else if (directionMode === "in") focusSet = inNeighbors.get(focus.id) || new Set();
            else {
                const o = outNeighbors.get(focus.id) || new Set();
                const i = inNeighbors.get(focus.id) || new Set();
                focusSet = new Set([...o, ...i]);
            }
        }

        // --- SPOTLIGHT MODE ---
        // If focusing, fade everything else hard.
        // If not focusing, normal state.

        // Links
        ctx.lineWidth = 1;
        // If focus: extremely faint background links (0.03). If not: normal (0.15)
        ctx.globalAlpha = focus ? 0.03 : 0.15;
        ctx.strokeStyle = "#555";
        ctx.beginPath();
        for (const l of links) {
            ctx.moveTo(l.source.x, l.source.y);
            ctx.lineTo(l.target.x, l.target.y);
        }
        ctx.stroke();

        // Highlight Links
        if (focus) {
            ctx.lineWidth = 2;
            for (const l of links) {
                const isConnected =
                    (l.source.id === focus.id && focusSet.has(l.target.id)) ||
                    (l.target.id === focus.id && focusSet.has(l.source.id));

                if (isConnected) {
                    const grd = ctx.createLinearGradient(l.source.x, l.source.y, l.target.x, l.target.y);
                    if (l.source.id === focus.id) {
                        // Outgoing color
                        grd.addColorStop(0, "rgba(0, 214, 163, 0.9)");
                        grd.addColorStop(1, "rgba(0, 214, 163, 0.05)");
                    } else {
                        // Incoming color
                        grd.addColorStop(0, "rgba(255,255,255,0.05)");
                        grd.addColorStop(1, "rgba(255,255,255,0.9)");
                    }
                    ctx.strokeStyle = grd;
                    ctx.globalAlpha = 1;
                    ctx.beginPath();
                    ctx.moveTo(l.source.x, l.source.y);
                    ctx.lineTo(l.target.x, l.target.y);
                    ctx.stroke();
                }
            }
        }

        // Nodes
        for (const n of nodes) {
            const isSel = selectedNode && n.id === selectedNode.id;
            const isHov = hoverNode && n.id === hoverNode.id;
            const isConn = focusSet && focusSet.has(n.id);
            const isFocus = isSel || isHov;

            // Spotlight Opacity: 
            // - Focused: 1
            // - Connected: 0.8
            // - Unrelated: 0.05 (Ghosted)
            let alpha = 1;
            if (focus) {
                if (isFocus) alpha = 1;
                else if (isConn) alpha = 0.8;
                else alpha = 0.05;
            } else {
                // Default view
                alpha = n.canonical ? 1 : 0.7; // Core nodes pop more
            }

            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);

            // Colors:
            // - Core/Canon: White
            // - Essays: Primary Green
            // - Thoughts/Fragments: Muted grey/blue
            let fill = "#666";
            if (n.canonical) fill = "#fff";
            else if ((n.mode || "").toLowerCase() === "essay") fill = "#00D6A3"; // Green
            else fill = "#888"; // Muted for thoughts

            // Override for focus
            if (isFocus) {
                fill = "#fff"; // Highlight white
            } else if (isConn) {
                fill = n.canonical ? "#fff" : "#ccc";
            }

            ctx.fillStyle = fill;

            // Shadow / Glow
            if (n.canonical || isFocus) {
                // Pulse effect for core nodes?
                // Just static glow for now
                ctx.shadowBlur = isFocus ? 24 : 12;
                ctx.shadowColor = isFocus ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)";
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fill();
            ctx.shadowBlur = 0;

            // Stroke for core nodes
            if (n.canonical) {
                ctx.strokeStyle = isFocus ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.1)";
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Labels
            // Show if: Focused OR (Connected AND Zoomed In) OR (Canon AND Zoomed In slightly)
            const showLabel = isFocus || (isConn && camera.k > 1.2) || (n.canonical && camera.k > 0.6);

            if (showLabel) {
                ctx.fillStyle = isFocus ? "#fff" : "rgba(255,255,255,0.7)";
                ctx.font = isFocus ? "600 13px Inter, sans-serif" : "11px Inter, sans-serif";

                // Avoid drawing text on top of node
                const textX = n.x + n.r + 6;
                const textY = n.y + 4;

                // Optional: dark backing for text?
                // ctx.globalAlpha = alpha * 0.8;
                // ctx.fillStyle = "rgba(0,0,0,0.5)"; ... rect ...

                ctx.fillText(n.title || n.id, textX, textY);
            }
        }
        ctx.globalAlpha = 1;
    }

    function frame() { if (running) { tick(); draw(); requestAnimationFrame(frame); } }

    resetLayout(false);
    // Initial Render of Inspector with Suggestions
    renderInspector(null);
    frame();

})();
