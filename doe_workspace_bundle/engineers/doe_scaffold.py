import os
import shutil
import logging
import json
from datetime import datetime

logger = logging.getLogger("DOE_Scaffold")

class DOEScaffold:
    """
    DOE Scaffold Tool - "Directing Oriented Execution" Workspaces
    Packages the agentic framework for handover and cloud scaling.
    Inspired by Nick Saraev & Nate Herk principles.
    """
    
    def __init__(self, project_root: str):
        self.root = project_root
        self.bundle_dir = os.path.join(self.root, "doe_workspace_bundle")

    def create_bundle(self):
        """Creates a portable bundle of the Directing Framework."""
        if os.path.exists(self.bundle_dir):
            shutil.rmtree(self.bundle_dir)
        
        os.makedirs(self.bundle_dir)
        
        logger.info(f"Creating DOE bundle at {self.bundle_dir}...")
        
        # 1. Copy Execution Logic (admin/engineers)
        shutil.copytree(
            os.path.join(self.root, "admin/engineers"),
            os.path.join(self.bundle_dir, "engineers")
        )
        
        # 2. Create Missions folder
        os.makedirs(os.path.join(self.bundle_dir, "missions"), exist_ok=True)
        
        # 3. Copy Core Infrastructure (admin/brain/agent_base.py etc)
        # For simplicity, we copy the admin folder but exclude heavy assets
        # We can be more selective later.
        
        # 4. Generate .env.template (The "Vault Ingest" starting point)
        env_template = """# DOE Framework - Vault Ingest Template
# Fill in your own keys below to activate your Sovereign Agents.

GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-2.0-flash-exp

# Optional: Add other provider keys
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
"""
        with open(os.path.join(self.bundle_dir, ".env.template"), "w") as f:
            f.write(env_template)
            
        # 5. Create README_HANDOVER.md (The "Definition of Done" & User Guide)
        readme = f"""# DOE Framework: Handover Guide
Created: {datetime.now().strftime('%Y-%m-%d')}

## 🚀 One-Click Scaling
You have been given a Sovereign Directing Workspace. 

### Setup
1. **Vault Ingest**: Copy `.env.template` to `.env` and add your API keys.
2. **Environment**: Run `pip install -r requirements.txt` (packaged in engineers/).
3. **Launch**: Open the dashboard to see your agents come online.

### Framework Structure
- `engineers/`: The agents (Director, Antigravity, Operator).
- `missions/`: Place your high-level directives (.md or .json) here.
- `Mission Control`: The UI surface for real-time visibility.

---
*Stay Sovereign. Direct, don't type.*
"""
        with open(os.path.join(self.bundle_dir, "README_HANDOVER.md"), "w") as f:
            f.write(readme)
            
        logger.info("DOE Bundle complete.")
        return self.bundle_dir

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
    scaffold = DOEScaffold(root)
    scaffold.create_bundle()
