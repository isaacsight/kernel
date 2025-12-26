// content.js - The Observer Layer of Studio OS
console.log("Studio OS: Content Observer Active.");

// 1. Shadow DOM Overlay for a non-intrusive indicator
const mountObserverOverlay = () => {
    const container = document.createElement('div');
    container.id = 'studio-os-root';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '999999';
    container.style.pointerEvents = 'none';

    const shadow = container.attachShadow({ mode: 'open' });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
        <style>
            .crest {
                width: 32px;
                height: 32px;
                background: rgba(0, 0, 0, 0.8);
                border: 1px solid rgba(64, 220, 165, 0.3);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                pointer-events: auto;
                opacity: 0.2;
            }
            .crest:hover {
                opacity: 1;
                transform: scale(1.1);
                border-color: #40DCA5;
            }
            .glow {
                animation: pulse 2s infinite;
            }
            .analyzing {
                animation: rotate 1s linear infinite;
                border-color: #5d5dff !important;
            }
            .alert {
                animation: jitter 0.2s infinite;
                border-color: #ff4444 !important;
                opacity: 1 !important;
            }
            .aligned {
                border-color: #40DCA5 !important;
                background: rgba(64, 220, 165, 0.2);
                opacity: 1 !important;
            }
            .ma {
                animation: slow-pulse 4s infinite;
                border-color: #5da9ff !important;
                background: rgba(93, 169, 255, 0.1);
                opacity: 1 !important;
            }
            .autonomous {
                border-color: #fbc02d !important;
                background: rgba(251, 192, 45, 0.2);
                animation: scan 1.5s infinite, float 3s ease-in-out infinite;
                opacity: 1 !important;
            }
            .crest {
                animation: float 6s ease-in-out infinite;
            }
            @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-5px); }
                100% { transform: translateY(0px); }
            }
            @keyframes scan {
                0% { box-shadow: 0 0 0 0 rgba(251, 192, 45, 0.4); border-width: 1px; }
                50% { box-shadow: 0 0 15px 5px rgba(251, 192, 45, 0.2); border-width: 2px; }
                100% { box-shadow: 0 0 0 0 rgba(251, 192, 45, 0.4); border-width: 1px; }
            }
            .ai-surface {
            @keyframes slow-pulse {
                0% { box-shadow: 0 0 0 0 rgba(93, 169, 255, 0.4); }
                70% { box-shadow: 0 0 0 20px rgba(93, 169, 255, 0); }
                100% { box-shadow: 0 0 0 0 rgba(93, 169, 255, 0); }
            }
            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(64, 220, 165, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(64, 220, 165, 0); }
                100% { box-shadow: 0 0 0 0 rgba(64, 220, 165, 0); }
            }
            @keyframes rotate {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            @keyframes jitter {
                0% { transform: translate(0,0); }
                25% { transform: translate(1px, 1px); }
                50% { transform: translate(-1px, -1px); }
                75% { transform: translate(1px, -1px); }
                100% { transform: translate(0,0); }
            }
            .tooltip {
                position: absolute;
                bottom: 45px;
                right: 0;
                background: #1a1a1a;
                color: #fff;
                padding: 10px 14px;
                border-radius: 8px;
                font-size: 12px;
                white-space: nowrap;
                border: 1px solid #333;
                display: none;
                pointer-events: none;
            }
            .crest:hover .tooltip {
                display: block;
            }
            /* Hover Scanner Styles */
            .studio-hover-target {
                outline: 1px dashed rgba(64, 220, 165, 0.5);
                background: rgba(64, 220, 165, 0.05);
                transition: all 0.2s ease;
                cursor: help; /* Subtle native hint */
            }
        </style>
        <div class="crest" id="studio-crest">
            <span style="font-size: 14px;">🎴</span>
            <div class="tooltip" id="studio-tooltip">Studio OS Observing...</div>
        </div>
        <!-- Scanner Toggle (Hidden by default, activated via Logic) -->
        <div id="scanner-indicator" style="display:none; position:absolute; top:-10px; right:-10px; width:10px; height:10px; background:#40DCA5; border-radius:50%; box-shadow: 0 0 10px #40DCA5;"></div>
    `;
    shadow.appendChild(wrapper);
    document.body.appendChild(container);

    const crest = shadow.getElementById('studio-crest');
    crest.addEventListener('click', () => {
        // Toggle Scanner Mode on Click
        toggleScannerMode();
    });

    // Create Satellite Cursor (The "Extension" to the pointer)
    const satellite = document.createElement('div');
    satellite.id = 'studio-cursor-satellite';
    satellite.style.cssText = `
        position: fixed; 
        top: 0; 
        left: 0; 
        width: 24px; 
        height: 24px; 
        pointer-events: none; 
        z-index: 2147483647; 
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.08s ease-out;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'><path d='M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10L12 2Z' stroke='%2340DCA5' stroke-width='1.5' fill='rgba(64, 220, 165, 0.2)'/><circle cx='12' cy='12' r='2' fill='%2340DCA5'/></svg>");
        background-size: contain;
    `;
    document.body.appendChild(satellite);
    console.log("Studio OS: Satellite Cursor Injected");
};

// 2. Intelligence Gathering & Deep Extraction
const scrubPII = (text) => {
    // Regex for emails and phone numbers
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /(\+?\d{1,2}\s?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/g;
    return text.replace(emailRegex, "[EMAIL_REDACTED]").replace(phoneRegex, "[PHONE_REDACTED]");
};

const extractMainContent = () => {
    // Basic heuristic for article body extraction
    const selectors = ['article', '.post-content', '.entry-content', '#content', 'main'];
    let content = "";
    for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.length > 500) {
            content = el.innerText.slice(0, 5000); // Caps at 5k chars for token efficiency
            break;
        }
    }

    if (!content) {
        // Fallback: Body text but skip common junk
        content = document.body.innerText.slice(0, 3000);
    }

    return scrubPII(content);
};

const analyzePage = () => {
    const metadata = {
        title: document.title,
        url: window.location.href,
        description: document.querySelector('meta[name="description"]')?.content || "",
        h1: document.querySelector('h1')?.textContent || "",
        wordCount: document.body.innerText.split(/\s+/).length,
        bodyText: extractMainContent(),
        timestamp: Date.now()
    };

    // Send context to background for Sovereign analysis
    chrome.runtime.sendMessage({
        action: "heartbeat_context",
        data: metadata
    });
};

// 3. Heuristic Moment Detection & Cognitive Load Inference
let inputBuffer = 0;
let lastScrollPos = window.scrollY;
let scrollJitterCount = 0;
let lastScrollTime = Date.now();
let maxScrollDepth = 0;
let interactionCounts = { copy: 0, paste: 0, tabVis: 0 };

document.addEventListener('copy', () => {
    interactionCounts.copy++;
    chrome.runtime.sendMessage({ action: "browser_interaction", type: "learning_signal", detail: { event: "content_export", count: interactionCounts.copy } });
});

document.addEventListener('paste', () => {
    interactionCounts.paste++;
    chrome.runtime.sendMessage({ action: "browser_interaction", type: "learning_signal", detail: { event: "content_import", count: interactionCounts.paste } });
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        interactionCounts.tabVis++;
        chrome.runtime.sendMessage({ action: "browser_interaction", type: "learning_signal", detail: { event: "focus_return", count: interactionCounts.tabVis } });
    }
});

document.addEventListener('input', (e) => {
    inputBuffer++;
    if (inputBuffer > 100) {
        chrome.runtime.sendMessage({
            action: "intent_detected",
            intent: "focused_writing",
            context: { length: inputBuffer }
        });
        inputBuffer = 0;
    }
});

// Scroll Depth and Jitter Tracking
window.addEventListener('scroll', () => {
    const currentPos = window.scrollY;
    const now = Date.now();

    // Update Depth
    const windowHeight = window.innerHeight;
    const fullHeight = document.documentElement.scrollHeight;
    const depth = Math.round(((currentPos + windowHeight) / fullHeight) * 100);
    if (depth > maxScrollDepth) maxScrollDepth = depth;

    // Detect Jitter (Rapid back-and-forth)
    const diff = Math.abs(currentPos - lastScrollPos);
    const timeDiff = now - lastScrollTime;

    if (diff > 50 && timeDiff < 100) {
        scrollJitterCount++;
        if (scrollJitterCount > 10) {
            chrome.runtime.sendMessage({
                action: "intent_detected",
                intent: "cognitive_drift",
                context: { jitter: scrollJitterCount, url: window.location.href }
            });
            scrollJitterCount = 0;
        }
    } else if (timeDiff > 500) {
        scrollJitterCount = 0; // Reset on slow scroll
    }

    lastScrollPos = currentPos;
    lastScrollTime = now;
});

// Report Depth on Unload
const startTime = Date.now();
window.addEventListener('beforeunload', () => {
    const timeSpent = Date.now() - startTime;
    // Only report depth if the user spent more than 5 seconds (avoid bounces)
    if (timeSpent > 5000) {
        chrome.runtime.sendMessage({
            action: "browser_interaction",
            type: "reading_depth",
            detail: {
                url: window.location.href,
                depth: maxScrollDepth,
                time_spent_ms: timeSpent
            }
        });
    }
});

// 4. Autonomous Entity Enrichment
const highlightEntities = () => {
    // Keywords that trigger the Librarian or WebScout
    const keywords = ['Active Inference', 'Free Energy Principle', 'Titan DB', 'Sovereignty', 'Metacognition', 'Studio OS'];
    const body = document.body;

    // Simple walker to find text nodes and wrap keywords (non-destructive)
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const nodesToReplace = [];

    while (node = walker.nextNode()) {
        const text = node.nodeValue;
        for (const kw of keywords) {
            if (text.includes(kw)) {
                nodesToReplace.push({ node, kw });
            }
        }
    }

    nodesToReplace.forEach(({ node, kw }) => {
        if (!node.parentNode || node.parentNode.className === 'studio-entity') return;
        const span = document.createElement('span');
        span.className = 'studio-entity';
        span.style.borderBottom = '1px dashed #40DCA5';
        span.style.cursor = 'help';
        span.dataset.entity = kw;

        const parts = node.nodeValue.split(kw);
        span.innerHTML = kw;

        const fragment = document.createDocumentFragment();
        fragment.appendChild(document.createTextNode(parts[0]));
        fragment.appendChild(span);
        fragment.appendChild(document.createTextNode(parts.slice(1).join(kw)));

        node.parentNode.replaceChild(fragment, node);

        span.onclick = (e) => {
            e.stopPropagation();
            showInsightOverlay(kw, e.pageX, e.pageY);
        };
    });
};

const showInsightOverlay = async (entity, x, y) => {
    let overlay = document.getElementById('studio-insight-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'studio-insight-overlay';
        overlay.style.position = 'absolute';
        overlay.style.background = '#1a1a1a';
        overlay.style.color = '#fff';
        overlay.style.padding = '16px';
        overlay.style.borderRadius = '8px';
        overlay.style.border = '1px solid #40DCA5';
        overlay.style.zIndex = '1000000';
        overlay.style.width = '240px';
        overlay.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
        overlay.style.fontSize = '12px';
        document.body.appendChild(overlay);
    }

    overlay.style.left = `${x}px`;
    overlay.style.top = `${y + 20}px`;
    overlay.innerHTML = `<em>Consulting the Librarian for "${entity}"...</em>`;
    overlay.style.display = 'block';

    // Request enrichment from backend
    chrome.runtime.sendMessage({
        action: "enrich_entity",
        entity: entity
    }, (response) => {
        if (response && response.insight) {
            overlay.innerHTML = `
                <div style="color: #40DCA5; font-weight: bold; margin-bottom: 8px;">AGENTIC INSIGHT</div>
                <div>${response.insight}</div>
                <div style="margin-top: 10px; font-size: 10px; color: #777;">Source: ${response.source || 'Librarian'}</div>
                <div style="margin-top: 12px; display: flex; gap: 8px;">
                    <button class="insight-btn" onclick="triggerAction('research', '${entity}')" style="background: transparent; border: 1px solid #40DCA5; color: #40DCA5; font-size: 10px; padding: 4px 8px; cursor: pointer; border-radius: 4px;">DEEP RESEARCH</button>
                    <button class="insight-btn" onclick="triggerAction('capture', '${entity}')" style="background: transparent; border: 1px solid #777; color: #777; font-size: 10px; padding: 4px 8px; cursor: pointer; border-radius: 4px;">LOG MEMORY</button>
                </div>
            `;

            // Globally define triggerAction for these inline buttons
            window.triggerAction = (action, kw) => {
                chrome.runtime.sendMessage({ action: "browser_interaction", type: action, detail: kw });
                overlay.style.display = 'none';
            };
        } else {
            overlay.innerHTML = `<em>No internal records found. Initiating WebScout task...</em>`;
        }
    });

    // Close on click elsewhere
    const closeOverlay = () => {
        overlay.style.display = 'none';
        document.removeEventListener('click', closeOverlay);
    };
    setTimeout(() => document.addEventListener('click', closeOverlay), 100);
};

// 5. AI Awareness (Gemini 3 Integration)
const detectAISurface = () => {
    const isGemini = window.location.host === 'gemini.google.com';
    const isSearch = window.location.host.includes('google.com') && window.location.pathname.includes('/search');

    if (isGemini || isSearch) {
        const root = document.getElementById('studio-os-root');
        if (!root) return;
        const crest = root.shadowRoot.getElementById('studio-crest');
        crest.classList.add('ai-surface');

        if (isGemini) {
            // Watch for Gemini's response areas
            const observer = new MutationObserver((mutations) => {
                const lastResponse = document.querySelector('.model-response-text');
                if (lastResponse && lastResponse.innerText.length > 50) {
                    chrome.runtime.sendMessage({
                        action: "gemini_sync",
                        prompt: "User Interaction on Gemini Surface",
                        response: lastResponse.innerText.slice(0, 500)
                    });
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        } else if (isSearch) {
            // Detect specialized search parameters (like udm=50 for deep search)
            const urlParams = new URLSearchParams(window.location.search);
            const isDeepSearch = urlParams.get('udm') === '50';

            if (isDeepSearch) {
                const tooltip = root.shadowRoot.getElementById('studio-tooltip');
                tooltip.textContent = "Deep Research Mode Active";
                crest.classList.add('autonomous');

                // Extract top result titles and URLs for context
                const results = Array.from(document.querySelectorAll('h3')).map(h => h.innerText).slice(0, 5);
                chrome.runtime.sendMessage({
                    action: "intent_detected",
                    intent: "deep_search_analysis",
                    context: {
                        results: results,
                        query: urlParams.get('q'),
                        mode: 'udm_50'
                    }
                });
            }
        }
    }
};

// Initialization
if (document.readyState === 'complete') {
    mountObserverOverlay();
    analyzePage();
    detectAISurface();
    setTimeout(highlightEntities, 2000); // Give page a moment to settle
} else {
    window.addEventListener('load', () => {
        mountObserverOverlay();
        analyzePage();
        detectAISurface();
        setTimeout(highlightEntities, 2000);
        updateScannerUI(); // Initialize scanner UI state
    });
}

// 6. Hover Scanner (Agentic Cursor)
let scannerActive = true; // Enabled by default per user request
let hoverTimer = null;
let currentHoverTarget = null;
const HOVER_DWELL_MS = 1000; // 1 second dwell directly triggers insight

const toggleScannerMode = () => {
    scannerActive = !scannerActive;
    updateScannerUI();
};

const updateScannerUI = () => {
    const root = document.getElementById('studio-os-root');
    const indicator = root.shadowRoot.getElementById('scanner-indicator');
    const tooltip = root.shadowRoot.getElementById('studio-tooltip');

    // The Satellite
    const satellite = document.getElementById('studio-cursor-satellite');

    if (scannerActive) {
        if (satellite) satellite.style.opacity = '1';
        // document.body.classList.add('studio-scan-cursor'); // Removed for satellite mode
        indicator.style.display = 'block';
        tooltip.textContent = "Scanner Mode: ACTIVE";
        console.log("Scanner Mode: Enabled");
        chrome.runtime.sendMessage({ action: "signal_alert", state: "autonomous", message: "Hover Scanner Enabled" });
    } else {
        if (satellite) satellite.style.opacity = '0';
        // document.body.classList.remove('studio-scan-cursor');
        indicator.style.display = 'none';
        tooltip.textContent = "Scanner Mode: Standby";
        console.log("Scanner Mode: Disabled");
        if (currentHoverTarget) {
            currentHoverTarget.classList.remove('studio-hover-target');
            currentHoverTarget = null;
        }
    }
};

document.body.addEventListener('mousemove', (e) => {
    if (scannerActive) {
        const satellite = document.getElementById('studio-cursor-satellite');
        if (satellite) {
            // Offset by 16px to follow the cursor (Extension style)
            satellite.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 16}px)`;
        }
    }
});

