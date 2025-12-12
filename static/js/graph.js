(function () {
    const initGraph = async function () {
        console.log("Graph: Initializing...");
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

        // Defaults
        // if (canonOnly) canonOnly.checked = false; // REMOVED: Default is On now.

        if (!canvas) { console.error("Graph: Canvas not found!"); return; }


        // --- STATE ---
        // --- STATE ---
        const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

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
        let camera = { x: 0, y: 0, k: 0.95 }; // Start slightly closer
        let camTarget = null; // smooth transition target
        let running = true; // Physics loop

        // Alive Read Configuration
        const CONFIG = {
            charge: 500,        // Balance structure/space
            linkDist: 110,      // Room to breathe
            damping: 0.9,       // Fluid but stable
            drift: 0.08,        // "Alive" breathing (Wander DNA)
            zoomLimit: [0.1, 5],
            labels: true
        };

        // --- INITIALIZATION ---
        // Defaults
        if (container) container.classList.add("mode-read"); // Default style hook

        // Initial Center Hint Logic (Clean)
        const centerHint = document.getElementById("graphCenterHint");
        if (centerHint) {
            centerHint.classList.remove("hint-hidden");
        }

        // Clean up URL (remove mode param if present)
        const url = new URL(window.location);
        if (url.searchParams.has("mode")) {
            url.searchParams.delete("mode");
            window.history.replaceState({}, "", url);
        }

        // --- DATA LOADING ---
        let graph;
        try {
            const res = await fetch("graph.json", { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            graph = await res.json();
        } catch (e) {
            console.error("Graph load failed", e);
            const loader = document.getElementById("graphLoading");
            if (loader) loader.innerHTML = `<div style="color:#ff6b6b; font-family:var(--font-mono);">Failed to load map.<br><small>${e.message}</small></div>`;
            return;
        }

        // Hide Loading
        const loader = document.getElementById("graphLoading");
        if (loader) loader.classList.add("loaded");

        resize();

        nodesAll = graph.nodes.map((n, i) => ({
            ...n,
            id: n.id || n.slug,
            i,
            x: (Math.random() - 0.5) * 1200, // Wide scatter
            y: (Math.random() - 0.5) * 1200,
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

        // --- VISUAL COMPUTATION ---
        function getNodeRadius(n) {
            if (n.canonical) return 22; // Larger Core
            const d = degree.get(n.id) || 0;
            if (d > 6) return 12;
            return 5;
        }

        function getNodeColor(n, isFocus, isConn) {
            if (isFocus) return "#fff";
            if (isConn) return n.canonical ? "#eee" : "#ccc"; // Connected dim

            if (n.canonical) return "#fff";
            if ((n.mode || "").toLowerCase() === "essay") return "#00D6A3"; // Mint
            return "#666"; // Thoughts
        }

        // --- PHYSICS ---
        function tick() {
            const cfg = CONFIG;

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

        function draw() {
            ctx.resetTransform();
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.setTransform(DPR * camera.k, 0, 0, DPR * camera.k, camera.x * DPR, camera.y * DPR);

            const focus = selectedNode || hoverNode;
            // Direction filter
            let dirMode = (directionSel) ? directionSel.value : "all";

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

            ctx.lineWidth = 1;
            // Default opacity
            ctx.lineWidth = 1;
            // Default opacity: Faint but visible
            let linkAlpha = 0.15;
            if (focus) linkAlpha = 0.05; // Fade background links on focus

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
                    else if (isConn) alpha = 0.8;
                    else alpha = 0.1;
                    // Default
                    const deg = degree.get(n.id) || 0;
                    if (deg === 0) alpha = 0.4; // Dim orphans
                    else alpha = (!n.canonical) ? 0.8 : 1;
                }

                // Hover Growth
                let r = getNodeRadius(n);
                if (isFocus) r *= 1.15;

                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
                ctx.fillStyle = getNodeColor(n, isFocus, isConn);

                // Shadows
                // Shadows (Alive Glow)
                if (n.canonical || isFocus) {
                    ctx.shadowBlur = isFocus ? 24 : 16;
                    ctx.shadowColor = isFocus ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)";
                } else {
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = "rgba(255,255,255,0.15)";
                }

                ctx.fill();
                ctx.shadowBlur = 0;

                // Stroke (Core only in Read mode)
                // Stroke (Core only)
                if (n.canonical) {
                    ctx.strokeStyle = isFocus ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.1)";
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                // Labels
                let showLabel = isFocus || (isConn && camera.k > 1.2) || (n.canonical && camera.k > 0.6);

                if (showLabel) {
                    ctx.textAlign = "left";
                    ctx.textBaseline = "middle";

                    // Halo for readability
                    ctx.lineJoin = "round";
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = "rgba(0,0,0,0.8)";
                    ctx.font = isFocus ? "600 13px Inter, sans-serif" : "11px Inter, sans-serif";
                    ctx.strokeText(n.title || n.id, n.x + r + 8, n.y);

                    ctx.fillStyle = isFocus ? "#fff" : "rgba(255,255,255,0.85)";
                    ctx.fillText(n.title || n.id, n.x + r + 8, n.y);
                }
            }
            ctx.globalAlpha = 1;
        }

        // --- SIDEBAR UI ---
        function renderInspector(node) {
            if (!inspector) return;

            // Link Direction Visibility (Read Mode only on selection)
            // Link Direction
            if (directionSel && directionSel.parentElement) {
                directionSel.parentElement.style.display = node ? "" : "none";
            }

            // EMPTY STATE
            if (!node) {
                if (true) { // Always Read-like empty state, or just empty?
                    // Center Hint handles the "Click a node to explore"
                    inspector.innerHTML = `
                    <div class="graph__empty-state" style="margin-top:50%; text-align:center; opacity:0.3;">
                        <p class="muted">Select a node to view details</p>
                    </div>
                `;
                }
                return;
            }

            // SELECTED STATE
            const title = escapeHtml(node.title || node.id);
            const url = node.url || ("../posts/" + node.id + ".html");

            // Inspector Content
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
                ${(outList.length || inList.length) ? `<div style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">This thought connects to:</div>` : ""}
                ${outList.length ? `<div class="inspector__section-title">References (${outList.length})</div><ul class="inspector__list">${outList.map(nodeLinkHTML).join("")}</ul>` : ""}
                ${inList.length ? `<div class="inspector__section-title" style="margin-top:16px">Referenced by (${inList.length})</div><ul class="inspector__list">${inList.map(nodeLinkHTML).join("")}</ul>` : ""}
              </div>
            `;


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
                let r = n.canonical ? 20 : 10;
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
            // Ephemeral Hint
            const h = document.getElementById("graphCenterHint");
            if (h) h.style.opacity = "0";

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

                    // Smooth Fly To Node
                    // Center the node (account for sidebar offset if needed, but center is fine)
                    const w = canvas.width / DPR;
                    const h = canvas.height / DPR;

                    // Target zoom: 1.2 for focus
                    const targetK = 1.25;
                    // We want n.x, n.y to be at center w/2, h/2
                    // formula: center = camera.x + world * camera.k
                    // camera.x = center - world * camera.k
                    const tx = (w / 2) - n.x * targetK;
                    const ty = (h / 2) - n.y * targetK;

                    flyTo(tx, ty, targetK);
                }
            } else {
                window.graphDeselect();
            }
        });

        function flyTo(x, y, k) {
            camTarget = { x, y, k };
            // Ensure loop runs
            if (!running) requestAnimationFrame(frame);
        }

        // Keyboard Controls
        window.addEventListener("keydown", (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

            const step = 50;
            switch (e.key) {
                case "Escape": window.graphDeselect(); break;
                case "=": case "+": flyTo(camera.x - (canvas.width / DPR) * 0.1, camera.y - (canvas.height / DPR) * 0.1, camera.k * 1.2); break; // Zoom to center rough
                // Actually zoom needs proper focus point. Simpler: just modify camera.k and adjust x/y to keep center stable.
                // Re-impl below.

                case "ArrowLeft": camera.x += step; draw(); break;
                case "ArrowRight": camera.x -= step; draw(); break;
                case "ArrowUp": camera.y += step; draw(); break;
                case "ArrowDown": camera.y -= step; draw(); break;
            }

            if (e.key === "=" || e.key === "+" || e.key === "-") {
                const centerW = (canvas.width / DPR) / 2;
                const centerH = (canvas.height / DPR) / 2;
                const worldC = toWorld(centerW + camera.x, centerH + camera.y); // wait, toWorld uses camera
                // map center in world:
                const wx = (centerW - camera.x) / camera.k;
                const wy = (centerH - camera.y) / camera.k;

                let newK = camera.k;
                if (e.key === "-") newK /= 1.2;
                else newK *= 1.2;

                newK = Math.max(0.1, Math.min(5, newK));

                // newCamX = centerW - wx * newK
                const newX = centerW - wx * newK;
                const newY = centerH - wy * newK;

                flyTo(newX, newY, newK);
            }
        });

        // Touch Controls
        let lastDist = 0;
        let lastCenter = null;

        canvas.addEventListener("touchstart", (e) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                const r = canvas.getBoundingClientRect();
                lastMouse = { x: t.clientX - r.left, y: t.clientY - r.top };
                isPanning = true;
            } else if (e.touches.length === 2) {
                isPanning = false;
                lastDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const r = canvas.getBoundingClientRect();
                lastCenter = {
                    x: ((e.touches[0].clientX + e.touches[1].clientX) / 2) - r.left,
                    y: ((e.touches[0].clientY + e.touches[1].clientY) / 2) - r.top
                };
            }
        }, { passive: false });

        canvas.addEventListener("touchmove", (e) => {
            e.preventDefault(); // Prevent scrolling
            if (e.touches.length === 1 && isPanning) {
                const t = e.touches[0];
                const r = canvas.getBoundingClientRect();
                const m = { x: t.clientX - r.left, y: t.clientY - r.top };
                camera.x += m.x - lastMouse.x;
                camera.y += m.y - lastMouse.y;
                lastMouse = m;
                if (!running) draw();
            } else if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const r = canvas.getBoundingClientRect();
                const center = {
                    x: ((e.touches[0].clientX + e.touches[1].clientX) / 2) - r.left,
                    y: ((e.touches[0].clientY + e.touches[1].clientY) / 2) - r.top
                };

                if (lastDist > 0) {
                    const zoom = dist / lastDist;
                    const limit = CONFIG.zoomLimit;

                    // Zoom around previous center (stabilize interaction)
                    const wx = (lastCenter.x - camera.x) / camera.k;
                    const wy = (lastCenter.y - camera.y) / camera.k;

                    camera.k = Math.max(limit[0], Math.min(limit[1], camera.k * zoom));

                    // Adjust camera so world point is at new center
                    camera.x = center.x - wx * camera.k;
                    camera.y = center.y - wy * camera.k;
                }

                lastDist = dist;
                lastCenter = center;
                if (!running) draw();
            }
        }, { passive: false });

        canvas.addEventListener("touchend", () => {
            isPanning = false;
            lastDist = 0;
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
            // Fix: Use optional chaining to prevent crashes on missing IDs
            const q = ((filterInput && filterInput.value) || "").trim().toLowerCase();
            const canon = (canonOnly && canonOnly.checked);

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

        // --- HINT INTERACTION ---
        function hideHint() {
            if (centerHint && !centerHint.classList.contains("hint-hidden")) {
                centerHint.classList.add("hint-hidden");
            }
        }
        canvas.addEventListener("mousedown", hideHint);
        canvas.addEventListener("wheel", hideHint, { passive: false });
        canvas.addEventListener("touchstart", hideHint, { passive: true });

        // Loop
        function frame() {
            if (running || camTarget) {
                // Safety
                if (canvas.width === 0 || canvas.height === 0) {
                    resize();
                    if (canvas.width > 0) resetLayout();
                }

                // Smooth Camera Ease
                if (camTarget) {
                    const ease = 0.1;
                    const diffX = camTarget.x - camera.x;
                    const diffY = camTarget.y - camera.y;
                    const diffK = camTarget.k - camera.k;

                    camera.x += diffX * ease;
                    camera.y += diffY * ease;
                    camera.k += diffK * ease;

                    // Snap if close
                    if (Math.abs(diffX) < 0.5 && Math.abs(diffY) < 0.5 && Math.abs(diffK) < 0.001) {
                        camera.x = camTarget.x;
                        camera.y = camTarget.y;
                        camera.k = camTarget.k;
                        camTarget = null;
                    }
                    // Always redraw during transition
                    draw();
                } else if (running) {
                    tick();
                    draw();
                }
            }
            requestAnimationFrame(frame);
        }

        // Kickoff
        resetLayout();
        renderInspector(null);
        frame();

        console.log("Graph: Running.");
    }; // End initGraph

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initGraph);
    } else {
        initGraph();
    }
})();
