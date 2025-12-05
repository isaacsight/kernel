import requests
import json
from rich.console import Console
from rich.table import Table
from rich.markdown import Markdown
from rich.panel import Panel

class GitHubResearcher:
    def __init__(self):
        self.base_url = "https://api.github.com"
        self.console = Console()

    def search_repos(self, query, sort="stars", order="desc", limit=10):
        """
        Search for repositories on GitHub.
        """
        url = f"{self.base_url}/search/repositories"
        params = {
            "q": query,
            "sort": sort,
            "order": order,
            "per_page": limit
        }
        
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data.get("items", [])
        except requests.exceptions.RequestException as e:
            self.console.print(f"[bold red]Error searching GitHub:[/bold red] {e}")
            return []

    def display_results(self, title, repos):
        """
        Display search results in a rich table.
        """
        if not repos:
            self.console.print(f"[yellow]No results found for {title}[/yellow]")
            return

        table = Table(title=title, show_header=True, header_style="bold magenta")
        table.add_column("Name", style="cyan", no_wrap=True)
        table.add_column("Stars", style="green")
        table.add_column("Language", style="blue")
        table.add_column("Description", style="white")
        table.add_column("URL", style="dim")

        for repo in repos:
            name = repo.get("name")
            stars = str(repo.get("stargazers_count"))
            language = repo.get("language") or "N/A"
            description = repo.get("description") or "No description"
            # Truncate description if too long
            if len(description) > 50:
                description = description[:47] + "..."
            url = repo.get("html_url")
            
            table.add_row(name, stars, language, description, url)

        self.console.print(table)
        self.console.print("\n")

    def scout_fun_projects(self):
        """
        Scout for fun and interesting projects based on keywords.
        """
        topics = [
            ("Creative Coding Python", "topic:creative-coding language:python"),
            ("Terminal UIs", "topic:tui language:python"),
            ("Generative Art", "topic:generative-art"),
            ("Fun Scripts", "fun scripts language:python"),
            ("Manim Extensions", "manim extension"),
            ("ASCII Art", "ascii art language:python")
        ]

        self.console.print(Panel.fit("[bold green]Begin Scout Mission: Fun & Interesting Repos[/bold green]"))

        all_findings = {}

        for title, query in topics:
            self.console.print(f"[bold]Scouting:[/bold] {title}...")
            repos = self.search_repos(query, limit=5)
            self.display_results(title, repos)
            all_findings[title] = repos
            
        return all_findings

if __name__ == "__main__":
    researcher = GitHubResearcher()
    researcher.scout_fun_projects()
