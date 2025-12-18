---
title: "Studio OS Reference"
date: 2025-12-16
description: "A live look at the intelligent system powering this studio."
slug: studio
type: page
layout: wide
---

<style>
    .studio-dashboard {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
        margin-top: 2rem;
    }
    
    .terminal-window {
        background: #1e1e1e;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        font-family: 'Fira Code', 'Courier New', monospace;
        overflow: hidden;
        border: 1px solid #333;
    }
    
    .terminal-header {
        background: #2d2d2d;
        padding: 0.5rem 1rem;
        display: flex;
        gap: 0.5rem;
        border-bottom: 1px solid #333;
    }
    
    .window-btn {
        width: 12px;
        height: 12px;
        border-radius: 50%;
    }
    
    .btn-red { background: #ff5f56; }
    .btn-yellow { background: #ffbd2e; }
    .btn-green { background: #27c93f; }
    
    .terminal-content {
        padding: 1.5rem;
        color: #d4d4d4;
        min-height: 300px;
        display: flex;
        flex-direction: column;
    }
    
    .status-line { margin-bottom: 1rem; }
    .status-value { font-weight: bold; color: #4ec9b0; }
    .log-entry { margin-bottom: 0.5rem; color: #ce9178; }
    .cursor {
        display: inline-block;
        width: 8px;
        height: 1.2em;
        background: #d4d4d4;
        animation: blink 1s step-end infinite;
        vertical-align: middle;
    }
    
    @keyframes blink {
        50% { opacity: 0; }
    }

    .system-map {
        background: #fff;
        border-radius: 8px;
        padding: 1.5rem;
        border: 1px solid #e0e0e0;
    }

    .metric-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
        margin-top: 1rem;
    }

    .metric-card {
        background: #000;
        color: #fff;
        padding: 1rem;
        border-radius: 6px;
        text-align: center;
    }
    
    .metric-val { font-size: 1.5rem; font-weight: bd; }
    .metric-label { font-size: 0.8rem; opacity: 0.7; }

    @media (max-width: 768px) {
        .studio-dashboard { grid-template-columns: 1fr; }
    }
</style>

# Studio OS: Live Reference
This is the live nervous system of the studio. You are seeing the actual "thought process" of the agents running in the background.

<div class="studio-dashboard">
    <div class="terminal-window">
        <div class="terminal-header">
            <div class="window-btn btn-red"></div>
            <div class="window-btn btn-yellow"></div>
            <div class="window-btn btn-green"></div>
            <span style="margin-left:auto; font-size: 0.8rem; color: #888;">admin/engineers/evolution_loop.py</span>
        </div>
        <div class="terminal-content" id="terminal-display">
            <div class="status-line">
                > SYSTEM_STATUS: <span id="status-text" class="status-value">CONNECTING...</span>
            </div>
             <div class="status-line">
                > CYCLE_ID: <span id="cycle-count" class="status-value">--</span>
            </div>
            <br>
            <div id="log-feed">
                <!-- Logs will appear here -->
            </div>
            <div class="status-line">
                > <span class="cursor"></span>
            </div>
            
            <div class="metric-grid">
                 <div class="metric-card">
                    <div class="metric-val" id="fitness-val">0.0</div>
                    <div class="metric-label">FITNESS</div>
                 </div>
                 <div class="metric-card">
                    <div class="metric-val" id="complexity-val">0.0</div>
                    <div class="metric-label">COMPLEXITY</div>
                 </div>
            </div>
        </div>
    </div>

    <div class="system-map">
        <h3>Architecture Map</h3>
        <p class="text-small">Highlights active component.</p>
        <div class="mermaid">
        graph TD
            %% Styles
            classDef active fill:#4ec9b0,stroke:#333,stroke-width:2px,color:#000
            classDef idle fill:#f5f5f5,stroke:#999,stroke-width:1px,color:#999

            Strategist[Strategist]:::idle
            TrendScout[Trend Scout]:::idle
            ContentEngine[Content Engine]:::idle
            Publisher[Publisher]:::idle

            Strategist -->|Directs| TrendScout
            TrendScout -->|Feeds| ContentEngine
            ContentEngine -->|Outputs| Publisher
            Publisher -->|Deploys| World[The World]
        </div>
    </div>
</div>

---

## Product Roadmap
The systems you see running here are evolving into a suite of modular products designed for founders and frontier teams.

[View the Product Ecosystem →](/products.html)

<script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true });

    // CONFIGURATION
    // Replace this URL with your Cloudflare Tunnel URL (e.g. https://cool-name.trycloudflare.com/api/studio/status)
    // Or leave as relative '/api/studio/status' if hosting backend on the same domain (e.g. Fly.io)
    const STUDIO_API_URL = 'https://animation-harper-principal-evanescence.trycloudflare.com/api/studio/status'; 

    async function updateDashboard() {
        try {
            // Check if we are on the live site (Netlify) but config is still relative
            let fetchUrl = STUDIO_API_URL;
            if (window.location.hostname !== 'localhost' && STUDIO_API_URL.startsWith('/')) {
                 // We are live, but URL is relative. This technically implies backend is NOT on Netlify.
                 // We need a fallback or a way to inject the tunnel URL here.
                 // For now, we will log a warning if it fails.
            }

            const response = await fetch(fetchUrl);
            const data = await response.json();

            // Update Text
            const statusEl = document.getElementById('status-text');
            const cycleEl = document.getElementById('cycle-count');
            const logFeed = document.getElementById('log-feed');
            
            statusEl.innerText = data.status ? data.status.toUpperCase() : "UNKNOWN";
            cycleEl.innerText = data.cycle || "0";
            
            // Metrics
            if(data.metrics) {
                document.getElementById('fitness-val').innerText = data.metrics.fitness || "0.0";
                document.getElementById('complexity-val').innerText = data.metrics.complexity || "0.0";
            }

            // Update Log if changed
            if (data.last_log) {
                // Clear old log for now, or append? Let's just show latest for simplicity first
                logFeed.innerHTML = `<div class="log-entry">> ${data.last_log}</div>`;
            }

            // Highlight Active Component in Mermaid
            // We need to parse the DOM after mermaid renders
            // This is a bit tricky with mermaid's async render, preventing re-render loop
            // Simple approach: map status to ID
            
            // TODO: Implement advanced SVG class manipulation for live highlighting
            
        } catch (e) {
            console.error("Studio OS Link Failed:", e);
            document.getElementById('status-text').innerText = "OFFLINE";
        }
    }

    // Poll every 2 seconds
    setInterval(updateDashboard, 2000);
    updateDashboard();
</script>
