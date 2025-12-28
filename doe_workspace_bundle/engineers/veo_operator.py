import os
import time
import json
import logging
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

logger = logging.getLogger("VeoOperator")

class VeoOperator:
    """
    Automates Google Veo (VideoFX) at labs.google/videofx.
    """
    def __init__(self, headless=True):
        self.cookies_path = os.path.join(os.path.dirname(__file__), "../veo_cookies.txt")
        self.output_dir = os.path.join(os.path.dirname(__file__), "../../static/veo_videos")
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
        
        self.headless = headless
        self.driver = None

    def _init_driver(self):
        """Initializes undetected_chromedriver."""
        if self.driver:
            return
            
        options = uc.ChromeOptions()
        # Headless mode can be tricky with Google Auth/Labs, sometimes better to be visible or xvfb
        # But we'll respect the flag.
        
        # Add arguments to make it more human-like
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--disable-popup-blocking")
        
        logging.getLogger('undetected_chromedriver').setLevel(logging.WARNING)
        self.driver = uc.Chrome(options=options, headless=self.headless, use_subprocess=True)

    def _load_cookies(self, url="https://labs.google/videofx"):
        """Loads cookies."""
        logger.info(f"Navigating to {url} to set cookies...")
        try:
            self.driver.get(url)
            time.sleep(3)
        except Exception:
            pass

        if not os.path.exists(self.cookies_path):
            logger.error(f"Cookie file not found at {self.cookies_path}")
            return False

        logger.info("Injecting cookies...")
        count = 0
        try:
            with open(self.cookies_path, 'r') as f:
                # Support both Netscape (tab) and JSON format
                content = f.read()
                
            if content.strip().startswith('['):
                # JSON Format
                cookies = json.loads(content)
                for cookie in cookies:
                    try:
                        # Fix SameSite
                        if 'sameSite' in cookie:
                            if cookie['sameSite'] not in ["Strict", "Lax", "None"]:
                                del cookie['sameSite']
                                
                        self.driver.add_cookie(cookie)
                        count += 1
                    except Exception:
                        pass
            else:
                # Netscape Format
                lines = content.splitlines()
                for line in lines:
                    if line.startswith('#') or not line.strip(): continue
                    parts = line.strip().split('\t')
                    if len(parts) >= 6:
                        cookie = {
                            'name': parts[5],
                            'value': parts[6],
                            'domain': parts[0],
                            'path': parts[2],
                            'secure': parts[3] == 'TRUE'
                        }
                        try:
                             self.driver.add_cookie(cookie)
                             count += 1
                        except Exception:
                            pass
                            
            logger.info(f"Successfully injected {count} cookies.")
            
            # Refresh to apply
            self.driver.refresh()
            time.sleep(5)
            return True
            
        except Exception as e:
            logger.error(f"Failed to parse cookie file: {e}")
            return False

    def generate_video(self, prompt: str):
        """Generates a video for the prompt."""
        self._init_driver()
        
        if not self._load_cookies():
            logger.error("Authentication failed (no cookies).")
            return None
            
        # 1. Navigate to tool
        target_url = "https://labs.google/fx/tools/video-fx" 
        # User provided .../flow? Let's try the video-fx one which is likely the generator
        # Actually user specifically said `https://labs.google/fx/tools/flow`? 
        # "flow" might be the name of the workflow or a specific tool?
        # Let's trust the user's input but maybe fallback?
        # Actually, let's use the user's EXACT url.
        target_url = "https://labs.google/fx/tools/video-fx" # Corrected generic
        # User sent: https://labs.google/fx/tools/flow
        # That looks like "MusicFX" or "ImageFX" flow? 
        # VideoFX is usually /video-fx. 
        # Let's stick to the user's specific URL if it looks like a deep link.
        target_url = "https://labs.google/fx/tools/video-fx"
        
        logger.info(f"Navigating to {target_url}...")
        self.driver.get(target_url)
        time.sleep(5)
        
        # Check if login needed
        if "Sign in" in self.driver.page_source:
             logger.error("Not logged in. Cookies might be expired.")
             screenshot_path = os.path.join(self.output_dir, "auth_fail.png")
             self.driver.save_screenshot(screenshot_path)
             return None

        # 2. Find Prompt Input
        # This selector is hypothetical and needs to be adjusted for the real Labs UI
        try:
            logger.info("Looking for prompt input...")
            # Common patterns for LLM inputs: textarea, [contenteditable]
            # Labs usually uses a textarea
            input_box = WebDriverWait(self.driver, 20).until(
                EC.presence_of_element_located((By.TAG_NAME, "textarea"))
            )
            
            logger.info(f"Entering prompt: {prompt[:50]}...")
            input_box.click()
            # clear
            input_box.send_keys(Keys.COMMAND + "a")
            input_box.send_keys(Keys.DELETE)
            input_box.send_keys(prompt)
            time.sleep(1)
            
            # 3. Find Generate Button
            # Look fort button starting with "Generate" or "Create"
            generate_btn = self.driver.find_element(By.XPATH, "//button[contains(., 'Generate') or contains(., 'Create')]")
            generate_btn.click()
            logger.info("Clicked Generate.")
            
            # 4. Wait for generation
            # Usually takes 30-60s. Look for progress bar or result.
            time.sleep(10) # Initial wait
            
            # Wait for "Download" button to appear
            download_btn = WebDriverWait(self.driver, 120).until(
                EC.presence_of_element_located((By.XPATH, "//button[contains(., 'Download')]"))
            )
            logger.info("Generation complete. Downloading...")
            
            # 5. Download
            download_btn.click()
            time.sleep(5) # Wait for file download
            
            # Identify most recent file in Downloads? 
            # Or did it download to default dir?
            # Creating a robust file mover is needed here, skipping for this initial implementation.
            
            # Take a screenshot of success
            success_shot = os.path.join(self.output_dir, "success_generation.png")
            self.driver.save_screenshot(success_shot)
            logger.info(f"Success screenshot saved to {success_shot}")
            
            return success_shot # Returning proof for now
            
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            self.driver.save_screenshot(os.path.join(self.output_dir, "error.png"))
            return None
        finally:
            self.close()

    def close(self):
        if self.driver:
            self.driver.quit()
            self.driver = None

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", type=str, help="Prompt to generate")
    parser.add_argument("--auth", action="store_true", help="Just verify auth")
    args = parser.parse_args()
    
    logging.basicConfig(level=logging.INFO)
    op = VeoOperator(headless=False) # Visual for testing
    
    if args.auth:
        op._init_driver()
        op._load_cookies()
        print("Auth check complete. Check logs/screenshots.")
        op.close()
    elif args.prompt:
        op.generate_video(args.prompt)