document.body.addEventListener('mouseover', (e) => {
    if (!scannerActive) return;

    // Filter relevant elements (Text-heavy or Links)
    const target = e.target;
    // console.log("Hovering:", target.tagName); // Log tag for debugging

    // Ignore small structural elements or self
    if (target.id === 'studio-os-root' || target.closest('#studio-os-root') || target.closest('#studio-insight-overlay')) return;

    const validTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'LI', 'SPAN', 'BLOCKQUOTE', 'STRONG', 'EM'];

    if (validTags.includes(target.tagName) && target.innerText.trim().length > 3) {
        // Highlight
        if (currentHoverTarget && currentHoverTarget !== target) {
            currentHoverTarget.classList.remove('studio-hover-target');
        }
        currentHoverTarget = target;
        target.classList.add('studio-hover-target');

        // Start Dwell Timer
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
            if (currentHoverTarget === target) {
                // Trigger Insight!
                console.log("Dwell Triggered on:", target);
                const text = target.innerText.slice(0, 150).trim(); // Short snippet as entity hint
                // If it looks like a distinct entity (short), use it. If long, use "Context Analysis"
                const entity = text.length < 60 ? text : "Context Analysis";

                showInsightOverlay(entity, e.pageX, e.pageY);

                // Visual feedback
                target.classList.remove('studio-hover-target');
            }
        }, HOVER_DWELL_MS);
    }
});

