(async function () {
    const canvas = document.getElementById("graphCanvas");
    const container = document.querySelector(".graph__wrap");
    const inspector = document.getElementById("graphInspector");

    // Controls
    const filterInput = document.getElementById("graphFilter");
    const canonOnly = document.getElementById("graphCanonOnly");
    const resetBtn = document.getElementById("graphReset");
    const directionSel = document.getElementById("graphDirection");

    // Toggle
    const modeRadios = document.querySelectorAll('input[name="mode"]');

    if (!canvas) return;

    // --- STATE ---
    let MODE = "read"; // 'read' | 'wander'
    let nodesAll = [];
    let linksAll = [];
    let byId = new Map();
    let degree = new Map();
    let outNeighbors = new Map();
    let inNeighbors = new Map();

    // Interaction State
    let selectedNode = null;
    let hoverNode = null;
    let dragNode = null;
    let isPanning = false;
    let lastMouse = { x: 0, y: 0 };
    let camera = { x: 0, y: 0, k: 0.8 };
    let running = true; // Physics loop

    // Parameters per Mode
    const CONFIG = {
        read: {
            charge: 600,
            linkDist: 100,
            damping: 0.85,
            drift: 0,
            zoomLimit: [0.1, 5],
            labels: true
        },
        wander: {
            charge: 400,
            linkDist: 120,
            damping: 0.95, // floaty
            drift: 0.05,
            zoomLimit: [0.2, 3],
            labels: false
        }
    };

    // --- MODE SWITCHING ---
    function setMode(newMode) {
        if (MODE === newMode) return;
        MODE = newMode;

        // Update UI Classes
        if (container) {
            container.classList.remove("mode-read", "mode-wander");
            container.classList.add(`mode-${MODE}`);
        }

        // Restore / Clear selection on mode switch?
        // Spec says: Wander has no selection initially.
        selectedNode = null;
        renderInspector(null);

        // Physics kick
        running = true;

        // Reset Layout gently?
        // No, keep positions, just change forces/visuals.

        // Update URL state (silent)
        const url = new URL(window.location);
        url.searchParams.set("mode", MODE);
        window.history.replaceState({}, "", url);
    }

    modeRadios.forEach(r => {
        r.addEventListener("change", (e) => {
            if (e.target.checked) setMode(e.target.value);
        });
    });

    // Check URL param on load
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("mode") === "wander") {
        document.getElementById("modeWander").checked = true;
        setMode("wander");
    } else {
        setMode("read"); // default
    }

    // --- DATA LOADING ---
    let graph;
    try {
        const res = await fetch("graph.json", { cache: "no-store" });
        graph = await res.json();
    } catch (e) { return; }

    resize();

    nodesAll = graph.nodes.map((n, i) => ({
        ...n,
        id: n.id || n.slug,
        i,
        x: Math.random(),
        y: Math.random(),
        vx: 0, vy: 0,
        visible: true
    }));
    byId = new Map(nodesAll.map(n => [n.id, n]));
    linksAll = graph.edges
        .map(e => ({ source: byId.get(e.source), target: byId.get(e.target) }))
        .filter(l => l.source && l.target);

    function add(map, a, b) { if (!map.has(a)) map.set(a, new Set()); map.get(a).add(b); }
    for (const l of linksAll) {
        add(outNeighbors, l.source.id, l.target.id);
        add(inNeighbors, l.target.id, l.source.id);

        degree.set(l.source.id, (degree.get(l.source.id) || 0) + 1);
        degree.set(l.target.id, (degree.get(l.target.id) || 0) + 1);
    }

    // --- VISUAL COMPUTATION (Dynamic per mode) ---
    function getNodeRadius(n) {
        if (MODE === "wander") {
            return 5; // Uniform
        } else {
            // Read Mode: Hierarchy
            const d = degree.get(n.id) || 0;
            // Canon = Large (18), High Degree (>8) = Med (12), Else = Small (6)
            if (n.canonical) return 18;
            if (d > 6) return 10;
            return 6;
        }
    }

    function getNodeColor(n, isFocus, isConn) {
        if (MODE === "wander") {
            // Monochrome / Faint
            if (isFocus) return "#fff";
            if (isConn) return "rgba(255,255,255,0.4)";
            return "rgba(255,255,255,0.15)";
        } else {
            // Read Mode: Functional
            if (isFocus) return "#fff";
            if (isConn) return n.canonical ? "#eee" : "#ccc"; // Connected dim

            // Base Colors
            if (n.canonical) return "#fff";
            if ((n.mode || "").toLowerCase() === "essay") return "#00D6A3"; // Mint
            return "#666"; // Thoughts
        }
    }

    // --- PHYSICS ---
    function tick() {
        const cfg = CONFIG[MODE];

        // Repulse
        for (let i = 0; i < nodesAll.length; i++) {
            const a = nodesAll[i];
            // Drift in Wander Mode
            if (cfg.drift > 0) {
                a.vx += (Math.random() - 0.5) * cfg.drift;
                a.vy += (Math.random() - 0.5) * cfg.drift;
            }

            for (let j = i + 1; j < nodesAll.length; j++) {
                const b = nodesAll[j];
                const dx = b.x - a.x, dy = b.y - a.y;
                let d2 = dx * dx + dy * dy;
                if (d2 === 0) d2 = 0.1;
                if (d2 > 250000) continue;
                const f = cfg.charge / (d2 + 100);
                const dp = Math.sqrt(d2);
                const fx = (dx / dp) * f, fy = (dy / dp) * f;
                a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
            }
        }

        // Spring
        for (const l of linksAll) {
            const a = l.source, b = l.target;
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const f = (dist - cfg.linkDist) * 0.04;
            const fx = (dx / dist) * f, fy = (dy / dist) * f;
            a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }

        // Center/Damp
        for (const n of nodesAll) {
            if (n === dragNode) continue;
            n.vx -= n.x * 0.015; n.vy -= n.y * 0.015; // Center Gravity
            n.vx *= cfg.damping; n.vy *= cfg.damping;
            n.x += n.vx; n.y += n.vy;
        }
    }

    // --- DRAW ---
    const ctx = canvas.getContext("2d");
    const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    function draw() {
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.setTransform(DPR * camera.k, 0, 0, DPR * camera.k, camera.x * DPR, camera.y * DPR);

        const focus = selectedNode || hoverNode;
        // Direction filter only applies in READ mode
        let dirMode = (MODE === "read" && directionSel) ? directionSel.value : "all";

        let focusSet = null;
        if (focus) {
            if (dirMode === "out") focusSet = outNeighbors.get(focus.id) || new Set();
            else if (dirMode === "in") focusSet = inNeighbors.get(focus.id) || new Set();
            else {
                const o = outNeighbors.get(focus.id) || new Set();
                const i = inNeighbors.get(focus.id) || new Set();
                focusSet = new Set([...o, ...i]);
            }
        }

        // Links
        ctx.lineWidth = 1;
        // Default opacity
        let linkAlpha = (MODE === "wander") ? 0.05 : 0.15;
        if (focus) linkAlpha = 0.02; // Fade harder when focusing

        ctx.globalAlpha = linkAlpha;
        ctx.strokeStyle = "#555";
        ctx.beginPath();
        for (const l of linksAll) {
            ctx.moveTo(l.source.x, l.source.y);
            ctx.lineTo(l.target.x, l.target.y);
        }
        ctx.stroke();

        // Highlight Links
        if (focus) {
            ctx.lineWidth = 2;
            for (const l of linksAll) {
                const isConnected =
                    (l.source.id === focus.id && focusSet.has(l.target.id)) ||
                    (l.target.id === focus.id && focusSet.has(l.source.id));

                if (isConnected) {
                    const grd = ctx.createLinearGradient(l.source.x, l.source.y, l.target.x, l.target.y);
                    // READ: Colored Gradients. WANDER: White Gradients.
                    if (MODE === "read") {
                        if (l.source.id === focus.id) {
                            grd.addColorStop(0, "rgba(0, 214, 163, 0.9)");
                            grd.addColorStop(1, "rgba(0, 214, 163, 0.05)");
                        } else {
                            grd.addColorStop(0, "rgba(255,255,255,0.05)");
                            grd.addColorStop(1, "rgba(255,255,255,0.9)");
                        }
                    } else {
                        // Wander
                        grd.addColorStop(0, "rgba(255,255,255,0.6)");
                        grd.addColorStop(1, "rgba(255,255,255,0.1)");
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
        for (const n of nodesAll) {
            const isSel = selectedNode && n.id === selectedNode.id;
            const isHov = hoverNode && n.id === hoverNode.id;
            const isConn = focusSet && focusSet.has(n.id);
            const isFocus = isSel || isHov;

            // Opacity Logic
            let alpha = 1;
            if (focus) {
                if (isFocus) alpha = 1;
                else if (isConn) alpha = MODE === "read" ? 0.8 : 0.5;
                else alpha = MODE === "read" ? 0.1 : 0.05; // Ghost harder in wander
            } else {
                // Default Opacity
                alpha = (MODE === "read" && !n.canonical) ? 0.8 : 1;
                if (MODE === "wander") alpha = 0.6; // Uniform dim
            }

            // Hover Growth
            let r = getNodeRadius(n);
            if (isFocus) r *= 1.15;

            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.fillStyle = getNodeColor(n, isFocus, isConn);

            // Shadows
            if (MODE === "wander") {
                if (isFocus) {
                    ctx.shadowBlur = 30;
                    ctx.shadowColor = "rgba(255,255,255,0.6)";
                } else {
                    ctx.shadowBlur = 0;
                }
            } else {
                if (n.canonical || isFocus) {
                    ctx.shadowBlur = isFocus ? 24 : 12;
                    ctx.shadowColor = isFocus ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)";
                } else { ctx.shadowBlur = 0; }
            }

            ctx.fill();
            ctx.shadowBlur = 0;

            // Stroke (Core only in Read mode)
            if (MODE === "read" && n.canonical) {
                ctx.strokeStyle = isFocus ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.1)";
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Labels
            let showLabel = false;
            // READ: Hover, Focus, Conn (zoomed), Canon (zoomed)
            if (MODE === "read") {
                showLabel = isFocus || (isConn && camera.k > 1.2) || (n.canonical && camera.k > 0.6);
            }
            // WANDER: Focus Only.
            if (MODE === "wander") {
                showLabel = isSel; // Only on selection? Or Hover? User said "Hover: No labels yet. Click: Connections appear".
                // Let's hide hover labels in Wander.
            }

            if (showLabel) {
                ctx.fillStyle = isFocus ? "#fff" : "rgba(255,255,255,0.7)";
                ctx.font = isFocus ? "600 13px Inter, sans-serif" : "11px Inter, sans-serif";
                ctx.fillText(n.title || n.id, n.x + r + 6, n.y + 4);
            }
        }
        ctx.globalAlpha = 1;
    }

    // --- SIDEBAR UI ---
    function renderInspector(node) {
        if (!inspector) return;

        // EMPTY STATE
        if (!node) {
            if (MODE === "read") {
                // SUGGESTED PATHS (Read Mode)
                const coreNodes = nodesAll.filter(n => n.canonical).sort(() => 0.5 - Math.random()).slice(0, 3);
                const list = coreNodes.map(n => nodeLinkHTML(n.id)).join("");

                inspector.innerHTML = `
                <div class="graph__empty-state">
                    <div class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></div>
                    <p style="font-weight:600; color:var(--text-main);">Start anywhere.</p>
                    <p class="muted" style="margin-top:4px;">Click a node to explore connections.</p>
                </div>
                ${list ? `<div class="inspector__section" style="margin-top:24px;"><div class="inspector__section-title">Suggested Paths</div><ul class="inspector__list">${list}</ul></div>` : ""}
                `;
            } else {
                // WANDER MODE: Poetic Empty State
                inspector.innerHTML = `
                <div class="graph__empty-state" style="opacity:0.6; margin-top:40%;">
                    <p style="font-style:italic; font-family:serif; font-size:15px;">Some ideas reveal themselves slowly.</p>
                </div>`;
            }
            return;
        }

        // SELECTED STATE
        const title = escapeHtml(node.title || node.id);
        const url = node.url || ("../posts/" + node.id + ".html");

        if (MODE === "read") {
            // READ MODE: Utilitarian
            const outSet = outNeighbors.get(node.id) || new Set();
            const inSet = inNeighbors.get(node.id) || new Set();
            const sortFn = (a, b) => (byId.get(a)?.title || a).localeCompare(byId.get(b)?.title || b);

            const outList = Array.from(outSet).sort(sortFn);
            const inList = Array.from(inSet).sort(sortFn);

            inspector.innerHTML = `
              <div class="inspector__header">
                <span class="inspector__overline">${escapeHtml(node.pillar || "Thought")}</span>
                <h2 class="inspector__title"><a href="${url}">${title}</a></h2>
                <div class="inspector__meta">
                   ${node.mode ? `<span class="pill-tag">${node.mode}</span>` : ""}
                   ${node.canonical ? `<span class="pill-tag canon">Core</span>` : ""}
                </div>
                <div class="inspector__actions">
                    <a href="${url}" class="btn-primary-small">Read</a>
                    <button id="btnCopyLink" class="btn-secondary-small">Copy Link</button>
                </div>
              </div>
              <div class="inspector__section">
                ${outList.length ? `<div class="inspector__section-title">References (${outList.length})</div><ul class="inspector__list">${outList.map(nodeLinkHTML).join("")}</ul>` : ""}
                ${inList.length ? `<div class="inspector__section-title" style="margin-top:16px">Referenced by (${inList.length})</div><ul class="inspector__list">${inList.map(nodeLinkHTML).join("")}</ul>` : ""}
              </div>
            `;
        } else {
            // WANDER MODE: Poetic / Minimal
            // Count total connections
            const deg = (degree.get(node.id) || 0);

            inspector.innerHTML = `
              <div class="inspector__header" style="border:none; margin-top:20%;">
                <h2 class="inspector__title" style="font-family:serif; font-size:24px; font-weight:400; margin-bottom:12px;">${title}</h2>
                <p class="muted" style="font-style:italic;">One thought led to another.</p>
                
                <div style="margin-top:24px; color:var(--text-muted); font-size:13px;">
                    Connected thoughts: ${deg}
                </div>
                
                <div class="inspector__actions" style="margin-top:32px; justify-content:flex-start;">
                    <a href="${url}" class="btn-secondary-small" style="background:transparent; border:1px solid rgba(255,255,255,0.2);">Enter</a>
                    <button onclick="window.graphDeselect()" class="btn-text" style="color:var(--text-muted);">Wander more</button>
                </div>
              </div>
            `;
        }

        // Copy logic
        const btnCopy = document.getElementById("btnCopyLink");
        if (btnCopy) {
            const absUrl = new URL(url, window.location.href).href;
            btnCopy.addEventListener("click", () => {
                navigator.clipboard.writeText(absUrl).then(() => {
                    btnCopy.textContent = "Copied!";
                    setTimeout(() => btnCopy.textContent = "Copy Link", 2000);
                });
            });
        }
    }

    function escapeHtml(s) { return String(s || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
    function nodeLinkHTML(slug) {
        const n = byId.get(slug);
        if (!n) return `<li><span class="muted">${slug}</span></li>`;
        const title = escapeHtml(n.title || slug);
        return `<li><a href="#" onclick="window.graphSelect('${n.id}'); return false;">${title}</a></li>`;
    }

    // --- GLOBAL HOOKS ---
    window.graphSelect = (id) => {
        const n = byId.get(id);
        if (n) {
            selectedNode = n;
            renderInspector(n);
            if (!running) draw();
        }
    };
    window.graphDeselect = () => {
        selectedNode = null;
        renderInspector(null);
        if (!running) draw();
    };

    // --- EVENTS ---
    function resize() {
        const parent = canvas.parentElement;
        if (parent) {
            const w = parent.clientWidth;
            const h = parent.clientHeight;
            canvas.width = w * DPR;
            canvas.height = h * DPR;
            canvas.style.width = "100%";
            canvas.style.height = "100%";
        }
    }
    window.addEventListener("resize", () => { resize(); if (!running) draw(); });

    function toWorld(sx, sy) { return { x: (sx - camera.x) / camera.k, y: (sy - camera.y) / camera.k }; }
    function getMousePos(evt) {
        const r = canvas.getBoundingClientRect();
        return { x: evt.clientX - r.left, y: evt.clientY - r.top };
    }
    function dist2(ax, ay, bx, by) { return (ax - bx) ** 2 + (ay - by) ** 2; }
    function findNodeAt(wx, wy) {
        // Hit box depends on mode/radius
        const nodes = nodesAll.filter(n => n.visible);
        let best = null, bestD = Infinity;
        for (const n of nodes) {
            const d = dist2(n.x, n.y, wx, wy);
            let r = MODE === "wander" ? 8 : (n.canonical ? 20 : 10);
            if (d <= (r + 5) ** 2 && d < bestD) { best = n; bestD = d; }
        }
        return best;
    }

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const m = getMousePos(e);
        const w1 = toWorld(m.x, m.y);
        const limit = CONFIG[MODE].zoomLimit;
        const speed = 0.0015;
        const zoom = Math.exp(-e.deltaY * speed);
        camera.k = Math.max(limit[0], Math.min(limit[1], camera.k * zoom));
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

        if (hoverNode !== prevHover) if (!running) draw();
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
            // In wander mode, background click deselects? Yes.
            window.graphDeselect();
        }
    });

    // Reset Layout
    function resetLayout() {
        if (!canvas) return;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const radius = Math.min(w, h) * 0.5;
        // Don't filter by visible in wander? Always all visible?
        // Actually filter needs to run regardless.
        applyFilter();

        const visible = nodesAll.filter(n => n.visible);
        visible.forEach((n, k) => {
            const a = (k / Math.max(1, visible.length)) * Math.PI * 2;
            n.x = Math.cos(a) * radius; n.y = Math.sin(a) * radius;
            n.vx = 0; n.vy = 0;
        });
        camera.x = w / 2; camera.y = h / 2; camera.k = 0.85;
        running = true;
    }
    if (resetBtn) resetBtn.addEventListener("click", resetLayout);

    function applyFilter() {
        // In Wander mode, ignore inputs? 
        // Spec says: "Controls: Hide Analytical Controls".
        // But search is separate.
        // Let's assume filters apply in READ mode.
        // In WANDER mode: show all? Or respect search?
        // "Search (optional)". Let's respect search if it exists.

        const q = (filterInput.value || "").trim().toLowerCase();
        const canon = (MODE === "read" && canonOnly.checked);

        nodesAll.forEach(n => {
            const h = `${n.title} ${n.pillar} ${n.mode}`.toLowerCase();
            const matchesQ = !q || h.includes(q);
            const matchesCanon = !canon || n.canonical;
            n.visible = matchesQ && matchesCanon;
        });
        // We don't necessarily reset layout on filter change, just vis.
        // But re-layout helps.
        if (!running) draw();
    }
    if (filterInput) filterInput.addEventListener("input", applyFilter);
    if (canonOnly) canonOnly.addEventListener("change", applyFilter);

    // Loop
    function frame() {
        if (running) {
            tick();
            draw();
            // Stop if stable?
            // In Wander mode, drift keeps it running forever.
            // In Read mode, we can sleep.
            if (MODE === "read") {
                let maxV = 0;
                nodesAll.forEach(n => maxV = Math.max(maxV, Math.abs(n.vx) + Math.abs(n.vy)));
                if (maxV < 0.005) running = false;
            }
        }
        requestAnimationFrame(frame);
    }

    // Kickoff
    resetLayout();
    renderInspector(null);
    frame();

})();
