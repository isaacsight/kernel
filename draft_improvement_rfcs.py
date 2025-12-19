import sys
import os

# Ensure project root is in path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.append(project_root)

from admin.engineers.research_engineer import ResearchEngineer

def draft_rfcs():
    print("📋 Research Engineer Drafting RFCs...")
    engineer = ResearchEngineer()
    
    improvements = [
        ("AI Janitor System", "An autonomous QA agent that fixes linting, broken links, and style issues across the repo."),
        ("Agent Execution Trace", "A system for recording and visualizing the full execution path, prompt context, and outputs of agent runs."),
        ("Dynamic Content Stratification", "A virtual directory system that organizes the /content folder using AI-generated semantic tags.")
    ]
    
    for title, idea in improvements:
        print(f"\nDrafting RFC for: {title}")
        result = engineer.draft_rfc(title, idea)
        print(result)

if __name__ == "__main__":
    draft_rfcs()
