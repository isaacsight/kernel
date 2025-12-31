/**
 * DTFR Copilot - Premium Research Surface (v0.2.0)
 * Orchestrates structured research flows: Thought -> Sources -> Answers -> Related
 */

class DTFRLoopCopilot {
    constructor() {
        this.panel = null;
        this.ws = null;
        this.history = [];
        this.isThinking = false;
        this.currentMode = 'research';
        this.activeTab = 'answer';
        this.sources = [];
        this.init();
    }

    async init() {
        this.render();
        this.attachEvents();
    }

    render() {
        // 1. Handle Homepage Research Brief Redirect
        const launchBtn = document.getElementById('launch-workspace-query');
        const queryInput = document.getElementById('research-query-input');

        if (launchBtn && queryInput) {
            launchBtn.addEventListener('click', () => {
                const query = queryInput.value.trim();
                if (query) {
                    window.location.href = `/workspace_prototype/index.html?q=${encodeURIComponent(query)}`;
                } else {
                    window.location.href = `/workspace_prototype/index.html`;
                }
            });

            // Also allow Enter key to trigger launch
            queryInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    launchBtn.click();
                }
            });

            // Clean up: On homepage, we don't render the floating Answer Engine anymore
            // if specifically asked to consolidate.
            return;
        }

        const embeddedRoot = document.getElementById('embedded-copilot-root');

        if (embeddedRoot) {
            // Embedded Mode
            this.isEmbedded = true;
            this.panel = document.createElement('div');
            this.panel.className = 'copilot-panel embedded active';
            this.panel.id = 'copilot-panel';
            // Inject panel into the predefined root
            embeddedRoot.appendChild(this.panel);
        } else {
            console.warn("DTFR Copilot: #embedded-copilot-root not found. UI is disabled.");
            return;
        }

        // Common Inner HTML
        this.panel.innerHTML = `
            <div class="res-tabs">
                <div class="res-tab active" data-tab="answer">Answer</div>
                <div class="res-tab" data-tab="links">Links</div>
                <div class="res-tab" data-tab="images">Images</div>
                <div style="flex: 1"></div>
                ${this.isEmbedded ? '' : '<button class="copilot-close" id="copilot-close">×</button>'}
            </div>
            
            <div class="copilot-content" id="copilot-chat-area">
                <div class="res-answer" id="copilot-initial-msg">
                    <p>Research Kernel status: <span class="highlight">IDLE</span>. Submit a specification to begin compilation.</p>
                </div>
            </div>

            <div class="copilot-footer">
                <div class="copilot-input-box">
                    <textarea id="copilot-input" placeholder="Configure inquiry... (Shift+Enter for new line)" rows="1"></textarea>
                    <button id="copilot-send">RUN</button>
                </div>
            </div>
        `;

        this.chatArea = document.getElementById('copilot-chat-area');
        this.input = document.getElementById('copilot-input');
        this.sendBtn = document.getElementById('copilot-send');
    }

    attachEvents() {

        const closeBtn = document.getElementById('copilot-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.togglePanel(false));
        }

        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (this.input) {
            this.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Tab Switching
        document.querySelectorAll('.res-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.res-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.activeTab = tab.dataset.tab;
                this.renderActiveTabContent();
            });
        });
    }

    togglePanel(show = true) {
        if (show) {
            this.panel.classList.add('active');
            this.input.focus();
            this.connect();
        } else {
            this.panel.classList.remove('active');
        }
    }

    openWithQuery(text) {
        if (!text) return;
        this.togglePanel(true);
        this.input.value = text;
        this.sendMessage();
    }

    connect() {
        if (this.ws && this.ws.readyState <= 1) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        this.ws = new WebSocket(`${protocol}//${host}/ws/copilot`);
        this.ws.onmessage = (event) => this.handleSocketMessage(JSON.parse(event.data));
    }

    sendMessage() {
        const text = this.input.value.trim();
        if (!text || this.isThinking) return;

        this.isThinking = true;
        this.input.value = '';
        this.sources = [];
        this.chatArea.innerHTML = '';

        // Setup initial research UI
        this.currentWorkingArea = this.createWorkingArea();
        this.currentAnswerArea = document.createElement('div');
        this.currentAnswerArea.className = 'res-answer';
        this.chatArea.appendChild(this.currentAnswerArea);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                input: text,
                mode: this.currentMode,
                history: this.history
            }));
        } else {
            this.connect();
            setTimeout(() => this.sendMessage(), 500);
        }
    }

    createWorkingArea() {
        const div = document.createElement('div');
        div.className = 'res-working';
        div.innerHTML = `
            <div class="res-working-title">
                <div class="res-spinner"></div>
                <span>Working...</span>
            </div>
            <div class="res-steps" id="working-steps"></div>
            <div class="res-queries" id="working-queries"></div>
        `;
        this.chatArea.appendChild(div);
        return div;
    }

    handleSocketMessage(data) {
        switch (data.type) {
            case 'thought':
                this.addProgressStep(data.content);
                break;
            case 'sources':
                this.sources = data.content;
                this.renderSources();
                break;
            case 'chunk':
                this.appendChunk(data.content);
                break;
            case 'related':
                this.renderRelated(data.content);
                break;
            case 'badges':
                this.renderBadges(data.content);
                break;
            case 'done':
                this.isThinking = false;
                this.history.push({ role: 'ai', text: data.full_content });
                // Remove working state spinner after completion
                const spinner = this.currentWorkingArea.querySelector('.res-spinner');
                if (spinner) spinner.style.display = 'none';
                break;
            case 'error':
                this.isThinking = false;
                this.currentAnswerArea.innerHTML = `<p style="color:red">Error: ${data.message}</p>`;
                break;
        }
    }

    addProgressStep(text) {
        const steps = document.getElementById('working-steps');
        if (!steps) return;
        const step = document.createElement('div');
        step.className = 'res-step';
        step.textContent = text;
        steps.appendChild(step);
        this.scrollToBottom();
    }

    renderSources() {
        let area = document.getElementById('res-sources-display');
        if (!area) {
            area = document.createElement('div');
            area.id = 'res-sources-display';
            this.chatArea.insertBefore(area, this.currentAnswerArea);
        }

        area.innerHTML = `
            <div class="res-sources-header">Sources · ${this.sources.length}</div>
            <div class="res-sources-list">
                ${this.sources.slice(0, 4).map(s => `
                    <div class="res-source-item" onclick="window.open('${s.url}', '_blank')">
                        <div class="src-icon"></div>
                        <div class="src-info">
                            <div class="src-title">${s.title}</div>
                            <div class="src-meta">${new URL(s.url).hostname}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        this.scrollToBottom();
    }

    appendChunk(chunk) {
        if (!this.currentAnswerArea) return;
        const currentText = this.currentAnswerArea.getAttribute('data-raw') || "";
        const newText = currentText + chunk;
        this.currentAnswerArea.setAttribute('data-raw', newText);

        // Parse markdown and citations [n]
        let html = this.formatMarkdown(newText);
        html = html.replace(/\[(\d+)\]/g, '<span class="cit-chip" onclick="window.dtfrCopilot.scrollToSource($1)">$1</span>');

        this.currentAnswerArea.innerHTML = html;
        this.scrollToBottom();
    }

    renderRelated(questions) {
        const div = document.createElement('div');
        div.className = 'res-related';
        questions.forEach(q => {
            const btn = document.createElement('button');
            btn.className = 'rel-chip';
            btn.textContent = q;
            btn.onclick = () => {
                this.input.value = q;
                this.sendMessage();
            };
            div.appendChild(btn);
        });
        this.chatArea.appendChild(div);
        this.scrollToBottom();
    }

    renderBadges(badges) {
        // TBD: Add badge row to the header or top of answer
    }

    renderActiveTabContent() {
        // TBD: Logic for Links and Images tabs
    }

    scrollToSource(id) {
        // Find source in list and highlight or scroll
        console.log("Scroll to source:", id);
    }

    formatMarkdown(text) {
        return text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')
            .replace(/### (.*?)(\n|<br>|$)/g, '<h4>$1</h4>')
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/- (.*?)(\n|<br>|$)/g, '• $1<br>')
            .replace(/> (.*?)(\n|<br>|$)/g, '<blockquote>$1</blockquote>');
    }

    scrollToBottom() { this.chatArea.scrollTop = this.chatArea.scrollHeight; }
}

window.addEventListener('DOMContentLoaded', () => { window.dtfrCopilot = new DTFRLoopCopilot(); });
