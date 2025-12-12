import sys
import os
import json

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.github_researcher import GitHubResearcher
from rich.console import Console
from rich.panel import Panel

def run_research():
    console = Console()
    researcher = GitHubResearcher()
    
    console.print(Panel.fit("[bold cyan]Deep Research: Studio OS Improvements[/bold cyan]"))
    
    topics = [
        ("Prompt Engineering Tools", "prompt engineering tool language:python sort:stars"),
        ("Advanced Agent Frameworks", "agent framework language:python sort:stars"),
        ("Prompt Optimization", "prompt optimization language:python"),
        ("Generative UI Design", "generative ui design"),
        ("LLM Observability", "llm observability language:python")
    ]
    
    all_findings = {}
    
    for title, query in topics:
        console.print(f"\n[bold yellow]Searching for: {title}...[/bold yellow]")
        # Increasing limit to get a good spread
        repos = researcher.search_repos(query, limit=5)
        researcher.display_results(title, repos)
        
        # Save simplified data
        all_findings[title] = [
            {
                "name": r["name"],
                "url": r["html_url"],
                "desc": r["description"],
                "stars": r["stargazers_count"]
            } 
            for r in repos
        ]
        
    # Save report
    with open("github_research_results.json", "w") as f:
        json.dump(all_findings, f, indent=2)
        
    console.print("\n[bold green]Research Complete! Saved to github_research_results.json[/bold green]")

if __name__ == "__main__":
    run_research()
