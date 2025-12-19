/**
 * LAB-006: Ambient Interaction Evolution
 * Institutionalizing Cognitive Resonance & Peripheral Awareness
 */
class AmbientEvolution {
    constructor() {
        this.containerId = 'awareness-container';
        this.container = document.getElementById(this.containerId);
        this.currentCue = null;
        this.lastAction = Date.now();

        this.baseCues = [
            { trigger: 'idle', text: "Deep work portal active. Ready when you are." },
            { trigger: 'scroll', text: "Exploring the patterns? Look for the 'Attribution Chain'." },
            { trigger: 'nav', text: "Synthesizing latest research findings for your view..." }
        ];

        // Self-Correction: Ensure container exists
        if (!this.container) {
            console.warn("Ambient Layer: Container missing. Injecting fallback anchor.");
            this.container = document.createElement('div');
            this.container.id = this.containerId;
            document.body.appendChild(this.container);
        }

        this.init();
    }

    init() {
        console.log("LAB-006: Ambient Layer initialized.");

        // Listeners for idle/scroll
        window.addEventListener('scroll', () => this.handleActivity('scroll'), { passive: true });
        ['mousedown', 'keydown', 'touchstart'].forEach(evt => {
            window.addEventListener(evt, () => this.handleActivity('interaction'));
        });

        // Start Idle Monitor
        setInterval(() => {
            const idleTime = Date.now() - this.lastAction;
            if (idleTime > 45000 && !this.currentCue) {
                this.showCue('idle');
            }
        }, 10000);

        // Initial Contextual Probing
        setTimeout(() => this.probeContext(), 2000);
    }

    handleActivity(type) {
        this.lastAction = Date.now();
        if (type === 'scroll' && Math.random() < 0.1) {
            this.showCue('scroll');
        }
    }

    probeContext() {
        const title = document.title;
        const metaDesc = document.querySelector('meta[name="description"]')?.content || "";

        if (title.includes("Does This Feel Right")) {
            this.showCue('generic', "Cognitive Mirror active. Analyzing your trajectory.");
        } else if (metaDesc) {
            this.showCue('generic', `Resonating with: "${title}". Deep insights pending.`);
        }
    }

    showCue(trigger, overrideText = null) {
        if (this.currentCue) return;

        const cueText = overrideText || this.baseCues.find(c => c.trigger === trigger)?.text || "Shadow Agent Monitoring...";

        const bar = document.createElement('div');
        bar.className = 'awareness-bar lab-pulse';
        bar.innerHTML = `<span class="cue-meta">Shadow Agent //</span> <span class="cue-text">${cueText}</span>`;

        this.container.appendChild(bar);
        this.currentCue = bar;

        // Force reflow for animation
        void bar.offsetWidth;
        bar.classList.add('active');

        // Auto-remove cycle
        setTimeout(() => {
            bar.classList.remove('active');
            setTimeout(() => {
                bar.remove();
                this.currentCue = null;
            }, 800);
        }, 8000);
    }

    // Diagnostic Tool for User
    test() {
        this.showCue('generic', "Lab System Diagnostic: Connection Strong. Cues Operational.");
        return "Ambient Layer Diagnostic Running...";
    }
}

// Global Exposure
window.loadAmbientLayer = () => {
    window.shadowAgent = new AmbientEvolution();
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.loadAmbientLayer();
} else {
    window.addEventListener('DOMContentLoaded', window.loadAmbientLayer);
}
