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
            </div>`;
            // Remove selection class from sidebar if any
            return;
        }

        const outSet = outNeighbors.get(node.id) || new Set();
        const inSet = inNeighbors.get(node.id) || new Set();

        // Sort neighbors
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
               ${node.canonical ? `<span class="pill-tag canon">Canon</span>` : ""}
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
        // Use # to prevent page reload, handle via graphSelect
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

    const nodesAll = graph.nodes.map((n, i) => ({
        ...n,
        id: n.id || n.slug,
        i,
        x: Math.random(),
        y: Math.random(),
        vx: 0, vy: 0,
        r: n.canonical ? 14 : 6,
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

    const degree = new Map();
    linksAll.forEach(l => {
        degree.set(l.source.id, (degree.get(l.source.id) || 0) + 1);
        degree.set(l.target.id, (degree.get(l.target.id) || 0) + 1);
    });
    nodesAll.forEach(n => {
        const d = degree.get(n.id) || 0;
        n.r = n.canonical ? 14 : 5 + Math.min(10, Math.floor(Math.sqrt(d) * 2.5));
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
    const params = { linkDistance: 80, linkStrength: 0.05, charge: 500, centerStrength: 0.015, damping: 0.85, maxSpeed: 12 };

    let dragNode = null;
    let isPanning = false;
    let lastMouse = { x: 0, y: 0 };

    function dist2(ax, ay, bx, by) { return (ax - bx) ** 2 + (ay - by) ** 2; }
    function findNodeAt(wx, wy) {
        const visible = getVisibleNodes();
        let best = null, bestD = Infinity;
        for (const n of visible) {
            const d = dist2(n.x, n.y, wx, wy);
            const rr = (n.r + 8) ** 2;
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
        // Prevent click if panning logic needed, but here simple click is fine
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

        ctx.lineWidth = 1;
        ctx.globalAlpha = focus ? 0.08 : 0.2;
        ctx.strokeStyle = "#555";
        ctx.beginPath();
        for (const l of links) {
            ctx.moveTo(l.source.x, l.source.y);
            ctx.lineTo(l.target.x, l.target.y);
        }
        ctx.stroke();

        if (focus) {
            ctx.lineWidth = 2;
            for (const l of links) {
                const isConnected =
                    (l.source.id === focus.id && focusSet.has(l.target.id)) ||
                    (l.target.id === focus.id && focusSet.has(l.source.id));

                if (isConnected) {
                    const grd = ctx.createLinearGradient(l.source.x, l.source.y, l.target.x, l.target.y);
                    if (l.source.id === focus.id) {
                        grd.addColorStop(0, "rgba(0, 214, 163, 0.9)");
                        grd.addColorStop(1, "rgba(0, 214, 163, 0.05)");
                    } else {
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

        for (const n of nodes) {
            const isSel = selectedNode && n.id === selectedNode.id;
            const isHov = hoverNode && n.id === hoverNode.id;
            const isConn = focusSet && focusSet.has(n.id);
            const isFocus = isSel || isHov;

            ctx.globalAlpha = focus ? (isFocus || isConn ? 1 : 0.1) : 1;

            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);

            if (n.canonical) {
                ctx.fillStyle = isFocus ? "#fff" : "#eee";
                ctx.shadowBlur = isFocus ? 24 : 12;
                ctx.shadowColor = "rgba(255,255,255,0.4)";
            } else {
                ctx.fillStyle = isFocus ? "#00D6A3" : (isConn ? "#ccc" : "#666");
                ctx.shadowBlur = isFocus ? 24 : 0;
                ctx.shadowColor = "rgba(0,214,163,0.5)";
            }
            ctx.fill();
            ctx.shadowBlur = 0;

            if (n.canonical) {
                ctx.strokeStyle = isFocus ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)";
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            if (isFocus || (isConn && camera.k > 1.2)) {
                ctx.fillStyle = "#fff";
                ctx.font = "12px Inter, sans-serif";
                ctx.fillText(n.title || n.id, n.x + n.r + 6, n.y + 4);
            }
        }
        ctx.globalAlpha = 1;
    }

    function frame() { if (running) { tick(); draw(); requestAnimationFrame(frame); } }

    resetLayout(false);
    renderInspector(null);
    frame();

})();
