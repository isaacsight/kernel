import sys
import os

# Ensure project root is in path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.append(project_root)

from admin.engineers.research_engineer import ResearchEngineer

def run_audit():
    print("🚀 Research Engineer Audit Start...")
    engineer = ResearchEngineer()
    
    # Analyze core areas
    target_dirs = ["admin", "scripts", "content"]
    
    for d in target_dirs:
        print(f"\n--- Analyzing: {d} ---")
        path = os.path.join(project_root, d)
        if os.path.exists(path):
            innovation_suggestions = engineer.analyze_repo_for_innovations(path)
            print(innovation_suggestions)
        else:
            print(f"Directory {d} not found.")

if __name__ == "__main__":
    run_audit()
