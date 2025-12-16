---
title: "Pattern Recommendation Engine"
date: 2025-12-15
description: "Find the right Studio Pattern for your team."
slug: recommendation-engine
type: tool
---

# Pattern Recommender

**Not sure where to start? Tell the OS about your context.**
Answer 3 questions to get a tailored pattern recommendation.

<div class="recommender-widget">
    <div class="step active" id="step-1">
        <h3>1. What is your primary constraint?</h3>
        <button class="option-btn" onclick="selectOption('constraint', 'velocity')">Velocity (Need to ship faster)</button>
        <button class="option-btn" onclick="selectOption('constraint', 'quality')">Quality (Need to reduce rework)</button>
        <button class="option-btn" onclick="selectOption('constraint', 'alignment')">Alignment (Need to agree on direction)</button>
    </div>

    <div class="step" id="step-2">
        <h3>2. What is your team size?</h3>
        <button class="option-btn" onclick="selectOption('size', 'solo')">Solo Founder</button>
        <button class="option-btn" onclick="selectOption('size', 'small')">Small Team (2-10)</button>
        <button class="option-btn" onclick="selectOption('size', 'scale')">Scaling (10+)</button>
    </div>

    <div class="step" id="step-3">
        <h3>3. What is your AI maturity?</h3>
        <button class="option-btn" onclick="selectOption('ai', 'none')">None (Just starting)</button>
        <button class="option-btn" onclick="selectOption('ai', 'tools')">Copilots (Cursor, GitHub Copilot)</button>
        <button class="option-btn" onclick="selectOption('ai', 'agents')">Agents (Custom scripts, n8n)</button>
    </div>

    <div class="results" id="results-container" style="display: none;">
        <h3>Recommended Pattern:</h3>
        <div id="recommendation-output"></div>
        <button class="reset-btn" onclick="resetRecommender()">Start Over</button>
    </div>
</div>

<script>
    const userContext = {};

    function selectOption(category, value) {
        userContext[category] = value;
        const currentStep = document.querySelector('.step.active');
        currentStep.classList.remove('active');
        
        const nextStep = currentStep.nextElementSibling;
        if (nextStep && nextStep.classList.contains('step')) {
            nextStep.classList.add('active');
        } else {
            showResults();
        }
    }

    function showResults() {
        const resultsContainer = document.getElementById('results-container');
        const output = document.getElementById('recommendation-output');
        resultsContainer.style.display = 'block';

        let recommendation = "";
        
        // Simple logic engine
        if (userContext.constraint === 'velocity') {
            recommendation = `
                <div class="RecCard">
                    <h4><a href="patterns/frontier-agents-os.html">Frontier Agents OS</a></h4>
                    <p>You need a chassis for your agents to speed up execution without crashing.</p>
                </div>`;
        } else if (userContext.constraint === 'alignment') {
             recommendation = `
                <div class="RecCard">
                    <h4><a href="patterns/alignment-lens.html">The Alignment Lens</a></h4>
                    <p>Stop building the wrong things faster. Validate before you build.</p>
                </div>`;
        } else if (userContext.size === 'scale') {
             recommendation = `
                <div class="RecCard">
                    <h4><a href="patterns/frontier-team-v1.html">Frontier Team v1</a></h4>
                    <p>You need clearly defined roles (Architect, Operator) to manage the complexity.</p>
                </div>`;
        } else {
             // Default fallback
             recommendation = `
                <div class="RecCard">
                    <h4><a href="modules/the-architect.html">The Architect Module</a></h4>
                    <p>Start by explicitly designing your system before executing.</p>
                </div>`;
        }

        output.innerHTML = recommendation;
    }

    function resetRecommender() {
        userContext.constraint = null;
        userContext.size = null;
        userContext.ai = null;
        
        document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
        document.getElementById('step-1').classList.add('active');
        document.getElementById('results-container').style.display = 'none';
    }
</script>

<style>
    .recommender-widget {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 2rem;
        margin: 2rem 0;
        text-align: center;
    }
    .step {
        display: none;
        animation: fadeIn 0.3s ease;
    }
    .step.active {
        display: block;
    }
    .option-btn {
        display: block;
        width: 100%;
        max-width: 300px;
        margin: 0.5rem auto;
        padding: 1rem;
        background: transparent;
        border: 1px solid var(--text-tertiary);
        color: var(--text-secondary);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
    }
    .option-btn:hover {
        border-color: var(--text-primary);
        color: var(--text-primary);
        background: rgba(255,255,255,0.05);
    }
    .RecCard {
        border: 1px solid var(--accent-primary);
        padding: 1.5rem;
        border-radius: 8px;
        margin-top: 1rem;
    }
    .reset-btn {
        margin-top: 1rem;
        background: none;
        border: none;
        color: var(--text-tertiary);
        text-decoration: underline;
        cursor: pointer;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
    }
</style>
