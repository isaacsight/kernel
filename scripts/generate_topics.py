import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Gemini
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in environment variables.")
genai.configure(api_key=api_key)

def generate_topics(count=100):
    model = genai.GenerativeModel('gemini-flash-latest')
    
    prompt = f"""
    Generate {count} unique, engaging, and thought-provoking blog post titles for a blog called "Does This Feel Right?".
    
    The blog's themes are:
    - Emotional Honesty
    - Digital Minimalism
    - The Psychology of Technology
    - Authentic Living in a Digital Age
    - Design Philosophy
    - Slow Living
    
    The titles should be:
    - Intriguing but not clickbaity
    - Reflective and grounded
    - Varied in structure (questions, statements, abstract concepts)
    
    Return the result as a raw JSON list of strings. Do not include markdown formatting like ```json.
    Example: ["The Quiet Joy of Missing Out", "Why We Scroll", ...]
    """
    
    print(f"Generating {count} topics...")
    try:
        response = model.generate_content(prompt)
        content = response.text
        # Clean up potential markdown formatting
        content = content.replace("```json", "").replace("```", "").strip()
        topics = json.loads(content)
        
        # Ensure we have a list
        if not isinstance(topics, list):
            raise ValueError("Response is not a list")
            
        return topics
    except Exception as e:
        print(f"Error generating topics: {e}")
        return []

if __name__ == "__main__":
    topics = generate_topics(100)
    
    if topics:
        output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../admin/proposed_topics.json'))
        with open(output_path, 'w') as f:
            json.dump(topics, f, indent=2)
        print(f"Successfully saved {len(topics)} topics to {output_path}")
    else:
        print("Failed to generate topics.")