document.body.addEventListener('mouseout', (e) => {
    if (!scannerActive) return;
    if (e.target === currentHoverTarget) {
        e.target.classList.remove('studio-hover-target');
        clearTimeout(hoverTimer);
        currentHoverTarget = null;
    }
});

// Listener for signals FROM background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const crest = document.getElementById('studio-os-root').shadowRoot.getElementById('studio-crest');
    const tooltip = document.getElementById('studio-os-root').shadowRoot.getElementById('studio-tooltip');

    if (msg.action === "signal_alert") {
        crest.className = 'crest'; // Reset

        if (msg.state) {
            crest.classList.add(msg.state);
        } else {
            crest.classList.add('glow');
        }

        crest.style.opacity = '1';
        tooltip.textContent = msg.message;

        if (msg.state === 'ma') {
            showMaOverlay(msg.message);
        } else if (msg.state === 'autonomous') {
            // Keep it active longer for autonomous tasks
            return;
        }

        // Reset after 15 seconds
        setTimeout(() => {
            crest.className = 'crest';
            crest.style.opacity = '0.2';
            tooltip.textContent = 'Studio OS Observing...';
        }, 15000);
    } else if (msg.action === "update_focus_display") {
        tooltip.textContent = `Focus: ${msg.focus}`;
        crest.classList.add('aligned');
        applyMissionFocus(msg.focus); // Re-apply on focus change
        setTimeout(() => {
            crest.classList.remove('aligned');
            tooltip.textContent = 'Studio OS Observing...';
        }, 5000);
    } else if (msg.action === "feel_nudge") {
        crest.classList.add('alert');
        tooltip.textContent = "Does this still feel right? (Click to Log)";
        crest.onclick = () => {
            chrome.runtime.sendMessage({
                action: "browser_interaction",
                type: "capture",
                detail: `Alignment Confirmed: ${document.title}`
            });
            crest.classList.remove('alert');
            tooltip.textContent = "Alignment Logged.";
        };
    }
});

