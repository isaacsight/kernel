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
            // Hide
            pinBar.style.display = "none";
            // Also clear hint if we just unpinned
            if (hint) hint.innerHTML = `<span class="muted">Hover a node to see connections.</span>`;
            return;
        }

        // Show
        pinBar.style.display = "flex";
        pinTitle.textContent = node.title || node.id;
        const url = node.url || ("../posts/" + node.id + ".html");
        pinTitle.setAttribute("href", url);

        // Update Copy Button state (optional feedback)
        const copyBtn = document.getElementById("copyPinLink");
        if (copyBtn) copyBtn.textContent = "Copy";
    }

    // copy link
    if (copyPinLinkBtn) {
        copyPinLinkBtn.addEventListener("click", (e) => {
            e.preventDefault(); // prevent form submit if inside form
            if (!pinnedNode) return;
            const url = pinnedNode.url || (window.location.origin + "/posts/" + pinnedNode.id + ".html");
            // Make absolute if relative
            const absUrl = new URL(url, window.location.href).href;
            navigator.clipboard.writeText(absUrl).then(() => {
                copyPinLinkBtn.textContent = "Copied!";
                setTimeout(() => copyPinLinkBtn.textContent = "Copy", 2000);
            });
        });
    }

    if (clearPinBtn) {
        clearPinBtn.addEventListener("click", () => {
            pinnedNode = null;
            setPinUI(null);
            if (hint) hint.innerHTML = `<span class="muted">Hover a node to see connections.</span>`;
            if (!running) { tick(); draw(); }
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

    // --- CAMERA STATE ---
    const camera = { x: 0, y: 0, k: 0.85 }; // x,y is Screen Center Offset

    function toWorld(sx, sy) {
        return { x: (sx - camera.x) / camera.k, y: (sy - camera.y) / camera.k };
    }

    // Normalize initial positions on a circle
    function resetLayout(keepVel) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const cx = 0;
        const cy = 0;
        const radius = Math.min(w, h) * 0.5; // Wider start
        const visibleNodes = nodesAll.filter(n => n.visible);

        visibleNodes.forEach((n, k) => {
            const a = (k / Math.max(1, visibleNodes.length)) * Math.PI * 2;
            n.x = cx + Math.cos(a) * radius;
            n.y = cy + Math.sin(a) * radius;
            if (!keepVel) { n.vx = 0; n.vy = 0; }
        });

        // Center Camera
        camera.x = w / 2;
        camera.y = h / 2;
        camera.k = 0.85;

        // Warm up physics
        if (!keepVel) {
            for (let i = 0; i < 30; i++) tick();
        }
    }

    const degree = new Map();
    linksAll.forEach(l => {
        degree.set(l.source.id, (degree.get(l.source.id) || 0) + 1);
        degree.set(l.target.id, (degree.get(l.target.id) || 0) + 1);
    });
    nodesAll.forEach(n => {
        const d = degree.get(n.id) || 0;
        n.r = n.canonical ? 12 : 5 + Math.min(7, Math.floor(d / 2));
    });

    // Physics params
    let running = true;
    const params = {
        linkDistance: 80,
        linkStrength: 0.05,
        charge: 400,
        centerStrength: 0.008,
        damping: 0.85,
        maxSpeed: 10,
    };

    function getVisibleNodes() { return nodesAll.filter(n => n.visible); }
    function getVisibleLinks() { return linksAll.filter(l => l.source.visible && l.target.visible); }

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

    // --- INTERACTION ---
    let hoverNode = null;
    let dragNode = null;
    let isPanning = false;
    let lastMouse = { x: 0, y: 0 };
    let dragOffset = { x: 0, y: 0 };

    function dist2(ax, ay, bx, by) {
        return (ax - bx) ** 2 + (ay - by) ** 2;
    }

    // wx, wy are WORLD coordinates
    function findNodeAt(wx, wy) {
        const visible = getVisibleNodes();
        let best = null;
        let bestD = Infinity;
        for (const n of visible) {
            const d = dist2(n.x, n.y, wx, wy);
            const rr = (n.r + 10) ** 2; // Generous hit area
            if (d <= rr && d < bestD) {
                best = n; bestD = d;
            }
        }
        return best;
    }

    function getMousePos(evt) {
        const rect = canvas.getBoundingClientRect();
        return { x: (evt.clientX - rect.left), y: (evt.clientY - rect.top) };
    }

    // 1. ZOOM (Wheel)
    canvas.addEventListener("wheel", (evt) => {
        evt.preventDefault();
        const m = getMousePos(evt);
        const w1 = toWorld(m.x, m.y); // World point under mouse BEFORE zoom

        const zoomSpeed = 0.0015;
        const zoomChange = Math.exp(-evt.deltaY * zoomSpeed);
        // Clamp Zoom
        const newK = Math.max(0.1, Math.min(4, camera.k * zoomChange));

        // We want w1 to stay at screen m
        // screen = world * k + camX
        // camX = screen - world * k
        camera.k = newK;
        camera.x = m.x - w1.x * camera.k;
        camera.y = m.y - w1.y * camera.k;

        if (!running) draw();
    }, { passive: false });

    // 2. DRAG / PAN (MouseDown)
    canvas.addEventListener("mousedown", (evt) => {
        const m = getMousePos(evt);
        const w = toWorld(m.x, m.y);
        const n = findNodeAt(w.x, w.y);

        lastMouse = m;

        if (n) {
            dragNode = n;
            dragOffset.x = n.x - w.x;
            dragOffset.y = n.y - w.y;
            dragNode.vx = 0;
            dragNode.vy = 0;
            return;
        }

        // Pan Background
        isPanning = true;
        canvas.style.cursor = "grabbing";
    });

    window.addEventListener("mouseup", () => {
        dragNode = null;
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = "default"; // Will update to grab/pointer on move
        }
    });

    canvas.addEventListener("mousemove", (evt) => {
        const m = getMousePos(evt);
        const w = toWorld(m.x, m.y);

        if (dragNode) {
            dragNode.x = w.x + dragOffset.x;
            dragNode.y = w.y + dragOffset.y;
            dragNode.vx = 0;
            dragNode.vy = 0;
            if (!running) { tick(); draw(); }
            return;
        }

        if (isPanning) {
            const dx = m.x - lastMouse.x;
            const dy = m.y - lastMouse.y;
            camera.x += dx;
            camera.y += dy;
            lastMouse = m;
            if (!running) draw();
            return;
        }

        lastMouse = m;

        // Hover
        const prevHover = hoverNode;
        hoverNode = findNodeAt(w.x, w.y);

        if (hoverNode) canvas.style.cursor = "pointer";
        else {
            canvas.style.cursor = isPanning ? "grabbing" : "grab";
        }

        // Update Hint
        if (hint && hoverNode !== prevHover) {
            if (!hoverNode) {
                if (!pinnedNode) hint.innerHTML = `<span class="muted">Hover a node to see connections.</span>`;
            } else {
                renderHint(hoverNode);
            }
        }
    });

    // 3. CLICK (Selection)
    canvas.addEventListener("click", (evt) => {
        // Did we move? (Click vs Drag distinction)
        // Simple check: we rely on standard click. 
        const m = getMousePos(evt);
        const w = toWorld(m.x, m.y);
        const n = findNodeAt(w.x, w.y);

        // Click Background -> Clear Pin
        if (!n) {
            if (pinnedNode) {
                pinnedNode = null;
                setPinUI(null);
                if (hint) hint.innerHTML = `<span class="muted">Hover a node to see connections.</span>`;
            }
            return;
        }

        const url = n.url || ("../posts/" + n.id + ".html");

        // Modifier key -> Open
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
            hoverNode = n;
            renderHint(n);
        }
    });

    canvas.addEventListener("dblclick", (evt) => {
        const m = getMousePos(evt);
        const w = toWorld(m.x, m.y);
        const n = findNodeAt(w.x, w.y);
        if (n) {
            const url = n.url || ("../posts/" + n.id + ".html");
            window.location.href = url;
        } else {
            // Optional: Reset Camera?
            resetLayout(false); // Recenters
        }
    });

    // --- PHYSICS LOOP ---
    function tick() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const nodes = getVisibleNodes();
        const links = getVisibleLinks();

        // Forces
        for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
                const b = nodes[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                let d2 = dx * dx + dy * dy;
                // Optimization
                if (d2 > 200000 || d2 === 0) continue;

                const f = params.charge / (d2 + 50);
                const dp = Math.sqrt(d2);
                const fx = (dx / dp) * f;
                const fy = (dy / dp) * f;
                a.vx -= fx; a.vy -= fy;
                b.vx += fx; b.vy += fy;
            }
        }

        for (const l of links) {
            const a = l.source;
            const b = l.target;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const diff = dist - params.linkDistance;
            const f = diff * params.linkStrength;
            const fx = (dx / dist) * f;
            const fy = (dy / dist) * f;
            a.vx += fx; a.vy += fy;
            b.vx -= fx; b.vy -= fy;
        }

        for (const n of nodes) {
            if (n === dragNode) continue;
            // Center Gravity -> 0,0
            n.vx -= n.x * params.centerStrength;
            n.vy -= n.y * params.centerStrength;

            n.vx *= params.damping;
            n.vy *= params.damping;

            const sp = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
            if (sp > params.maxSpeed) {
                n.vx = (n.vx / sp) * params.maxSpeed;
                n.vy = (n.vy / sp) * params.maxSpeed;
            }
            n.x += n.vx;
            n.y += n.vy;
            // NO BOUNDS! Infinite.
        }
    }

    function draw() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;

        ctx.setTransform(DPR, 0, 0, DPR, 0, 0); // Reset
        ctx.clearRect(0, 0, w, h);

        // Apply Camera Transform
        ctx.setTransform(DPR * camera.k, 0, 0, DPR * camera.k, camera.x * DPR, camera.y * DPR);

        const nodes = getVisibleNodes();
        const links = getVisibleLinks();

        // Priority Logic
        const focus = (pinnedNode && pinnedNode.visible)
            ? pinnedNode
            : ((hoverNode && hoverNode.visible) ? hoverNode : null);

        let focusSet = null;
        if (focus) {
            if (directionMode === "out") focusSet = outNeighbors.get(focus.id) || new Set();
            else if (directionMode === "in") focusSet = inNeighbors.get(focus.id) || new Set();
            else {
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
        ctx.lineWidth = 1.5;
        // Optimization: Background links faint
        ctx.globalAlpha = focus ? 0.08 : 0.2;
        ctx.fillStyle = "#555"; // Wait, stroke style?
        ctx.strokeStyle = "#555";

        ctx.beginPath();
        for (const l of links) {
            ctx.moveTo(l.source.x, l.source.y);
            ctx.lineTo(l.target.x, l.target.y);
        }
        ctx.stroke();

        // Highlight
        if (focus) {
            ctx.lineWidth = 3;
            for (const l of links) {
                let hit = false;
                if (directionMode === "out") hit = (l.source.id === focus.id && focusSet.has(l.target.id));
                else if (directionMode === "in") hit = (l.target.id === focus.id && focusSet.has(l.source.id));
                else hit = (l.source.id === focus.id && focusSet.has(l.target.id)) || (l.target.id === focus.id && focusSet.has(l.source.id));

                if (!hit) continue;

                const grad = ctx.createLinearGradient(l.source.x, l.source.y, l.target.x, l.target.y);
                if (l.source.id === focus.id) {
                    grad.addColorStop(0, "rgba(0, 214, 163, 0.95)");
                    grad.addColorStop(1, "rgba(0, 214, 163, 0.05)");
                } else {
                    grad.addColorStop(0, "rgba(255, 255, 255, 0.05)");
                    grad.addColorStop(1, "rgba(255, 255, 255, 0.95)");
                }
                ctx.strokeStyle = grad;
                ctx.beginPath();
                ctx.moveTo(l.source.x, l.source.y);
                ctx.lineTo(l.target.x, l.target.y);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;

        // Nodes
        for (const n of nodes) {
            const connected = isConnected(n);
            const isFocus = focus && n.id === focus.id;

            ctx.globalAlpha = focus ? (connected ? 1 : 0.1) : 1;

            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);

            if (n.canonical) {
                ctx.fillStyle = isFocus ? "#fff" : "#eee";
                ctx.shadowBlur = isFocus ? 32 : 16;
                ctx.shadowColor = "rgba(255, 255, 255, 0.35)";
            } else {
                ctx.fillStyle = isFocus ? "#00D6A3" : (connected && focus ? "#ccc" : "#666");
                if (isFocus) {
                    ctx.shadowBlur = 24;
                    ctx.shadowColor = "rgba(0, 214, 163, 0.6)";
                } else ctx.shadowBlur = 0;
            }
            ctx.fill();
            ctx.shadowBlur = 0;

            if (n.canonical) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = isFocus ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)";
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }

    function frame() {
        if (!running) return;
        tick();
        draw();
        requestAnimationFrame(frame);
    }
    frame();
})();
