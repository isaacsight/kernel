// background.js - Studio OS Extension (Autonomous Upgrade)

const setupContextMenus = () => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "send-to-studio",
            title: "Send to Studio OS",
            contexts: ["selection", "page"]
        }, () => {
            if (chrome.runtime.lastError) {
                console.log("Context menu suppressed: Item already exists.");
            }
        });
    });
};

chrome.runtime.onInstalled.addListener(() => {
    setupContextMenus();
    console.log("Studio Extension 1.5: Autonomous Agent Layer Active.");
    initWebSocket();
});

let ws = null;
function initWebSocket() {
    ws = new WebSocket('ws://localhost:8000/v1/ws_signals');

    ws.onopen = () => console.log("Sovereign Bridge Established (WS)");

    ws.onmessage = async (event) => {
        try {
            const signal = JSON.parse(event.data);
            console.log("Live Agent Signal Received:", signal);

            if (signal.action === "execute_command") {
                handleAutonomousCommand(signal.command);
                return;
            }

            // Forward to active tab for UI nudge
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "signal_alert",
                        ...signal
                    });
                }
            });
        } catch (e) {
            console.error("WS Message Error:", e);
        }
    };

    ws.onclose = () => {
        console.warn("Sovereign Bridge Lost. Reconnecting in 5s...");
        setTimeout(initWebSocket, 5000);
    };
}

async function handleAutonomousCommand(command) {
    console.log("Autonomous Bridge: Executing", command.type);

    try {
        switch (command.type) {
            case 'navigate':
                chrome.tabs.update({ url: command.url });
                break;
            case 'open_tab':
                chrome.tabs.create({ url: command.url, active: command.active !== false });
                break;
            case 'scroll':
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (direction) => window.scrollBy(0, direction === 'down' ? 500 : -500),
                    args: [command.direction || 'down']
                });
                break;
            case 'extract':
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const results = await chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    func: () => document.body.innerText.slice(0, 5000)
                });
                // Send back to Sovereign via ingest
                sendToSovereign({
                    url: activeTab.url,
                    extraction: results[0].result,
                    context: "autonomous_extraction"
                });
                break;
        }
    } catch (e) {
        console.error("Autonomous command failed:", e);
    }
}

// 1. Intelligent Omnibox Support (dtfr <query>)
chrome.omnibox.onInputEntered.addListener(async (text) => {
    if (text.startsWith('focus:')) {
        const topic = text.replace('focus:', '').trim();
        updateFocus(topic);
        return;
    }

    if (text.startsWith('research:')) {
        const topic = text.replace('research:', '').trim();
        runDeepResearch(topic);
        return;
    }

    if (text === 'status') {
        checkStatus();
        return;
    }

    // Fallback: Site Search
    const query = encodeURIComponent(text);
    const url = `http://localhost:8000/recommendation-engine.html?q=${query}`;
    chrome.tabs.create({ url });
});

async function runDeepResearch(topic) {
    console.log("Sovereign: Initiating Deep Research for", topic);
    const payload = {
        user_id: 'anon_abc123',
        event_type: 'research_request',
        pattern_hint: 'strategic_planning',
        context: {
            topic: topic,
            source: 'omnibox_research'
        },
        timestamp_ms: Date.now()
    };

    try {
        await fetch('http://localhost:8000/v1/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        chrome.tabs.create({ url: 'http://localhost:8000/v1/snapshot?user_id=anon_abc123' });
    } catch (e) {
        console.error("Research failed:", e);
    }
}

async function updateFocus(topic) {
    console.log("Sovereign: Updating Focus to", topic);
    try {
        const resp = await fetch('http://localhost:8000/api/browser/focus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ focus: topic, user_id: 'anon_abc123' })
        });

        if (resp.ok) {
            // Notify all tabs to update their display
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: "update_focus_display", focus: topic });
                });
            });
            return { status: "success" };
        }
    } catch (e) {
        console.error("Focus update failed:", e);
    }
    return { status: "error" };
}

async function checkStatus() {
    chrome.tabs.create({ url: 'http://localhost:8000/studio-snapshot.html' });
}

// 2. Message Listener (from content.js)
async function handleIntent(intent, context) {
    console.log(`Intent Detected: ${intent}`, context);
    if (intent === 'cognitive_drift') {
        const payload = {
            user_id: 'anon_abc123',
            event_type: 'cognitive_load_update',
            pattern_hint: 'felt_wrong',
            context: {
                reason: 'High scroll jitter detected',
                ...context,
                source: 'behavioral_observer'
            }
        };
        try {
            await fetch('http://localhost:8000/v1/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // If the jitter is really high, trigger the MA overlay immediately
            if (context.jitter > 20) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: "signal_alert",
                            state: "ma",
                            message: "System detects high cognitive load. Practice MA (間)."
                        });
                    }
                });
            }
        } catch (e) {
            console.error("Cognitive log failed.");
        }
    }
}

