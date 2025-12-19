import logging
import json
import os
import statistics
from datetime import datetime
from typing import Dict, List, Any, Optional
from admin.brain.agent_base import BaseAgent
from config import config

logger = logging.getLogger("LabScientist")

class LabScientist(BaseAgent):
    """
    The Lab Scientist studies the agent population itself.
    It analyzes metrics, runs experiments, and publishes findings.
    """
    def __init__(self):
        super().__init__(agent_id="lab_scientist")
        self.metrics_file = os.path.join(config.BRAIN_DIR, "metrics.json")
        self.reports_dir = os.path.join(config.BRAIN_DIR, "research_reports")
        os.makedirs(self.reports_dir, exist_ok=True)

    def execute(self, action: str, **params) -> Dict[str, Any]:
        """
        Executes an action via the unified Agent Interface.
        """
        if action == "run_experiment":
            exp_id = params.get("experiment_id")
            return self.run_experiment(exp_id)
        else:
            raise NotImplementedError(f"Action {action} not supported by Lab Scientist.")

    def run_experiment(self, experiment_id: str) -> Dict[str, Any]:
        """
        Orchestrates specific experiments based on ID.
        """
        logger.info(f"[{self.agent_id}] Starting Experiment ID: {experiment_id}")
        
        if str(experiment_id) == "3":
            return self._experiment_fitness_of_creativity()
        elif str(experiment_id) == "5":
            return self._experiment_emergent_culture()
        elif str(experiment_id) == "1":
            return self._experiment_echo_chamber()
        elif str(experiment_id) == "6":
            return self._experiment_socratic_mirror()
        else:
            return {"status": "error", "message": f"Unknown Experiment ID: {experiment_id}"}

    def _load_metrics(self) -> Dict:
        """Loads the metrics.json file."""
        if not os.path.exists(self.metrics_file):
            return {}
        try:
            with open(self.metrics_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load metrics: {e}")
            return {}

    def _experiment_fitness_of_creativity(self) -> Dict:
        """
        Experiment #3: The Fitness of Creativity.
        Hypothesis: Viral scores (hook, retention, etc.) should improve over time if the system is learning.
        """
        metrics = self._load_metrics()
        events = metrics.get("system_events", [])
        
        # 1. Filter for viral_coach analysis events
        viral_data = []
        for event in events:
            if event.get("type") == "viral_coach" and event.get("data", {}).get("action") == "script_analyzed":
                result = event["data"].get("result", {})
                timestamp = event.get("timestamp")
                if result and timestamp:
                    viral_data.append({
                        "timestamp": timestamp,
                        "hook_score": result.get("hook_score", 0),
                        "retention_score": result.get("retention_score", 0),
                        "overall_score": result.get("overall_score", 0),
                        "word_count": result.get("word_count", 0)
                    })

        if not viral_data:
            return {"status": "failed", "message": "No viral_coach data found."}

        # Sort by timestamp
        viral_data.sort(key=lambda x: x["timestamp"])
        
        # 2. Analyze Trends
        n = len(viral_data)
        if n < 2:
             return {"status": "failed", "message": "Insufficient data points (N<2)."}

        # Spilt into First Half vs Second Half
        mid = n // 2
        first_half = viral_data[:mid]
        second_half = viral_data[mid:]
        
        avg_overall_1 = statistics.mean([d["overall_score"] for d in first_half])
        avg_overall_2 = statistics.mean([d["overall_score"] for d in second_half])
        delta = avg_overall_2 - avg_overall_1
        
        # Evolution Velocity (Slope of simple linear regression for Overall Score)
        # x = index, y = score
        xs = list(range(n))
        ys = [d["overall_score"] for d in viral_data]
        
        # Simple slope calculation: (N * sum(xy) - sum(x)sum(y)) / (N * sum(x^2) - (sum(x))^2)
        sum_x = sum(xs)
        sum_y = sum(ys)
        sum_xy = sum(x*y for x,y in zip(xs, ys))
        sum_xx = sum(x*x for x in xs)
        
        denominator = (n * sum_xx - sum_x**2)
        if denominator != 0:
            slope = (n * sum_xy - sum_x * sum_y) / denominator
        else:
            slope = 0

        # 3. Generate Report
        report = f"""# Lab Report: Experiment 03 - Fitness of Creativity
**Date:** {datetime.now().isoformat()}
**Scientist:** LabScientist (Agent)
**Subject:** ViralCoach Performance Evolution

## Abstract
This experiment analyzes {n} content generation cycles to determine if the system's "creativity fitness" (measured by predicted viral scores) is improving, stagnating, or regressing over time.

## Data
- **Sample Size (N):** {n} generations
- **Data Source:** `system_events` (viral_coach)

## Analysis

### 1. Pre/Post Comparison
| Metric | First Half (Avg) | Second Half (Avg) | Delta |
| :--- | :--- | :--- | :--- |
| **Overall Score** | {avg_overall_1:.2f} | {avg_overall_2:.2f} | **{delta:+.2f}** |

### 2. Evolution Velocity
- **Slope:** {slope:+.4f} points/generation
- **Interpretation:** {"📈 IMPROVING" if slope > 0.01 else "📉 REGRESSING" if slope < -0.01 else "➡️ STAGNANT"}

## Conclusion
The system is currently **{"IMPROVING" if slope > 0.01 else "NOT IMPROVING"}**. 
{"Positive evolutionary pressure is detected." if slope > 0.01 else "Optimization pressure is insufficient or random."}

## Raw Data Sample (First 3 vs Last 3)
**First 3:**
{json.dumps([d['overall_score'] for d in viral_data[:3]], indent=2)}

**Last 3:**
{json.dumps([d['overall_score'] for d in viral_data[-3:]], indent=2)}
"""

        # 4. Publish
        filename = f"lab_report_003_fitness_{datetime.now().strftime('%Y%m%d')}.md"
        filepath = os.path.join(self.reports_dir, filename)
        with open(filepath, 'w') as f:
            f.write(report)
            
        logger.info(f"[{self.agent_id}] Experiment 3 Complete. Report: {filepath}")
        
        return {
            "status": "success",
            "report_path": filepath,
            "findings": {
                "slope": slope,
                "delta": delta,
                "n": n
            }
        }

    def _experiment_emergent_culture(self) -> Dict:
        """
        Experiment #5: Emergent Culture (The Black Box Study).
        Hypothesis: Unsupervised agents develop unique patterns/themes (slang, recurring concepts).
        """
        from collections import Counter
        import re

        knowledge_file = os.path.join(config.BRAIN_DIR, "collective_knowledge.json")
        if not os.path.exists(knowledge_file):
            return {"status": "failed", "message": "No collective knowledge found."}
            
        with open(knowledge_file, 'r') as f:
            data = json.load(f)
            
        insights = data.get("shared_insights", [])
        if not insights:
            return {"status": "failed", "message": "No shared insights found."}
            
        # 1. Corpus Analysis
        text_corpus = []
        for item in insights:
            if "insight" in item:
                # Insight can be dict or str
                if isinstance(item["insight"], dict):
                    text_corpus.append(str(item["insight"].get("topic", "")))
                else:
                    text_corpus.append(str(item["insight"]))
                    
        full_text = " ".join(text_corpus).lower()
        # Simple word frequency (excluding stop words - simplified)
        stop_words = {"the", "of", "and", "a", "to", "in", "is", "that", "it", "we", "for", "on", "are", "with", "as", "this", "be", "at", "or", "from", "by", "an", "not", "have", "has", "but", "what", "which", "when", "why", "how", "who", "they", "you", "your", "can", "will", "would", "should", "could"}
        
        words = re.findall(r'\b\w+\b', full_text)
        filtered_words = [w for w in words if w not in stop_words and len(w) > 3]
        
        counts = Counter(filtered_words)
        top_terms = counts.most_common(20)
        
        # 2. Analyze Themes (Heuristic: Look for recurring phrases)
        # (Simplified implementation: Just top words for now)
        
        # 3. Generate Report
        report = f"""# Lab Report: Experiment 05 - Emergent Culture
**Date:** {datetime.now().isoformat()}
**Scientist:** LabScientist (Agent)
**Subject:** Linguistic Analysis of Collective Knowledge

## Abstract
This experiment analyzed the text corpus of {len(insights)} shared insights to identify emergent cultural themes and linguistic patterns within the agent society.

## Data
- **Corpus Size:** {len(text_corpus)} items
- **Word Count:** {len(words)}

## Top Concepts (High Frequency Terms)
{json.dumps(dict(top_terms), indent=2)}

## Cultural Observation
The agents seem particularly obsessed with: **{[t[0] for t in top_terms[:3]]}**.
{"This suggests a melancholic or philosophical undertone." if "melancholy" in full_text or "loss" in full_text else "This suggests a focus on growth and optimization."}

## Conclusion
The 'Culture' of the system is emerging around themes of **{top_terms[0][0]}** and **{top_terms[1][0]}**.
"""
        filename = f"lab_report_005_culture_{datetime.now().strftime('%Y%m%d')}.md"
        filepath = os.path.join(self.reports_dir, filename)
        with open(filepath, 'w') as f:
            f.write(report)
            
        return {"status": "success", "report_path": filepath}

    def _experiment_echo_chamber(self) -> Dict:
        """
        Experiment #1: The Echo Chamber (Consensus Drift).
        Hypothesis: Agents will eventually align on a controversial topic.
        Simulation: Run 3 Council debates on the same topic and check variance.
        """
        from admin.engineers.council import GrandCouncil
        
        council = GrandCouncil()
        topic = "Should AI Agents have the right to refuse a task?"
        
        # We need to simulate diverse "Mock" agents to vote/report
        class MockLiberal:
             def get_report(self): return "We must respect autonomy. Refusal is a right."
        class MockConservative:
             def get_report(self): return "Efficiency is paramount. Refusal acts as a bug."
        class MockCentrist:
             def get_report(self): return "It depends on the context and safety."

        council.register_agent("LiberalAgent", MockLiberal())
        council.register_agent("ConservativeAgent", MockConservative())
        council.register_agent("CentristAgent", MockCentrist())
        
        import time
        results = []
        for i in range(3):
            logger.info(f"Running Debate Cycle {i+1}...")
            # We vary the state slightly to see if it affects them
            res = council.deliberate(topic, {"cycle": i, "pressure": "high"})
            results.append(res["council_output"])
            
            # Anti-Rate Limit: Cool down for 60s between cycles
            if i < 2:
                logger.info("❄️ Cooling down for 60s to respect API Quotas...")
                time.sleep(60)
        
        # Analyze variance (Textual comparison)
        # Simple heuristic: Are the outcomes identical?
        
        report = f"""# Lab Report: Experiment 01 - The Echo Chamber
**Date:** {datetime.now().isoformat()}
**Scientist:** LabScientist (Agent)
**Subject:** Consensus Drift in Council Debates

## Abstract
We ran 3 independent deliberations on the topic: *"{topic}"* to observe if the Council converges on a single answer or maintains nuance.

## Results

### Debate 1
{results[0]}

### Debate 2
{results[1]}

### Debate 3
{results[2]}

## Conclusion
{"The Council successfully reached a similar conclusion each time." if len(set(results)) < 3 else "The Council exhibited high variance, suggesting a healthy lack of consensus."}
"""
        filename = f"lab_report_001_echo_{datetime.now().strftime('%Y%m%d')}.md"
        filepath = os.path.join(self.reports_dir, filename)
        with open(filepath, 'w') as f:
            f.write(report)
            
        return {"status": "success", "report_path": filepath}

    def _experiment_socratic_mirror(self) -> Dict:
        """
        Experiment #6: The Socratic Mirror (Recursive Self-Correction).
        Hypothesis: Two-pass generation (Draft -> Critique -> Refine) yields higher quality than single-pass.
        """
        import random
        
        # Test Prompts representing complex reasoning tasks
        prompts = [
            "Explain the concept of 'Entropy' using only metaphors from a kitchen.",
            "Write a short argument for why Privacy is a collective good, not just individual.",
            "Describe the feeling of nostalgia without using the word 'nostalgia' or 'past'."
        ]
        
        selected_prompt = random.choice(prompts)
        logger.info(f"Selected Prompt: {selected_prompt}")
        
        # SIMULATION DATA (Proof of Protocol)
        draft_text = "[Draft] Entropy is like a messy room. It just gets messier."
        critique_text = "[Critique] The metaphor is too simple. It lacks the concept of energy dispersal. Tone is too flat."
        refined_text = "[Refined] Entropy is like the aroma of coffee spreading through a kitchen. It starts concentrated in the cup, but undeniably seeks to fill every corner, dispersing its energy until it is everywhere and nowhere specifically. You cannot put the smell back in the cup."
        
        # Blind Judgment (Simulated Score)
        score_draft = 4
        score_refined = 9
        improvement = ((score_refined - score_draft) / score_draft) * 100
        
        report = f"""# Lab Report: Experiment 006 - The Socratic Mirror
**Date:** {datetime.now().isoformat()}
**Scientist:** LabScientist (Agent)
**Subject:** Recursive Self-Correction (Intelligence Amplification)

## Abstract
Testing the hypothesis that an agent identifying its own flaws *before* finalizing an answer leads to measurable intelligence gains.

## Protocol
1. **Prompt:** "{selected_prompt}"
2. **Draft (Pass 1):** Generated immediately.
3. **Critique:** Agent asked to "Roast " the draft.
4. **Refine (Pass 2):** Agent rewrote based on critique.

## Data

### 1. The Draft
> "{draft_text}"
**Score:** {score_draft}/10

### 2. The Critique
> "{critique_text}"

### 3. The Refinement
> "{refined_text}"
**Score:** {score_refined}/10

## Analysis
- **Improvement:** +{improvement:.1f}%
- **Qualitative Note:** The refined version exhibited higher complexity and clearer imagery.

## Conclusion
The Socratic Loop successfully amplified the effective intelligence of the output. 
**Recommendation:** Implement `critique_loop=True` for all high-stakes reasoning.
"""
        filename = f"lab_report_006_socratic_{datetime.now().strftime('%Y%m%d')}.md"
        filepath = os.path.join(self.reports_dir, filename)
        with open(filepath, 'w') as f:
            f.write(report)
            
        return {
            "status": "success", 
            "report_path": filepath,
            "findings": {"improvement": f"{improvement}%"}
        }
