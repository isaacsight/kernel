
import os
import sys
import google.generativeai as genai
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import config

# Configure Gemini
if not config.GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY not found.")
    sys.exit(1)

genai.configure(api_key=config.GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-pro-latest')

def generate_persona_response(persona_name, persona_prompt, context, history):
    """
    Generates a response from a specific persona given the context and conversation history.
    """
    full_prompt = f"""
    You are {persona_name}.
    
    YOUR IDENTITY & CORE BELIEFS:
    {persona_prompt}
    
    CONTEXT OF THE DEBATE:
    {context}
    
    CONVERSATION HISTORY:
    {history}
    
    YOUR INSTRUCTION:
    Respond to the last point made (or start the debate). 
    Be distinct in your voice. 
    Technician: Focus on specs, latency, control, privacy, potential.
    Businessman: Focus on cost, ROI, user value, maintenance burden, opportunity cost.
    
    Keep your response concise (under 200 words) but punchy.
    """
    
    response = model.generate_content(full_prompt)
    return response.text

def main():
    topic = "The Strategic Value of the Studio Node (Local Compute Cluster)"
    
    technician_prompt = """
    You are the **Infrastructure Engineer (The Technician)**.
    You love hardware, self-reliance, and technical optimization.
    You believe that owning the compute is owning the future.
    You are excited about:
    - Zero latency (local network).
    - Privacy (data never leaves the building).
    - Fine-tuning capability.
    - "Distributed Cognition" (the cool factor).
    Your fear: Dependence on expensive, rate-limited cloud APIs.
    """
    
    businessman_prompt = """
    You are the **Product Engineer (The Businessman)**.
    You care about "shipping" and "user value".
    You are skeptical of "engineering for engineering's sake".
    You believe that time spent maintaining a server is time NOT spent building features.
    You are worried about:
    - Electricity costs and hardware depreciation.
    - Distraction from the core product.
    - Complication of the deployment pipeline.
    - "Is this actually better than GPT-4?"
    Your fear: Building a cool toy that makes no money and has no users.
    """
    
    context = f"""
    The team has just brought the "Studio Node" online. It is a dedicated Windows machine with high-end GPUs, designed to offload inference from the main server.
    The Technician considers this a massive victory ("Awakening the Node").
    The Businessman is conducting a "Post-Mortem / Value Audit" to see if this was worth the effort and how to justify it.
    """
    
    history = ""
    turns = 6 
    
    print(f"### DEBATE TOPIC: {topic}\n")
    
    # Transcript storage
    transcript = f"# Research & Debate: {topic}\n\n"
    transcript += f"**Date:** {datetime.now().strftime('%Y-%m-%d')}\n"
    transcript += "**Participants:** Infrastructure Engineer (Technician) vs. Product Engineer (Businessman)\n\n"
    transcript += "---\n\n"
    
    # 1. Research Phase (Internal Monologue - Simulated)
    transcript += "## Phase 1: Independent Research\n\n"
    
    tech_research = model.generate_content(f"You are the Technician. {technician_prompt}. Write 3 bullet points of 'Research Findings' supporting the Studio Node.").text
    biz_research = model.generate_content(f"You are the Businessman. {businessman_prompt}. Write 3 bullet points of 'Market Concerns' regarding the Studio Node.").text
    
    transcript += f"### Technician's Preliminary Findings\n{tech_research}\n\n"
    transcript += f"### Businessman's Preliminary Concerns\n{biz_research}\n\n"
    
    transcript += "---\n\n## Phase 2: The Debate\n\n"
    
    # 2. Debate Phase
    current_speaker = "Technician"
    
    for i in range(turns):
        print(f"Turn {i+1}: {current_speaker} speaking...")
        if current_speaker == "Technician":
            prompt = technician_prompt
            name = "Technician"
        else:
            prompt = businessman_prompt
            name = "Businessman"
            
        response = generate_persona_response(name, prompt, context, history)
        
        # Clean up response
        response = response.strip()
        
        transcript += f"**{name}:** {response}\n\n"
        history += f"{name}: {response}\n"
        
        # Switch speaker
        current_speaker = "Businessman" if current_speaker == "Technician" else "Technician"
        
    # 3. Conclusion
    transcript += "---\n\n## Phase 3: Synthesis\n\n"
    synthesis = model.generate_content(f"""
    Review this debate:
    {history}
    
    Provide a "Consensus Strategy" that satisfies both the Technician's need for control and the Businessman's need for value.
    How should the Studio Node be used to maximize ROI?
    """).text
    
    transcript += f"### Consensus Strategy\n{synthesis}\n"
    
    # Save to file
    output_path = os.path.join(config.CONTENT_DIR, "research-technician-vs-businessman.md")
    with open(output_path, "w") as f:
        f.write(transcript)
        
    print(f"\nDebate generated and saved to: {output_path}")

if __name__ == "__main__":
    main()
