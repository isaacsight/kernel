
import asyncio
import os
import sys
from openai import AsyncOpenAI

# Configuration
STUDIO_NODE_URL = "http://100.98.193.42:52415/v1"
MODEL_NAME = "qwen-2.5-72b"

async def main():
    print("🎨 Initializing Design Polish Protocol (Direct Link)...")
    
    # Read context files
    try:
        with open('admin/web/src/index.css', 'r') as f:
            current_css = f.read()
            
        with open('admin/web/src/components/Layout.jsx', 'r') as f:
            layout_jsx = f.read()
    except FileNotFoundError:
        print("Error: Could not find source files. Running from wrong directory?")
        return

    api_key = os.environ.get("STUDIO_NODE_API_KEY", "sk-antigravity")
    if api_key == "sk-antigravity":
        print("⚠️  Warning: Using default/insecure API key. Set STUDIO_NODE_API_KEY in .env")
    
    client = AsyncOpenAI(base_url=STUDIO_NODE_URL, api_key=api_key)

    system_prompt = """You are the Lead Interface Architect for Studio OS.
    Your goal is to design a "Mission Control" interface for a distributed AI system.
    Aesthetic: High-tech, Precision, Deep Space Dark (#050505), Glassmorphism, Monospaced Data.
    Output ONLY valid CSS code. No markdown fences, no explanations."""

    user_prompt = f"""
    The user wants to upgrade the UI of their "Studio OS" dashboard.
    
    CORE AESTHETIC: "Operating System / Mission Control". 
    The app represents a distributed system (Mac Control Plane + Windows Compute Node).
    The UI should feel like a "Cockpit" or "System Monitor" for an AI workforce.
    
    Keywords: Technical, Precision, Transparency, Calm, Power.
    
    Current CSS:
    ```css
    {current_css}
    ```
    
    Current Layout:
    ```jsx
    {layout_jsx}
    ```
    
    TASK:
    Generate a complete, high-end "System Interface" CSS file (index.css).
    
    Design Language Specs:
    1.  **Typography**: Use 'Inter' for UI, but mix in 'JetBrains Mono' (or monospace) for IDs, Statuses, and Metrics.
    2.  **Visual Hierarchy**: Glassmorphism for panels. Subtle grid lines. Background should be #050505.
    3.  **Status Indicators**: Define classes for glowing dots (green/amber/red).
    4.  **Accent Colors**: Use Teal (#00D6A3) and Cyan (#00E5FF) for active states.
    5.  **Borders**: Thin, 1px borders with low opacity (rgba(255,255,255,0.1)).
    
    Output the FULL CSS file content.
    """
    
    print(f"Connecting to {STUDIO_NODE_URL}...")
    try:
        response = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        
        content = response.choices[0].message.content
        print("\n--- GENERATED DESIGN ---")
        print(content)
        
        # Auto-save if it looks like CSS
        if "root" in content or "body" in content:
            with open('admin/web/src/index.css', 'w') as f:
                # Strip code blocks if present
                clean_content = content.replace("```css", "").replace("```", "")
                f.write(clean_content)
            print("✅ Applied new design to admin/web/src/index.css")
        
    except Exception as e:
        print(f"Error communicating with Studio Node: {e}")

if __name__ == "__main__":
    asyncio.run(main())
