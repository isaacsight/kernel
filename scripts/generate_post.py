import sys
import os
import datetime

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.alchemist import Alchemist

def generate_engineering_post():
    try:
        alchemist = Alchemist()
        
        topic = "Engineering Progress: Kokoro TTS Integration and Empowering the AI Design Team"
        doctrine = """
        We are building an autonomous Studio OS. 
        1. Kokoro TTS Integration: We successfully replaced paid ElevenLabs services with a local, high-quality text-to-speech model called Kokoro-82M. This allows for unlimited, free, and private audio generation for our content. It required fixing ONNX compatibility issues and patching the inference code.
        2. Team Empowerment: We have formalized our AI Engineering Team structure. "The Visionary" sets goals, "The Architect" plans, "The Operator" executes, and "The Alchemist" handles ML tasks. This structure enables a "Self-Evolution Loop" where the system can improve itself.
        3. We are moving towards a future where the AI agents collaborate to design, build, and verify the software with minimal human intervention.
        """
        
        print("Generating post...")
        content = alchemist.generate(topic, doctrine)
        
        # Add frontmatter
        today = datetime.date.today()
        date_str = today.strftime("%Y-%m-%d")
        year = today.strftime("%Y") 
        
        frontmatter = f"""---
title: "Engineering Progress: Kokoro TTS and Team Empowerment"
date: {year}-12-05
template: post
draft: false
slug: engineering-progress-kokoro-tts-voice-of-ai
category: Engineering
tags: ['Kokoro', 'TTS', 'AI Agents', 'Engineering', 'Voice']
description: "We've successfully integrated high-quality local text-to-speech with Kokoro-82M and formalized our autonomous AI engineering team structure."
---

"""
        
        full_content = frontmatter + content
        
        # Save file
        filename = f"{date_str}-engineering-progress-kokoro-tts-voice-of-ai.md"
        output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "content", filename)
        
        with open(output_path, "w") as f:
            f.write(full_content)
            
        print(f"Post generated and saved to: {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    generate_engineering_post()