const applyMissionFocus = (focus) => {
    if (!focus) return;

    const distractions = ['youtube.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'reddit.com', 'netflix.com'];
    const currentHost = window.location.host;
    const isDistraction = distractions.some(d => currentHost.includes(d));

    // If we have a serious mission and we're on a distraction site
    const seriousKeywords = ['code', 'research', 'write', 'build', 'engineer', 'study', 'focus'];
    const isSeriousMission = seriousKeywords.some(k => focus.toLowerCase().includes(k));

    if (isSeriousMission && isDistraction) {
        console.log("Sovereign: Distraction Detected. Applying alignment nudge.");
        const root = document.getElementById('studio-os-root');
        const tooltip = root.shadowRoot.getElementById('studio-tooltip');
        tooltip.textContent = `Mission Logic: Divergent to ${focus}`;

        // Apply a subtle "Sovereign Dimming"
        document.body.style.filter = 'grayscale(0.6) brightness(0.9)';
        document.body.style.transition = 'filter 2s ease';

        // Add a floating reminder
        const reminder = document.createElement('div');
        reminder.id = 'studio-focus-reminder';
        reminder.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 4px;
            background: #f59e0b; z-index: 1000002; opacity: 0.8;
        `;
        document.body.appendChild(reminder);
    } else {
        document.body.style.filter = '';
        const reminder = document.getElementById('studio-focus-reminder');
        if (reminder) reminder.remove();
    }
};

const showMaOverlay = (message) => {
    let maOverlay = document.getElementById('studio-ma-overlay');
    if (!maOverlay) {
        maOverlay = document.createElement('div');
        maOverlay.id = 'studio-ma-overlay';
        maOverlay.style.position = 'fixed';
        maOverlay.style.top = '0';
        maOverlay.style.left = '0';
        maOverlay.style.width = '100vw';
        maOverlay.style.height = '100vh';
        maOverlay.style.background = 'rgba(0, 10, 30, 0.85)';
        maOverlay.style.backdropFilter = 'blur(10px)';
        maOverlay.style.zIndex = '1000001';
        maOverlay.style.display = 'flex';
        maOverlay.style.flexDirection = 'column';
        maOverlay.style.alignItems = 'center';
        maOverlay.style.justifyContent = 'center';
        maOverlay.style.color = '#5da9ff';
        maOverlay.style.fontFamily = 'monospace';
        document.body.appendChild(maOverlay);
    }

    maOverlay.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 24px;">間</div>
        <div style="font-size: 24px; letter-spacing: 4px;">MA PROTOCOL ACTIVE</div>
        <div style="margin-top: 20px; font-size: 14px; opacity: 0.8; text-align: center; max-width: 400px;">
            ${message}<br><br>
            Cognitive Drift is high. Take a breath. Clear your tabs. Aligned intentions yield higher results.
        </div>
        <div style="margin-top: 40px; border: 1px solid #5da9ff; padding: 10px 20px; cursor: pointer; border-radius: 4px;" onclick="this.parentElement.style.display='none'">RESUME WITH CLARITY</div>
    `;
    maOverlay.style.display = 'flex';
};
