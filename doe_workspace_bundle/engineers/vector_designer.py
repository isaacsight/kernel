
import os
import logging
import subprocess
import time
from ..config import config

logger = logging.getLogger("VectorDesigner")

class VectorDesigner:
    """
    The Vector Designer agent specializes in automating Adobe Illustrator
    using ExtendScript (JavaScript) to create vector graphics, logos, and charts.
    """
    
    def __init__(self):
        # Default path on standard macOS install
        self.app_name = "Adobe Illustrator 2024"
        
        # Verify app exists in /Applications (heuristic)
        base_apps = "/Applications"
        self.app_path = None
        for year in ["2025", "2024", "2023", "2022"]:
            path = f"{base_apps}/Adobe Illustrator {year}/Adobe Illustrator {year}.app"
            if os.path.exists(path):
                self.app_path = path
                self.app_name = f"Adobe Illustrator {year}"
                break
        
        if not self.app_path:
             logger.warning("Adobe Illustrator application not found. Script execution might fail.")

    def generate_script(self, task_description):
        """
        Generates an Adobe ExtendScript (.jsx) for Illustrator.
        """
        try:
            import google.generativeai as genai
            
            if not config.GEMINI_API_KEY:
                logger.error("Gemini API Key missing.")
                return None
                
            genai.configure(api_key=config.GEMINI_API_KEY)
            model = genai.GenerativeModel(config.GEMINI_MODEL)
            
            prompt = f"""
            You are an expert Adobe Illustrator scripter.
            Write an ExtendScript (JavaScript ES3) file to accomplish the following task:
            "{task_description}"
            
            Context:
            - Target Application: Adobe Illustrator
            - Object Model: app.activeDocument, app.documents.add(), etc.
            - Language: ExtendScript
            
            Requirements:
            - Wrap the code in an IIFE.
            - Include comments.
            - DO NOT begin with ```javascript. Return ONLY the raw code.
            - Handle errors gracefully.
            """
            
            response = model.generate_content(prompt)
            script_content = response.text.replace("```javascript", "").replace("```", "").strip()
            
            return script_content
            
        except Exception as e:
            logger.error(f"Failed to generate Illustrator script: {e}")
            return None

    def execute_script(self, script_content):
        """
        Runs the provided ExtendScript in Illustrator.
        """
        if not self.app_path:
            logger.error("Illustrator app not found.")
            return False
            
        try:
            # Save script to temp file
            script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "temp_illustrator_script.jsx"))
            with open(script_path, "w") as f:
                f.write(script_content)
                
            logger.info(f"Opening script in {self.app_name}...")
            
            # Command: open -a "Adobe Illustrator 2024" /path/to/script.jsx
            cmd = ["open", "-a", self.app_path, script_path]
            
            subprocess.run(cmd, check=True)
            
            logger.info("Script sent to Illustrator.")
            return True
            
        except Exception as e:
            logger.error(f"Failed to execute Illustrator script: {e}")
            return False
