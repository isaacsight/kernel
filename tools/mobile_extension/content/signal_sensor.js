// Signal Sensor (Content Script)
// Detects patterns and errors to feed into the Decision Copilot.

function detectSignals() {
    // 1. Detect 404 or Error pages based on common indicators
    const isErrorPage = document.title.includes("404") ||
        document.title.toLowerCase().includes("not found") ||
        document.body.innerText.includes("error 404");

    if (isErrorPage) {
        chrome.runtime.sendMessage({
            type: "INGEST_SIGNAL",
            data: {
                type: "error_404",
                url: window.location.href,
                context: {
                    title: document.title
                }
            }
        });
    }

    // 2. Future: Detect specific patterns (e.g. expensive items in shopping cart, research topics)
}

// Run once on load
detectSignals();

// Also watch for history changes (SPA)
window.addEventListener('popstate', detectSignals);
