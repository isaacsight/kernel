import sys
import os

# Add parent directory to path to import admin modules
sys.path.append(os.getcwd())

from admin.engineers.github_researcher import GitHubResearcher

def test_researcher():
    print("Initializing GitHub Researcher...")
    researcher = GitHubResearcher()
    
    print("Running Scout Mission...")
    results = researcher.scout_fun_projects()
    
    if results:
        print("\n[SUCCESS] Scout mission completed successfully.")
        total_repos = sum(len(repos) for repos in results.values())
        print(f"Found {total_repos} interesting repositories across {len(results)} categories.")
    else:
        print("\n[FAILURE] Scout mission returned no results.")

if __name__ == "__main__":
    test_researcher()
