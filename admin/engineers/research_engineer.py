import os
import json
import time
import glob
import logging
import google.generativeai as genai
from typing import List, Dict, Optional, Any
import sys

# Ensure project root is in path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if project_root not in sys.path:
    sys.path.append(project_root)

from admin.config import config
from admin.brain.agent_base import BaseAgent
from admin.brain.research_utils import log_activity, update_activity

logger = logging.getLogger("ResearchEngineer")

class ResearchEngineer(BaseAgent):
    """
    The Research Engineer.
    Mimics a GitHub Next researcher: searches for innovation, drafts RFCs, and builds prototypes.
    """
    def __init__(self):
        super().__init__(agent_id="research_engineer")
        
        # Configure Gemini
        api_key = config.GEMINI_API_KEY
        if not api_key:
            logger.warning("[ResearchEngineer] GEMINI_API_KEY not found. Agent capabilities limited.")
        else:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(config.GEMINI_MODEL)
            
        self.prototypes_dir = os.path.join(config.BASE_DIR, "admin", "prototypes")
        self.papers_dir = os.path.join(config.BASE_DIR, "admin", "docs", "research_papers")
        
        # Ensure directories exist
        os.makedirs(self.prototypes_dir, exist_ok=True)
        os.makedirs(self.papers_dir, exist_ok=True)

    def conduct_research(self, topic: str) -> str:
        """
        Conducts 'deep research' (simulated via LLM knowledge) on a topic.
        """
        logger.info(f"[{self.name}] Researching topic: {topic}")
        
        aid = log_activity("research", f"Research into {topic}", agents=[self.name])
        
        prompt = f"""
        You are an expert Research Engineer at GitHub Next.
        Topic: {topic}
        
        Task: Provide a comprehensive technical summary of this topic. 
        Focus on:
        1. State of the Art (SOTA) approaches.
        2. Relevant libraries or tools (Python preferred).
        3. Potential applications in a "Studio OS" (a high-tech creative operating system).
        
        Format: detailed Markdown.
        """
        
        try:
            response = self.model.generate_content(prompt)
            result = response.text
            update_activity(aid, status="completed", event="Deep research completed.")
            return result
        except Exception as e:
            update_activity(aid, status="failed", event=f"Research failed: {e}")
            return f"Research failed: {e}"

    def analyze_repo_for_innovations(self, target_dir: str = ".") -> str:
        """
        Scans a directory (listing files) and suggests 3 innovative improvements.
        """
        logger.info(f"[{self.name}] Analyzing repo at {target_dir}...")
        
        # List files (non-recursive or limited depth for safety)
        files = []
        try:
            for root, _, filenames in os.walk(target_dir):
                if ".git" in root or "__pycache__" in root:
                    continue
                for filename in filenames:
                    if filename.endswith(('.py', '.md', '.json', '.yaml')):
                        files.append(os.path.join(root, filename))
                if len(files) > 50: # Limit context
                    break
        except Exception as e:
            return f"Failed to read repo: {e}"
            
        file_list_str = "\n".join(files[:50])
        
        prompt = f"""
        You are auditing the following file structure for a proactive engineering team.
        
        FILES:
        {file_list_str}
        
        TASK:
        Suggest 3 concrete, innovative engineering improvements. 
        Focus on "Agentic Workflows", "Automation", or "Developer Experience".
        
        Format:
        1. **[Title]**: Description of improvement.
        2. ...
        """
        
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Analysis failed: {e}"

    def draft_rfc(self, title: str, high_level_idea: str) -> str:
        """
        Drafts a formal RFC (Request for Comments) and saves it to admin/docs/research_papers.
        """
        safe_title = title.lower().replace(" ", "_").replace("/", "-")
        filename = f"{safe_title}.md"
        filepath = os.path.join(self.papers_dir, filename)
        
        aid = log_activity("rfc", f"Drafting RFC: {title}", agents=[self.name])
        
        prompt = f"""
        Write a formal "RFC" (Request for Comments) research paper.
        
        Title: {title}
        Context: {high_level_idea}
        
        Structure:
        - Abstract
        - Motivation
        - Proposed Design
        - Drawbacks / Alternatives
        - Unresolved Questions
        
        Tone: Academic but practical (like a high-quality engineering blog post).
        """
        
        try:
            response = self.model.generate_content(prompt)
            content = response.text
            
            # Add metadata
            final_content = f"---\ntitle: {title}\ndate: {time.strftime('%Y-%m-%d')}\nstatus: proposed\n---\n\n{content}"
            
            with open(filepath, 'w') as f:
                f.write(final_content)
            
            update_activity(aid, status="completed", event=f"RFC created at {filepath}.", artifact=filepath)
            return f"RFC created at: {filepath}"
        except Exception as e:
            update_activity(aid, status="failed", event=f"RFC drafting failed: {e}")
            return f"Failed to draft RFC: {e}"

    def prototype_feature(self, idea: str, filename: str) -> str:
        """
        Generates a standalone Python prototype script.
        """
        if not filename.endswith(".py"):
            filename += ".py"
            
        filepath = os.path.join(self.prototypes_dir, filename)
        
        prompt = f"""
        Write a standalone Python script to demonstrate the following idea.
        Idea: {idea}
        
        Requirements:
        - Must be a single file.
        - Must run independently (if it needs libraries, list them in top comment).
        - Include a `if __name__ == "__main__":` block to demonstrate functionality.
        - Focus on "Proof of Concept" quality - messy but working.
        
        Output ONLY the code (in markdown code block or plain text).
        """
        
        try:
            response = self.model.generate_content(prompt)
            content = response.text
            
            # Strip markdown
            if "```python" in content:
                content = content.split("```python")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            with open(filepath, 'w') as f:
                f.write(content.strip())
                
            return f"Prototype created at: {filepath}"
        except Exception as e:
            return f"Failed to create prototype: {e}"

if __name__ == "__main__":
    # Smoke Test
    engineer = ResearchEngineer()
    print("Research Engineer Initialized.")
    print(engineer.conduct_research("Agentic patterns in 2025"))
