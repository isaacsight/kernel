// Studio OS Mobile Background Script
// Handles event-driven lifecycle of the iOS Safari extension.

chrome.runtime.onInstalled.addListener(() => {
    console.log("Studio OS Copilot Mobile Installed");
});

// Listener for signals from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "INGEST_SIGNAL") {
        handleSignal(message.data);
    }
    return true;
});

async function handleSignal(data) {
    // Collect signals in local storage for batching or immediate transmission
    const { signals = [] } = await chrome.storage.local.get("signals");
    signals.push({
        ...data,
        timestamp: new Date().toISOString()
    });

    // Attempt to sync if the queue is growing
    if (signals.length >= 1) {
        syncSignals(signals);
    } else {
        await chrome.storage.local.set({ signals });
    }
}

async function syncSignals(signals) {
    try {
        // This would point to the user's local Studio OS instance
        const response = await fetch("http://localhost:8000/v1/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                source: "mobile-extension",
                batch: signals
            })
        });

        if (response.ok) {
            await chrome.storage.local.set({ signals: [] });
            console.log("Signals synced successfully");
        }
    } catch (err) {
        console.error("Sync failed, keeping signals in local storage", err);
        await chrome.storage.local.set({ signals });
    }
}
