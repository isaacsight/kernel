// DTFR Workspace Prototype Logic

document.addEventListener('DOMContentLoaded', () => {
    const cmdTrigger = document.getElementById('cmd-trigger');
    const modal = document.getElementById('palette-modal');
    const tray = document.getElementById('trace-timeline');

    // 1. Command Palette Toggle
    const togglePalette = (show) => {
        modal.style.display = show ? 'flex' : 'none';
        if (show) document.getElementById('palette-search').focus();
    };

    // 0. Handle Query Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    if (query) {
        const inquiryText = document.querySelector('.inquiry-box p');
        if (inquiryText) {
            inquiryText.innerText = query;
        }
        const titleInput = document.querySelector('.title-input');
        if (titleInput) {
            titleInput.value = "New Research: " + (query.length > 40 ? query.substring(0, 40) + "..." : query);
        }
    }

    cmdTrigger.addEventListener('click', () => togglePalette(true));

    window.addEventListener('keydown', (e) => {
        if (e.metaKey && e.key === 'k') {
            e.preventDefault();
            togglePalette(true);
        }
        if (e.key === 'Escape') {
            togglePalette(false);
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) togglePalette(false);
    });

    // 2. Mock Trace Injection
    const mockTraces = [
        {
            pass: 1,
            proposal: "Adopt a multi-agent governance model where 'The Sovereign' acts as the final judge of ground-truth artifacts.",
            critique: "1. Risks centralization if the Sovereign prompt is too rigid. 2. Needs explicit 'Human Overrule' hooks."
        },
        {
            pass: 2,
            proposal: "Implement the 'Research-First' loop where execution (coding) is gated by a successful grounding pass from the Answer Engine.",
            critique: "1. Grounding pass adds latency. 2. Verification layer must be parallelized to minimize orchestration overhead."
        }
    ];

    const renderTraces = () => {
        tray.innerHTML = '';
        mockTraces.forEach(t => {
            const item = document.createElement('div');
            item.className = 'trace-item';
            item.innerHTML = `
                <div class="trace-pass">Pass ${t.pass}</div>
                <div class="trace-details">
                    <div class="trace-section proposal">
                        <span class="label" style="font-size: 0.6rem; color: var(--primary)">Proposal</span>
                        <p>${t.proposal}</p>
                    </div>
                    <div class="trace-section critique">
                        <span class="label" style="font-size: 0.6rem; color: var(--accent-red)">Critique</span>
                        <p>${t.critique}</p>
                    </div>
                </div>
            `;
            tray.appendChild(item);
        });
    };

    renderTraces();

    // 3. Simple Result Selection
    const results = document.querySelectorAll('.result-item');
    results.forEach(item => {
        item.addEventListener('click', () => {
            console.log('Action selected:', item.querySelector('.r-text').innerText);
            togglePalette(false);
        });
    });

    // 4. Agent Selector Logic
    const agentBtns = document.querySelectorAll('.agent-btn');
    agentBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            agentBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Visual Feedback: Change status indicator color
            const status = document.querySelector('.status-indicator');
            if (btn.dataset.role === 'operator') {
                status.style.background = 'var(--accent-red)';
                status.style.boxShadow = '0 0 8px var(--accent-red)';

                // Demo: Trigger Consent Modal for effect
                setTimeout(() => {
                    document.getElementById('consent-modal').style.display = 'flex';
                }, 1000);
            } else {
                status.style.background = 'var(--accent-green)';
                status.style.boxShadow = '0 0 8px var(--accent-green)';
            }
        });
    });

    // 5. Consent Modal Logic
    const consentModal = document.getElementById('consent-modal');
    document.getElementById('btn-deny').addEventListener('click', () => {
        consentModal.style.display = 'none';
        // Reset to researcher for safety
        agentBtns.forEach(b => {
            if (b.dataset.role === 'researcher') b.click();
        });
    });

    document.getElementById('btn-approve').addEventListener('click', () => {
        consentModal.style.display = 'none';
        alert('Action Executed: Write Access Granted');
    });
});
