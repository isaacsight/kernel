# shadow_agent_poc.py
"""
Shadow Agent Proof of Concept (PoC)

This script simulates a 'Shadow Agent' that monitors user activity 
(simulated) and provides minimal, peripheral feedback ('Ambient Cues') 
without requiring a traditional chat interface.

Libraries required: 
- time
- random
"""
import time
import random

# --- Configuration and Simulated Data ---

# Simulated mapping of user keywords to ambient cues (The 'Agent Logic')
CUE_MAPPING = {
    "report draft": "Remember to cite the source data for Exhibit A.",
    "q3 projections": "Did you check the updated variance report from last week?",
    "copy-pasted": "Watch formatting; large external pastes often need sanitization.",
    "competing company": "Quick review: key industry trends changed significantly yesterday.",
    "data visualization": "Consider testing the colorblind accessibility settings.",
    "deleted": "[CRITICAL] Confirm backup protocols are active for the affected directory.",
    "idle": "High cognitive load detected. Perhaps try the Pomodoro technique?",
    "slack": "Avoid multitasking; dedicated focus slots improve recall."
}

# Simulated sequence of user actions
SIMULATED_ACTIONS = [
    "User is signing into the system.",
    "User opened the 'Quarterly Report Draft'.",
    "User searched internal database for 'Q3 projections'.",
    "User copy-pasted a large block of text from an external source.",
    "User is idle (typing speed slowed down significantly).",
    "User opened a competing company's financial statement.",
    "User navigated to the 'Data Visualization' tool.",
    "User sent 15 messages on Slack in the last minute.",
    "User deleted the 'Budget Summary 2024' folder.",
    "User opened the document again, seemingly reviewing it.",
    "User minimized the window and started scrolling social media."
]

# --- Agent Core Functions ---

def analyze_action(action: str) -> str | None:
    """
    Simulates the agent's decision process, mapping an action 
    to an ambient cue based on keywords.
    """
    action_lower = action.lower()
    
    # 1. Check for specific keyword triggers
    for keyword, cue in CUE_MAPPING.items():
        if keyword in action_lower:
            return f"Agent Cue: {cue}"

    # 2. Random chance for a generic, low-priority cue (ambient awareness)
    if random.random() < 0.15:
        generic_cues = [
            "System status: All services running normally.",
            "Ambient thought: Ensure you have taken a brief stretch break recently.",
            "Periphery: Consistency check passed."
        ]
        return f"Agent Cue: {random.choice(generic_cues)}"

    return None

def log_ambient_cue(cue: str):
    """Prints the cue specifically into the Awareness Log area."""
    print(f"\t\t\t\t\t| AMBIENT AWARENESS LOG |")
    print(f"\t\t\t\t\t| {cue}")
    print("\t\t\t\t\t" + "="*30)

# --- Demonstration and Main Loop ---

def demonstrate_system():
    """Runs the simulation sequence."""
    
    print("="*80)
    print("SHADOW AGENT PROOF OF CONCEPT (PoC)")
    print("Mode: Ambient Monitoring System (No Chat Interface)")
    print("="*80)
    print("\n[MAIN CONSOLE STREAM]\t\t\t\t[AMBIENT AWARENESS LOG]")
    print("-" * 35 + "\t\t\t\t" + "-" * 30)

    for i, action in enumerate(SIMULATED_ACTIONS):
        
        # 1. Display the primary user action stream
        print(f"[{time.strftime('%H:%M:%S')}] User Action {i+1}: {action}")

        # 2. Pass the action to the Shadow Agent
        cue = analyze_action(action)

        # 3. If a cue is generated, log it peripherally
        if cue:
            time.sleep(0.5) # Simulate slight processing delay
            log_ambient_cue(cue)
        
        # 4. Introduce pause for reading
        time.sleep(random.uniform(1.5, 3.0))

    print("\n" + "="*80)
    print("Simulation Complete.")
    print("Ambient Cues successfully provided peripheral suggestions based on simulated actions.")


if __name__ == "__main__":
    demonstrate_system()