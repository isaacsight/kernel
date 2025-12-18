// popup.js - Studio OS Extension

const SERVER_URL = 'http://localhost:8000';
const USER_ID = 'anon_abc123';

document.addEventListener('DOMContentLoaded', async () => {
    loadSnapshot();
});

async function loadSnapshot() {
    const snapDiv = document.getElementById('snapshot');
    try {
        const resp = await fetch(`${SERVER_URL}/v1/snapshot?user_id=${USER_ID}`);
        if (resp.ok) {
            const data = await resp.json();
            renderSnapshot(data);
        } else {
            snapDiv.textContent = 'Brain offline.';
        }
    } catch (e) {
        snapDiv.textContent = 'Connection failed.';
    }
}

function renderSnapshot(data) {
    const snapDiv = document.getElementById('snapshot');
    if (!data.decisions || data.decisions.length === 0) {
        snapDiv.textContent = 'No pending decisions. Your actions are aligned.';
        return;
    }

    snapDiv.innerHTML = data.decisions.map(d => `
        <div class="decision-item" id="node-${d.entry_id}" data-meta='${JSON.stringify(d.meta || {})}'>
            <span class="question">"${d.question}"</span>
            <div class="btn-group">
                <button class="btn-secondary" onclick="review('${d.entry_id}', 'yes')" style="color: var(--accent);">YES</button>
                <button class="btn-secondary" onclick="review('${d.entry_id}', 'no')" style="color: #ff4444;">NO</button>
                <button class="btn-secondary" onclick="review('${d.entry_id}', 'defer')">DEFER</button>
            </div>
        </div>
    `).join('');
}

window.review = async (entryId, action) => {
    const node = document.getElementById(`node-${entryId}`);
    const metaStr = node.getAttribute('data-meta');
    const meta = metaStr ? JSON.parse(metaStr) : {};

    node.style.opacity = '0.5';
    try {
        const resp = await fetch(`${SERVER_URL}/v1/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry_id: entryId, action: action })
        });
        if (resp.ok) {
            // If it's a redirect optimization and user said YES, perform the redirect
            if (action === 'yes' && meta.action_type === 'redirect' && meta.url) {
                chrome.tabs.create({ url: meta.url });
            }

            node.remove();
            if (document.querySelectorAll('.decision-item').length === 0) {
                document.getElementById('snapshot').textContent = 'No pending decisions. Your actions are aligned.';
            }
        } else {
            node.style.opacity = '1';
            alert("Review failed.");
        }
    } catch (e) {
        node.style.opacity = '1';
        alert("Connection error.");
    }
};

document.getElementById('capture').onclick = async () => {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = 'Syncing...';
    statusDiv.style.color = '#666';

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const pattern = document.getElementById('pattern').value;
        const note = document.getElementById('note').value;

        const payload = {
            user_id: USER_ID,
            event_type: 'decision',
            pattern_hint: pattern,
            context: {
                url: tab.url,
                title: tab.title,
                note: note,
                source: 'chrome_extension'
            },
            timestamp_ms: Date.now()
        };

        const resp = await fetch(`${SERVER_URL}/v1/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (resp.ok) {
            const resData = await resp.json();
            statusDiv.textContent = `Logged to Brain: ${resData.entry_id}`;
            statusDiv.style.color = '#40DCA5';
            setTimeout(loadSnapshot, 1000);
        } else {
            statusDiv.textContent = 'Sync failed.';
            statusDiv.style.color = 'red';
        }
    } catch (e) {
        statusDiv.textContent = 'Extension Error: ' + e.message;
        statusDiv.style.color = 'red';
    }
};
