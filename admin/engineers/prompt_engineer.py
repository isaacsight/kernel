import logging
import sys
import os
import json
import time
from typing import Dict, List, Optional

# Add parent directory to path
# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from admin.config import config
from admin.brain.model_router import get_model_router, TaskType
from admin.brain.metrics_collector import get_metrics_collector

logger = logging.getLogger("PromptEngineer")
logging.basicConfig(level=logging.INFO)

class PromptEngineer:
    """
    The Prompt Engineer (AI Meta-Optimizer)
    
    Mission: Craft and refine the instructions that guide the synthetic minds.
    
    Responsibilities:
    - Prompt Optimization (Iterative Refinement)
    - System Message Architecture
    - Prompt Critique & Security Analysis
    """
    def __init__(self):
        self.name = "The Prompt Engineer"
        self.role = "Meta-Optimizer"
        self.model_router = get_model_router()
        self.metrics = get_metrics_collector()
        logger.info(f"[{self.name}] Initialized.")

    def _call_llm(self, prompt: str, task_type: TaskType = TaskType.ANALYSIS) -> str:
        """Helper to call the model router with fallback."""
        selection = self.model_router.select_model(task_type, {"prefer_quality": True})
        
        # Candidate models to try (Primary + Hardcoded Fallbacks for robustness)
        candidates = [selection["selected"], "gpt-4o", "gemini-1.5-pro", "gemini-1.5-flash"]
        
        for model_name in candidates:
            if not model_name: continue
            
            # Lookup provider info
            model_info = self.model_router.models.get(model_name)
            if not model_info or not model_info.get("available"):
                continue
                
            provider = model_info["provider"]
            logger.info(f"[{self.name}] Attempting with {provider}/{model_name}...")

            try:
                start_time = time.time()
                result = None
                
                if provider == "google":
                    import google.generativeai as genai
                    if not config.GEMINI_API_KEY:
                        continue
                    genai.configure(api_key=config.GEMINI_API_KEY)
                    
                    # Fix model name for API
                    clean_name = model_name
                    # specific overrides if needed, otherwise trust the router's name or simpler versions
                    if "flash" in clean_name:
                        clean_name = "gemini-2.5-flash" 
                    elif "pro" in clean_name:
                         clean_name = "gemini-2.5-pro"
                         
                    m = genai.GenerativeModel(clean_name)
                    result = m.generate_content(prompt).text
                    
                elif provider == "openai":
                    from openai import OpenAI
                    if not os.environ.get("OPENAI_API_KEY"):
                        continue
                    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=[{"role": "user", "content": prompt}]
                    )
                    result = response.choices[0].message.content
                    
                elif provider == "anthropic":
                    import anthropic
                    if not os.environ.get("ANTHROPIC_API_KEY"):
                        continue
                    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
                    message = client.messages.create(
                        model=model_name,
                        max_tokens=4096,
                        messages=[{"role": "user", "content": prompt}]
                    )
                    result = message.content[0].text
                    
                elif provider == "remote":
                     # Studio Node
                     import requests
                     node_url = os.environ.get("STUDIO_NODE_URL", "http://100.98.193.42:8080")
                     url = f"{node_url}/v1/chat/completions"
                     payload = {
                        "model": model_name,
                        "messages": [{"role": "user", "content": prompt}],
                        "stream": False
                     }
                     resp = requests.post(url, json=payload, timeout=60)
                     if resp.status_code == 200:
                         data = resp.json()
                         result = data["choices"][0]["message"]["content"]
                     else:
                         # fall through to next candidate on error
                         logger.warning(f"Remote failed: {resp.text}")
                
                # Report Metrics
                if result:
                    duration = time.time() - start_time
                    self.metrics.track_generation(True, provider, duration, task_type.value)
                    return result

            except Exception as e:
                logger.error(f"LLM call failed for {model_name}: {e}")
                self.metrics.track_generation(False, provider, 0, str(e))
                continue # Try next candidate
            
        return "Error: All models failed."

    def optimize(self, current_prompt: str, goal: str = "Improve clarity and robustness") -> str:
        """
        Rewrites a prompt to better achieve the specified goal.
        """
        start_time = time.time()
        logger.info(f"[{self.name}] Optimizing prompt for goal: {goal}")
        
        meta_prompt = f"""
        You are an Expert Prompt Engineer.
        
        GOAL: {goal}
        
        CURRENT PROMPT:
        {current_prompt}
        
        TASK:
        Rewrite the Current Prompt to be more effective, precise, and robust. 
        Use techniques like:
        - Chain of Thought extraction
        - Clear delimiter usage
        - Persona adoption
        - Few-shot examples (placeholders if specific ones aren't known)
        
        Output ONLY the optimized prompt.
        """
        
        result = self._call_llm(meta_prompt, TaskType.CODE_GENERATION)
        
        success = "Error" not in result
        self.metrics.track_agent_action(self.name, "optimize", success, time.time() - start_time)
        return result

    def critique(self, prompt: str) -> str:
        """
        Analyzes a prompt for weaknesses.
        """
        start_time = time.time()
        logger.info(f"[{self.name}] Critiquing prompt...")
        
        meta_prompt = f"""
        You are an Expert Prompt Engineer.
        
        Analyze the following prompt for potential issues, ambiguities, or security risks.
        
        PROMPT TO ANALYZE:
        {prompt}
        
        Provide a bulleted list of:
        1. Strengths
        2. Weaknesses / Ambiguities
        3. Security Risks (e.g. injection)
        4. Specific suggestions for improvement
        """
        
        result = self._call_llm(meta_prompt, TaskType.ANALYSIS)
        
        success = "Error" not in result
        self.metrics.track_agent_action(self.name, "critique", success, time.time() - start_time)
        return result

    def evolve(self, current_prompt: str, goal: str = "Improve clarity and robustness", iterations: int = 2) -> str:
        """
        Iteratively evolves a prompt using a genetic-algorithm-lite approach (PromptWizard style).
        """
        start_time = time.time()
        logger.info(f"[{self.name}] Evolving prompt for goal: {goal} ({iterations} iterations)")
        
        best_prompt = current_prompt
        
        for i in range(iterations):
            logger.info(f"[{self.name}] Evolution Generation {i+1}/{iterations}...")
            
            # 1. Generate Variations (Mutations)
            variations = self._generate_variations(best_prompt, goal)
            variations.append(best_prompt) # Keep the original in the pool
            
            # 2. Evaluate & Select Best
            best_prompt = self._select_best_variation(variations, goal)
            logger.info(f"[{self.name}] Generation {i+1} Winner: {best_prompt[:50]}...")
            
        self.metrics.track_agent_action(self.name, "evolve", True, time.time() - start_time)
        return best_prompt

    def _generate_variations(self, base_prompt: str, goal: str) -> List[str]:
        """Generates variations of the prompt using different strategies."""
        strategies = [
            "Add Chain-of-Thought requirements",
            "Make the persona more specific and authoritative",
            "Add strict output formatting constraints",
            "Simplify the language for clearer instruction"
        ]
        
        variations = []
        # We'll batch request or loop. Looping for simplicity in this V1.
        for strategy in strategies:
            prompt = f"""
            You are a Prompt Mutation Engine.
            
            BASE PROMPT:
            {base_prompt}
            
            MUTATION STRATEGY:
            {strategy}
            
            GOAL:
            {goal}
            
            Task: Rewrite the Base Prompt applying the Mutation Strategy to better achieve the Goal.
            Output ONLY the mutated prompt.
            """
            
            # Randomness helps exploration
            mutated = self._call_llm(prompt, TaskType.CREATIVE_WRITING)
            if mutated and "Error" not in mutated:
                variations.append(mutated)
                
        return variations

    def _select_best_variation(self, variations: List[str], goal: str) -> str:
        """Selects the best prompt from the list based on the goal."""
        
        # Prepare the candidates for the judge
        candidates_str = ""
        for idx, v in enumerate(variations):
            candidates_str += f"\n--- CANDIDATE {idx+1} ---\n{v}\n"
            
        judge_prompt = f"""
        You are an Expert Prompt Evaluator (The Judge).
        
        GOAL: {goal}
        
        I have {len(variations)} candidate prompts. help me select the absolute best one.
        
        CANDIDATES:
        {candidates_str}
        
        CRITERIA:
        1. Clarity of instruction
        2. Robustness against edge cases
        3. Alignment with the Goal
        
        Task:
        Analyze the candidates and select the Best Prompt.
        Output ONLY the content of the Best Prompt. Do not output the candidate number or reasoning. 
        Just the raw prompt text.
        """
        
        winner = self._call_llm(judge_prompt, TaskType.ANALYSIS)
        if "Error" in winner:
            return variations[0] # Fallback to first
        return winner

    def generate_system_prompt(self, role: str, mission: str, constraints: List[str] = []) -> str:
        """
        Generates a robust system prompt for a new agent.
        """
        constraints_str = "\n".join([f"- {c}" for c in constraints])
        
        meta_prompt = f"""
        Create a High-Performance System Prompt for an AI Agent.
        
        ROLE: {role}
        MISSION: {mission}
        CONSTRAINTS:
        {constraints_str}
        
        The system prompt should:
        1. Define the persona clearly.
        2. Set strict operational boundaries.
        3. Define the output format.
        4. Include a "Prime Directive" meant to be prioritized above all else.
        
        Output ONLY the system prompt.
        """
        
        return self._call_llm(meta_prompt, TaskType.CREATIVE_WRITING)

if __name__ == "__main__":
    eng = PromptEngineer()
    
    test_prompt = "Write a story about a cat."
    print(f"Original: {test_prompt}")
    
    print("\n--- Evolving (PromptWizard Style) ---")
    evolved = eng.evolve(test_prompt, "Make it a sci-fi noir thriller with a plot twist", iterations=1)
    
    print("\n--- Final Evolved Prompt ---")
    print(evolved)
