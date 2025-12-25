// popup.js - Studio OS Extension (Autonomous Upgrade)

const SERVER_URL = 'http://localhost:8000';
const USER_ID = 'anon_abc123';

document.addEventListener('DOMContentLoaded', async () => {
    checkConnection();
    loadSnapshot();
    loadAgentPresence();
    setInterval(loadAgentPresence, 10000); // Refresh every 10s

    // Bind Research Button
    document.getElementById('btn_research').onclick = async () => {
        const topic = document.getElementById('research_topic').value;
        if (!topic) return;

        const statusDiv = document.getElementById('status');
        statusDiv.textContent = 'Initiating Research...';

        try {
            const resp = await fetch(`${SERVER_URL}/v1/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: USER_ID,
                    event_type: 'research_request',
                    pattern_hint: 'strategic_planning',
                    context: { topic: topic, source: 'extension_popup' }
                })
            });
            if (resp.ok) {
                statusDiv.textContent = 'Research Logged.';
                document.getElementById('research_topic').value = '';
            } else {
                statusDiv.textContent = 'Research failed.';
            }
        } catch (e) {
            statusDiv.textContent = 'Brain offline.';
        }
    };

    // Bind Audit Button
    document.getElementById('btn_audit').onclick = async () => {
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = 'Contacting The Sovereign...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const resp = await fetch(`${SERVER_URL}/api/browser/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: USER_ID,
                    context: {
                        url: tab.url,
                        title: tab.title,
                        source: 'extension_audit'
                    }
                })
            });
            const data = await resp.json();
            if (data.directive) {
                statusDiv.textContent = 'Sovereign Directive Received.';
                alert("Sovereign Directive:\n\n" + data.directive);
            }
        } catch (e) {
            statusDiv.textContent = 'Audit failed.';
        }
    };

    // Bind Focus Button
    document.getElementById('btn_update_focus').onclick = async () => {
        const focus = document.getElementById('focus_input').value;
        if (!focus) return;

        const statusDiv = document.getElementById('status');
        statusDiv.textContent = 'Syncing Focus...';

        chrome.runtime.sendMessage({ action: "update_focus", focus: focus }, (response) => {
            if (response && response.status === 'success') {
                statusDiv.textContent = 'Focus Realigned.';
                document.getElementById('focus_input').value = '';
            } else {
                statusDiv.textContent = 'Focus sync failed.';
            }
        });
    };

    // Bind Ingest Button
    document.getElementById('capture').onclick = async () => {
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = 'Syncing Signal...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const pattern = document.getElementById('pattern').value;
            const note = document.getElementById('note').value;

            const resp = await fetch(`${SERVER_URL}/v1/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: USER_ID,
                    event_type: 'decision',
                    pattern_hint: pattern,
                    context: {
                        url: tab.url,
                        title: tab.title,
                        note: note,
                        source: 'chrome_extension'
                    }
                })
            });

            if (resp.ok) {
                statusDiv.textContent = 'Signal Ingested.';
                document.getElementById('note').value = '';
                setTimeout(loadSnapshot, 1000);
            } else {
                statusDiv.textContent = 'Sync failed.';
            }
        } catch (e) {
            statusDiv.textContent = 'Error: ' + e.message;
        }
    };
});

async function checkConnection() {
    const orb = document.getElementById('connection_orb');
    try {
        const resp = await fetch(`${SERVER_URL}/v1/snapshot?user_id=${USER_ID}`);
        if (resp.ok) {
            orb.classList.remove('offline');
        } else {
            orb.classList.add('offline');
        }
    } catch (e) {
        orb.classList.add('offline');
    }
}

async function loadSnapshot() {
    const snapDiv = document.getElementById('snapshot');
    const alignSection = document.getElementById('alignment_section');
    try {
        const resp = await fetch(`${SERVER_URL}/v1/snapshot?user_id=${USER_ID}`);
        if (resp.ok) {
            const data = await resp.json();
            if (data.decisions && data.decisions.length > 0) {
                alignSection.style.display = 'block';
                renderSnapshot(data);
            } else {
                alignSection.style.display = 'none';
            }
        }
    } catch (e) {
        console.warn("Snapshot sync failed.");
    }
}

function renderSnapshot(data) {
    const snapDiv = document.getElementById('snapshot');
    snapDiv.innerHTML = data.decisions.slice(0, 2).map(d => `
        <div class="decision-card" id="node-${d.entry_id}">
            <span class="decision-question">${d.question}</span>
            <div class="btn-group">
                <button onclick="review('${d.entry_id}', 'yes')">YES</button>
                <button onclick="review('${d.entry_id}', 'no')" style="background: var(--error); color: white;">NO</button>
                <button class="btn-secondary" onclick="review('${d.entry_id}', 'defer')">DEFER</button>
            </div>
        </div>
    `).join('');
}

async function loadAgentPresence() {
    const presenceDiv = document.getElementById('agent_presence');
    try {
        const resp = await fetch(`${SERVER_URL}/agents/presence`);
        if (resp.ok) {
            const data = await resp.json();
            const agents = data.agents || [];
            presenceDiv.innerHTML = agents.map(a => `
                <div class="activity-item">
                    <b style="color: ${a.status === 'Ready' ? 'var(--accent)' : 'var(--orange)'};">•</b> 
                    <b>${a.name}</b>: ${a.status}
                </div>
            `).join('');
        }
    } catch (e) {
        presenceDiv.innerHTML = '<div class="activity-item"><em>Sovereign Node Offline</em></div>';
    }
}

window.review = async (entryId, action) => {
    try {
        const resp = await fetch(`${SERVER_URL}/v1/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry_id: entryId, action: action })
        });
        if (resp.ok) {
            loadSnapshot();
        }
    } catch (e) {
        console.error("Review failed:", e);
    }
};
