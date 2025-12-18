// background.js - Studio OS Extension

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "send-to-studio",
        title: "Send to Studio OS",
        contexts: ["selection", "page"]
    });
    console.log("Studio Extension Installed: Context Menu and Omnibox registered.");
});

// 1. Intelligent Omnibox Support (dtfr <query>)
chrome.omnibox.onInputEntered.addListener(async (text) => {
    if (text.startsWith('focus:')) {
        const topic = text.replace('focus:', '').trim();
        updateFocus(topic);
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

async function updateFocus(topic) {
    // Update Studio Focus via Ingest as a 'meta' event
    const payload = {
        user_id: 'anon_abc123',
        event_type: 'meta_update',
        pattern_hint: 'intelligence_update',
        context: {
            action: 'update_focus',
            value: topic,
            source: 'omnibox'
        },
        timestamp_ms: Date.now()
    };

    try {
        await fetch('http://localhost:8000/v1/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        // Create a tab to show success or just a notification
        chrome.tabs.create({ url: 'http://localhost:8000/studio-snapshot.html' });
    } catch (e) {
        console.error("Focus update failed:", e);
    }
}

async function checkStatus() {
    chrome.tabs.create({ url: 'http://localhost:8000/studio-snapshot.html' });
}

// 2. Context Menu Handling
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
            const resp = await fetch('http://localhost:8000/v1/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                console.log("Signal ingested successfully from context menu.");
            } else {
                console.error("Failed to ingest signal:", await resp.text());
            }
        } catch (e) {
            console.error("Ingest error:", e);
        }
    }
});

// 3. Self-Healing Navigation (Optimization)
chrome.webNavigation.onErrorOccurred.addListener((details) => {
    if (details.frameId !== 0) return;
    checkForOptimization(details.tabId, details.url);
});

// Also check on completed tabs in case it's a "soft" error or chrome-error page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('chrome-error')) {
        // We might lose the original URL here, but let's see if we can deduce it from title or history
        // For now, onErrorOccurred is better for capturing the intended URL.
        console.log("Tab updated to error page:", tab.url);
    }
});

async function checkForOptimization(tabId, url) {
    console.log("Checking for optimization:", url);

    // Pattern: /docs/posts/filename.html -> /docs/filename.html
    if (url.includes('/docs/posts/')) {
        const healedUrl = url.replace('/docs/posts/', '/docs/');
        console.log("Detected broken legacy path. Suggested heal:", healedUrl);

        // Ingest as an optimization decision
        const payload = {
            user_id: 'anon_abc123',
            event_type: 'optimization_suggested',
            pattern_hint: 'moved_resource',
            context: {
                original_url: url,
                suggested_url: healedUrl,
                reason: 'Legacy posts/ directory moved to top-level docs/',
                source: 'self_healing_nav'
            },
            timestamp_ms: Date.now()
        };

        try {
            await fetch('http://localhost:8000/v1/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            // We could also show a notification here
            console.log("Optimization signal ingested.");
        } catch (e) {
            console.error("Failed to ingest optimization signal:", e);
        }
    }
}