let lastIngest = 0;
async function sendToSovereign(data) {
    // Throttled heartbeat to avoid spamming
    if (Date.now() - lastIngest < 30000) return;
    lastIngest = Date.now();

    console.log("Forwarding context to Sovereign:", data.url);
    try {
        await fetch('http://localhost:8000/v1/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: 'anon_abc123',
                event_type: 'browser_context',
                context: data
            })
        });
    } catch (e) {
        console.error("Sovereign connection lost.");
    }
}

async function enrichEntity(entity) {
    console.log("Autonomous Agency: Enriching", entity);
    try {
        const resp = await fetch('http://localhost:8000/api/browser/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: 'anon_abc123',
                entity: entity
            })
        });
        if (resp.ok) {
            return await resp.json();
        }
    } catch (e) {
        console.error("Enrichment failed:", e);
    }
    return { insight: "Sovereign bridge offline. Unable to fetch deep context.", source: "System" };
}

async function syncGemini(data) {
    console.log("Gemini Sync Active: Auditing reasoning...");
    try {
        const resp = await fetch('http://localhost:8000/api/browser/gemini_sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await resp.json();

        // Notify tab that the Sovereign has synced the reasoning
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "signal_alert",
                    state: "aligned",
                    message: "Gemini Sync'd: " + (result.sovereign_opinion || "Logic Aligned.")
                });
            }
        });
        return result;
    } catch (e) {
        console.error("Gemini sync failed:", e);
    }
}

async function handleBrowserInteraction(type, detail) {
    console.log(`Librarian Action: ${type} for ${detail}`);
    if (type === 'research') {
        runDeepResearch(detail);
    } else if (type === 'reading_depth') {
        console.log(`Knowledge Indexed: User read ${detail.depth}% of ${detail.url}`);
        sendToSovereign({
            event_type: 'reading_depth',
            url: detail.url,
            depth: detail.depth,
            source: 'content_observer'
        });
    } else if (type === 'learning_signal') {
        addToLearningPackage(detail);
    } else if (type === 'capture') {
        const payload = {
            user_id: 'anon_abc123',
            event_type: 'decision',
            pattern_hint: 'knowledge_indexed',
            context: {
                note: `User confirmed knowledge node: ${detail}`,
                entity: detail,
                source: 'librarian_card'
            }
        };
        try {
            await fetch('http://localhost:8000/v1/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error("Knowledge capture failed.");
        }
    }
}

// 3. Context Menu Handling
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "send-to-studio") {
        const note = info.selectionText || "Captured via context menu";
        const payload = {
            user_id: 'anon_abc123',
            event_type: 'decision',
            pattern_hint: 'felt_wrong',
            context: {
                url: info.pageUrl || tab.url,
                title: tab.title,
                note: note,
                source: 'chrome_context_menu'
            },
            timestamp_ms: Date.now()
        };

        try {
            await fetch('http://localhost:8000/v1/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error("Ingest error:", e);
        }
    }
});

// 4. Self-Healing Navigation
chrome.webNavigation.onErrorOccurred.addListener((details) => {
    if (details.frameId !== 0) return;
    checkForOptimization(details.tabId, details.url);
});

async function checkForOptimization(tabId, url) {
    if (url.includes('/docs/posts/')) {
        const healedUrl = url.replace('/docs/posts/', '/docs/');
        const payload = {
            user_id: 'anon_abc123',
            event_type: 'optimization_suggested',
            pattern_hint: 'moved_resource',
            context: {
                original_url: url,
                suggested_url: healedUrl,
                reason: 'Legacy posts/ directory moved to top-level docs/',
                source: 'self_healing_nav'
            }
        };

        try {
            await fetch('http://localhost:8000/v1/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error("Optimization ingest failed.");
        }
    }
}
// 5. Self-Optimization Loop (The Study Loop)
let learningPackage = {
    events: [],
    startTime: Date.now()
};

function addToLearningPackage(signal) {
    learningPackage.events.push({
        ...signal,
        timestamp: Date.now()
    });

    // Send every 10 signals or 5 minutes
    if (learningPackage.events.length >= 10 || (Date.now() - learningPackage.startTime > 300000)) {
        sendLearningPackage();
    }
}

async function sendLearningPackage() {
    if (learningPackage.events.length === 0) return;

    console.log("Sovereign: Sending Self-Improvement Audit...");
    const payload = {
        user_id: 'anon_abc123',
        event_type: 'self_improvement_audit',
        context: {
            session_duration: Date.now() - learningPackage.startTime,
            signals: learningPackage.events,
            purpose: "Autonomous heuristic refinement"
        }
    };

    try {
        await fetch('http://localhost:8000/v1/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        // Clear buffer
        learningPackage = { events: [], startTime: Date.now() };
    } catch (e) {
        console.warn("Learning loop failed to sync.");
    }
}
