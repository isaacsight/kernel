
import os
import logging
import subprocess
import time
from ..config import config

logger = logging.getLogger("MotionDesigner")

class MotionDesigner:
    """
    The Motion Designer agent specializes in automating Adobe After Effects
    using ExtendScript (JavaScript) to create high-quality motion graphics.
    """
    
    def __init__(self):
        # Default path on standard macOS install; ideally customizable via ENV
        self.ae_path = os.environ.get("AFTER_EFFECTS_PATH", "/Applications/Adobe After Effects 2024/aerender")
        # For scripting, we might need 'After Effects.app' executable to run scripts interactively
        # or use 'aerender' for rendering.
        # To run a script: "/Applications/Adobe After Effects 2024/Adobe After Effects 2024.app/Contents/MacOS/After Effects" -r /path/to/script.jsx
        
        # Heuristic to find the app executable if generic path is used
        if not os.path.exists(self.ae_path):
             # Try 2023, 2025, etc.?
             # For now, let's look for the main app bundle for script execution
             base_apps = "/Applications"
             for year in ["2025", "2024", "2023", "2022"]:
                 app_path = f"{base_apps}/Adobe After Effects {year}/Adobe After Effects {year}.app/Contents/MacOS/After Effects"
                 if os.path.exists(app_path):
                     self.ae_executable = app_path
                     break
             else:
                 self.ae_executable = None
                 logger.warning("Adobe After Effects executable not found. Script execution will fail.")
        else:
            self.ae_executable = self.ae_path

    def generate_script(self, task_description, project_file=None):
        """
        Generates an Adobe ExtendScript (.jsx) based on the task description.
        """
        try:
            import google.generativeai as genai
            
            if not config.GEMINI_API_KEY:
                logger.error("Gemini API Key missing.")
                return None
                
            genai.configure(api_key=config.GEMINI_API_KEY)
            model = genai.GenerativeModel(config.GEMINI_MODEL)
            
            prompt = f"""
            You are an expert Adobe After Effects scripter.
            Write an ExtendScript (JavaScript ES3) file to accomplish the following task:
            "{task_description}"
            
            Context:
            - Target Application: Adobe After Effects
            - Language: ExtendScript (based on ECMA-262 3rd Edition)
            - If 'project_file' is provided, the script should open it or work within the active project.
            - {f'Project File: {project_file}' if project_file else 'Create a new project'}
            
            Requirements:
            - Wrap the code in an IIFE or function to avoid polluting global scope.
            - Include comments explaining the steps.
            - Handle errors gracefully (try/catch).
            - DO NOT begin with ```javascript or markdown code blocks. Return ONLY the raw code.
            - If creating a comp, use standard 1920x1080 30fps unless specified.
            """
            
            response = model.generate_content(prompt)
            script_content = response.text.replace("```javascript", "").replace("```", "").strip()
            
            return script_content
            
        except Exception as e:
            logger.error(f"Failed to generate AE script: {e}")
            return None

    def execute_script(self, script_content):
        """
        Saves and runs the provided ExtendScript in After Effects.
        """
        if not self.ae_executable:
            logger.error("After Effects executable not configured.")
            return False
            
        try:
            # Save script to temp file
            script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "temp_ae_script.jsx"))
            with open(script_path, "w") as f:
                f.write(script_content)
                
            logger.info(f"Executing script via {self.ae_executable}...")
            
            # Command: [AE Executable] -r [Script Path]
            # -r flag runs the script without showing UI if possible, or just runs it.
            cmd = [self.ae_executable, "-r", script_path]
            
            # We run this in background because AE provides no stdout feedback usually and might hang if we wait
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            # Wait a bit to ensure it started
            time.sleep(2)
            
            if process.poll() is not None:
                # It exited immediately?
                out, err = process.communicate()
                logger.info(f"AE Process exited. Out: {out}, Err: {err}")
            else:
                 logger.info("Script sent to After Effects. Check the application.")
                 
            return True
            
        except Exception as e:
            logger.error(f"Failed to execute script: {e}")
            return False

    def create_kinetic_typography(self, text, output_project="kinetic_text.aep"):
        """
        High-level skill: Generates a kinetic typography sequence.
        """
        prompt = f"""
        Create a kinetic typography composition for the text: "{text}".
        1. Create a HD Composition (1920x1080, 30fps, 10s).
        2. Create a text layer with the content "{text}".
        3. Center the text.
        4. Animate the Scale from 0% to 100% over the first 1 second with an overshoot/elastic expression.
        5. Animate the Opacity from 0 to 100 over the first 0.5s.
        6. Save the project to "{output_project}" (if possible via script, otherwise just alert).
        """
        
        item = self.generate_script(prompt)
        if item:
            return self.execute_script(item)
        return False
