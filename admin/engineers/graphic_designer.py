
import os
import logging
import subprocess
import time
from ..config import config

logger = logging.getLogger("GraphicDesigner")

class GraphicDesigner:
    """
    The Graphic Designer agent specializes in automating Adobe Photoshop
    using ExtendScript (JavaScript) to create thumbnails, edit images, and mockups.
    """
    
    def __init__(self):
        # Default path on standard macOS install
        self.app_name = "Adobe Photoshop 2024"
        
        # Verify app exists in /Applications (heuristic)
        base_apps = "/Applications"
        self.app_path = None
        for year in ["2025", "2024", "2023", "2022", "2021"]:
            path = f"{base_apps}/Adobe Photoshop {year}/Adobe Photoshop {year}.app"
            if os.path.exists(path):
                self.app_path = path
                self.app_name = f"Adobe Photoshop {year}"
                break
        
        if not self.app_path:
             logger.warning("Adobe Photoshop application not found. Script execution might fail.")

    def generate_script(self, task_description):
        """
        Generates an Adobe ExtendScript (.jsx) for Photoshop.
        """
        try:
            import google.generativeai as genai
            
            if not config.GEMINI_API_KEY:
                logger.error("Gemini API Key missing.")
                return None
                
            genai.configure(api_key=config.GEMINI_API_KEY)
            model = genai.GenerativeModel(config.GEMINI_MODEL)
            
            prompt = f"""
            You are an expert Adobe Photoshop scripter.
            Write an ExtendScript (JavaScript ES3) file to accomplish the following task:
            "{task_description}"
            
            Context:
            - Target Application: Adobe Photoshop
            - Object Model: app.activeDocument, app.documents.add(), etc.
            - Language: ExtendScript
            - Unit System: RulerUnits.PIXELS usually preferred for web/video.
            
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
            logger.error(f"Failed to generate Photoshop script: {e}")
            return None

    def execute_script(self, script_content):
        """
        Runs the provided ExtendScript in Photoshop using osascript (AppleScript).
        This is more reliable than 'open file.jsx' as it runs synchronously.
        """
        if not self.app_path:
            logger.error("Photoshop app not found.")
            return False
            
        try:
            # Escape the script content for AppleScript string
            # We need to escape backslashes and double quotes
            safe_script = script_content.replace("\\", "\\\\").replace('"', '\\"')
            
            # Construct AppleScript command
            # tell application "Adobe Photoshop 2025" to do javascript "..."
            applescript_cmd = f'tell application "{self.app_name}" to do javascript "{safe_script}"'
            
            logger.info(f"Executing script via AppleScript in {self.app_name}...")
            
            # Run osascript
            process = subprocess.run(
                ["osascript", "-e", applescript_cmd], 
                capture_output=True, 
                text=True
            )
            
            if process.returncode != 0:
                logger.error(f"AppleScript error: {process.stderr}")
                return False
                
            logger.info("Script executed successfully.")
            return True
            
        except Exception as e:
            logger.error(f"Failed to execute Photoshop script: {e}")
            return False

    def create_thumbnail(self, title, background_path=None, output_path="thumbnail.jpg"):
        """
        High-level skill: Generates a YouTube-style thumbnail.
        """
        prompt = f"""
        // IMPORTANT: Suppress all dialogs to run autonomously
        app.displayDialogs = DialogModes.NO;

        Create a 1920x1080px document (72dpi).
        {f'Open and place "{background_path}" as the background layer.' if background_path else 'Fill background with specific solid Dark Blue (RGB: 20, 30, 60). Use doc.selection.fill() if possible.'}
        Add a text layer with content "{title}".
        Font: Impact or Arial-Bold, Size: 150px, Color: White.
        // Simplified centering logic
        doc.selection.selectAll();
        textLayer.textItem.position = Array(960, 540); // Rough center
        // Align layers to selection if possible, otherwise rely on manual position
        doc.selection.deselect();
        
        // Save logic
        Save for Web as JPEG (High Quality) to "{output_path}".
        Ensure you create a File object for the output path.
        Use ExportOptionsSaveForWeb with quality 60.
        doc.exportDocument(File("{output_path}"), ExportType.SAVEFORWEB, options);
        doc.close(SaveOptions.DONOTSAVECHANGES); // Close without saving project
        """
        
        item = self.generate_script(prompt)
        if item:
            return self.execute_script(item)
        return False
