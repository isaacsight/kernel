import sys
import os

# Ensure project root is in path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.append(project_root)

from admin.engineers.research_engineer import ResearchEngineer

def prototype_janitor():
    print("🛠️ Research Engineer Building AI Janitor Prototype...")
    engineer = ResearchEngineer()
    
    idea = """
    Create an 'AI Janitor' that scans all markdown files in the repository.
    For each file, it should:
    1. Check if the file has frontmatter. If not, suggest basic metadata.
    2. Identify 'stale' or 'placeholder' text clearly.
    3. Suggest a 1-sentence summary for the file.
    The script should be a prototype named 'ai_janitor_poc.py'.
    """
    
    result = engineer.prototype_feature(idea, "ai_janitor_poc")
    print(result)

if __name__ == "__main__":
    prototype_janitor()
