
import os
import logging
import subprocess
import time
from ..config import config

logger = logging.getLogger("VideoEditor")

class VideoEditor:
    """
    The Video Editor agent specializes in automating Adobe Premiere Pro
    using ExtendScript (JavaScript) to create video edits and sequences.
    """
    
    def __init__(self):
        # Default path on standard macOS install
        # Unlike AE, Premiere doesn't have a command line tool like 'aerender' easily accessible.
        # We rely on 'open -a ...' to launch the script.
        self.app_name = "Adobe Premiere Pro 2024" 
        
        # Verify app exists in /Applications (heuristic)
        base_apps = "/Applications"
        self.app_path = None
        for year in ["2025", "2024", "2023", "2022"]:
            path = f"{base_apps}/Adobe Premiere Pro {year}/Adobe Premiere Pro {year}.app"
            if os.path.exists(path):
                self.app_path = path
                self.app_name = f"Adobe Premiere Pro {year}"
                break
        
        if not self.app_path:
             logger.warning("Adobe Premiere Pro application not found. Script execution might fail.")

    def generate_script(self, task_description):
        """
        Generates an Adobe ExtendScript (.jsx) for Premiere Pro.
        """
        try:
            import google.generativeai as genai
            
            if not config.GEMINI_API_KEY:
                logger.error("Gemini API Key missing.")
                return None
                
            genai.configure(api_key=config.GEMINI_API_KEY)
            model = genai.GenerativeModel(config.GEMINI_MODEL)
            
            prompt = f"""
            You are an expert Adobe Premiere Pro scripter.
            Write an ExtendScript (JavaScript ES3) file to accomplish the following task:
            "{task_description}"
            
            Context:
            - Target Application: Adobe Premiere Pro
            - Object Model: app.project, app.project.activeSequence, etc.
            - Language: ExtendScript
            
            Requirements:
            - Wrap the code in an IIFE.
            - Include comments.
            - DO NOT begin with ```javascript. Return ONLY the raw code.
            - If importing files, assume they exist at the provided paths (or ask to be provided).
            """
            
            response = model.generate_content(prompt)
            script_content = response.text.replace("```javascript", "").replace("```", "").strip()
            
            return script_content
            
        except Exception as e:
            logger.error(f"Failed to generate Premiere script: {e}")
            return None

    def execute_script(self, script_content):
        """
        Runs the provided ExtendScript in Premiere Pro.
        """
        if not self.app_path:
            logger.error("Premiere Pro app not found.")
            return False
            
        try:
            # Save script to temp file
            script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "temp_premiere_script.jsx"))
            with open(script_path, "w") as f:
                f.write(script_content)
                
            logger.info(f"Opening script in {self.app_name}...")
            
            # Command: open -a "Adobe Premiere Pro 2024" /path/to/script.jsx
            cmd = ["open", "-a", self.app_path, script_path]
            
            subprocess.run(cmd, check=True)
            
            logger.info("Script sent to Premiere Pro (User may need to confirm execution).")
            return True
            
        except Exception as e:
            logger.error(f"Failed to execute Premiere script: {e}")
            return False

    def assemble_clips(self, file_paths, sequence_name="New Assembly"):
        """
        High-level skill: Import clips and place them on a timeline.
        """
        paths_js = str(file_paths).replace("'", '"') # Formatting for JS array
        
        prompt = f"""
        Create a new sequence named "{sequence_name}".
        Import the following video files: {paths_js}.
        Add them sequentially to the Video 1 track of the new sequence.
        """
        
        item = self.generate_script(prompt)
        if item:
            return self.execute_script(item)
        return False
