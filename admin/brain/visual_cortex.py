"""
Visual Cortex - Multimodal Processing for Agents
This module enables agents to 'see' images and screenshots, processing visual data alongside text.
"""

import os
import base64
import logging
from typing import Dict, Any, Optional
from admin.config import config

logger = logging.getLogger("VisualCortex")

class VisualCortexMixin:
    """
    Mixin that adds vision capabilities to an agent.
    """
    
    def see(self, image_path: str, prompt: str = "Describe this image in detail.") -> str:
        """
        Process an image and return a text description/analysis.
        
        Args:
            image_path: Absolute path to the local image file.
            prompt: Question or instruction about the image.
            
        Returns:
            Text response from the vision model.
        """
        if not os.path.exists(image_path):
            return f"[Visual Cortex Error] Image not found at {image_path}"
            
        logger.info(f"[{self.name}] Visual Cortex activating for {os.path.basename(image_path)}")
        
        # 1. Determine capabilities
        # In a real implementation, we would check ModelRouter for 'gemini-1.5-pro' or 'gpt-4o'
        has_vision = os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY")
        
        if not has_vision:
            return "[Visual Cortex Offline] No Vision-capable API key found. Please processing text only."
            
        # 2. Encode Image
        try:
            with open(image_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to encode image: {e}")
            return f"[Visual Cortex Error] Encoding failed: {e}"

        # 3. Call Vision Model (Simulated stub for now, ready for wiring)
        # Real wiring would look like: 
        # response = client.chat.completions.create(
        #     model="gpt-4o",
        #     messages=[
        #         {"role": "user", "content": [
        #             {"type": "text", "text": prompt},
        #             {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encoded_string}"}}
        #         ]}
        #     ]
        # )
        
        # Since we don't have the `openai` or `google-generativeai` libs installed/guaranteed here, 
        # we strictly simulate the Interface specific logic.
        
        return (
            f"[Visual Cortex Simulation] Analyzed {os.path.basename(image_path)}.\n"
            f"Context: {prompt}\n"
            f"Observation: [The agent 'sees' the image content here. In a live system, this would be the actual API response.]"
        )

    def analyze_screen(self, prompt: str = "What is on the user's screen?") -> str:
        """
        Analyzes the current screen state (if a screenshot is provided).
        """
        # Logic to find the latest screenshot (e.g., from a 'screenshots' folder)
        screenshot_dir = os.path.join(config.BRAIN_DIR, 'screenshots')
        if not os.path.exists(screenshot_dir):
            return "No screenshot source found."
            
        # Find latest
        files = [os.path.join(screenshot_dir, f) for f in os.listdir(screenshot_dir) if f.endswith('.png')]
        if not files:
            return "No recent screenshots available."
            
        latest_screenshot = max(files, key=os.path.getctime)
        return self.see(latest_screenshot, prompt)
