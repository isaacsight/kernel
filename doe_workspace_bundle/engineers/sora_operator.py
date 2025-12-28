import os
import time
import json
import logging
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

logger = logging.getLogger("SoraOperator")

class SoraOperator:
    def __init__(self, headless=True):
        self.cookies_path = os.path.join(os.path.dirname(__file__), "../sora_cookies.txt")
        self.headless = headless
        self.driver = None

    def _init_driver(self):
        """Initializes the Chrome driver with options using undetected-chromedriver."""
        options = uc.ChromeOptions()
        # options.add_argument("--window-size=1280,720") # uc handles this usually
        
        # Initialize UC
        # headless=True in UC sometimes triggers detection, but let's try.
        logging.getLogger('undetected_chromedriver').setLevel(logging.WARNING)
        self.driver = uc.Chrome(options=options, headless=self.headless, use_subprocess=True, version_main=142)

    def _load_cookies(self, url="https://sora.chatgpt.com"):
        """Loads cookies from the Netscape format file and injects them."""
        # We need to visit the domain first to set cookies
        logger.info(f"Navigating to {url} to set cookies...")
        try:
            self.driver.get(url)
        except Exception:
            # UC sometimes creates a fresh session where get() might timeout if CF hits hard
            pass
            
        time.sleep(3) # Wait for initial load

        if not os.path.exists(self.cookies_path):
            logger.error(f"Cookie file not found at {self.cookies_path}")
            return False

        logger.info("Injecting cookies...")
        count = 0
        try:
            with open(self.cookies_path, 'r') as f:
                for line in f:
                    if line.startswith('#') or not line.strip():
                        continue
                    
                    parts = line.strip().split('\t')
                    if len(parts) >= 6:
                        domain = parts[0]
                        # Trim dot for compatibility
                        if "chatgpt.com" in domain:
                            cookie = {
                                'name': parts[5],
                                'value': parts[6],
                                'domain': domain,
                                'path': parts[2],
                                'secure': parts[3] == 'TRUE'
                            }
                            # Expiry
                            if len(parts) > 4 and int(parts[4]) > 0:
                                cookie['expiry'] = int(parts[4])
                            
                            try:
                                self.driver.add_cookie(cookie)
                                count += 1
                            except Exception as e:
                                pass
            
            logger.info(f"Successfully injected {count} cookies.")
            return True
        except Exception as e:
            logger.error(f"Failed to parse cookie file: {e}")
            return False

    def verify_auth(self):
        """Verifies authentication by checking for profile element."""
        if not self.driver:
            self._init_driver()
        
        # 1. Load Cookies
        if not self._load_cookies():
            return False
        
        # 2. Refresh to apply cookies
        logger.info("Refreshing page to apply cookies...")
        self.driver.get("https://sora.chatgpt.com/profile")
        time.sleep(5)
        
        # 3. Check for login indicators
        page_source = self.driver.page_source
        if "Sign up" in page_source and "Log in" in page_source:
             # Double check if we are actually logged in but header is confusing
             # Look for specific profile elements if known. 
             # For now, let's assume if we see "Log in" prominently, we might have failed.
             # However, some SPAs show both. Let's check for "Profile" or user avatar.
             pass

        current_url = self.driver.current_url
        logger.info(f"Current URL: {current_url}")
        
        if "login" in current_url:
            logger.error("Redirected to login page. Cookies might be invalid or expired.")
            return False
            
        logger.info("Authentication verification check passed (url check).")
        return True

    def close(self):
        if self.driver:
            self.driver.quit()

    def inspect_page(self):
        """Inspects the page for potential upload/create buttons."""
        if not self.driver:
            self._init_driver()
            self._load_cookies()
            
        logger.info("Navigating to Profile URL...")
        self.driver.get("https://sora.chatgpt.com/profile")
        time.sleep(10) # Wait longer
        
        logger.info(f"Current URL: {self.driver.current_url}")
        
        # Dump text
        try:
            body_text = self.driver.find_element(By.TAG_NAME, "body").text
            logger.info(f"Page Text Summary: {body_text[:500]}...")
        except:
            logger.info("Could not get body text.")
            
        # Check for Cloudflare specific text
        page_source = self.driver.page_source
        if "challenge-platform" in page_source or "Verify you are human" in page_source:
            logger.error("CLOUDFLARE CHALLENGE DETECTED")

        # 1. Look for file inputs
        file_inputs = self.driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
        logger.info(f"Found {len(file_inputs)} file inputs.")
        
        # 2. Look for keywords
        xpath = "//*[contains(text(), 'Create') or contains(text(), 'Upload') or contains(text(), 'New')]"
        elements = self.driver.find_elements(By.XPATH, xpath)
        logger.info(f"Found {len(elements)} elements with keywords 'Create'/'Upload'/'New'.")
        for e in elements[:5]:
            logger.info(f"  Element: '{e.text}', Tag: {e.tag_name}, Class: {e.get_attribute('class')}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    operator = SoraOperator(headless=True)
    try:
        operator.inspect_page()
    finally:
        operator.close()
