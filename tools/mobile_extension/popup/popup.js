// popup.js - Studio OS Decision Interface
const API_URL = "http://localhost:8000";

async function loadDecisions() {
    const stream = document.getElementById('decision-stream');

    try {
        // Fetch snapshot from Studio OS
        const response = await fetch(`${API_URL}/v1/snapshot?user_id=anon_abc123`);
        const snapshot = await response.json();

        const entries = snapshot.entries || [];

        if (entries.length === 0) {
            stream.innerHTML = '<div class="loader">No pending decisions. Antigravity is quiet.</div>';
            return;
        }

        stream.innerHTML = '';
        entries.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'decision-card';
            card.innerHTML = `
                <h3>${entry.type.replace(/_/g, ' ').toUpperCase()}</h3>
                <p>${entry.url}</p>
                <div class="actions">
                    <button class="btn-yes" data-id="${entry.id}">Fix It</button>
                    <button class="btn-no" data-id="${entry.id}">Dismiss</button>
                    <button class="btn-defer" data-id="${entry.id}">Defer</button>
                </div>
            `;
            stream.appendChild(card);
        });

        // Add event listeners
        document.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', handleAction);
        });

    } catch (err) {
        console.error("Failed to load decisions", err);
        stream.innerHTML = '<div class="loader" style="color: #ef4444">Disconnected from Studio OS.</div>';
    }
}

async function handleAction(e) {
    const btn = e.target;
    const entry_id = btn.dataset.id;
    const action = btn.classList.contains('btn-yes') ? 'yes' :
        btn.classList.contains('btn-no') ? 'no' : 'defer';

    btn.disabled = true;
    btn.innerText = "...";

    try {
        const response = await fetch(`${API_URL}/v1/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entry_id, action })
        });

        if (response.ok) {
            btn.closest('.decision-card').style.opacity = '0.5';
            btn.closest('.decision-card').style.pointerEvents = 'none';
            btn.innerText = "Done";
            setTimeout(loadDecisions, 1000);
        }
    } catch (err) {
        console.error("Action failed", err);
        btn.disabled = false;
        btn.innerText = "Error";
    }
}

// Initial load
loadDecisions();
setInterval(loadDecisions, 10000); // Poll every 10s
