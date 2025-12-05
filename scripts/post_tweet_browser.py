
import time
import os
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def parse_netscape_cookies(cookie_file):
    cookies = []
    with open(cookie_file, 'r') as f:
        for line in f:
            if line.startswith('#') or not line.strip():
                continue
            parts = line.strip().split('\t')
            if len(parts) >= 7:
                domain = parts[0]
                # Filter for twitter/x cookies
                if 'twitter.com' in domain or 'x.com' in domain:
                    cookie = {
                        'domain': domain,
                        'name': parts[5],
                        'value': parts[6],
                        'path': parts[2],
                        'secure': parts[3] == 'TRUE',
                        # Expiry is optional for Selenium sometimes, but good to have
                        #'expiry': int(parts[4]) 
                    }
                    cookies.append(cookie)
    return cookies

def main():
    cookie_path = os.path.abspath("admin/cookies.txt")
    if not os.path.exists(cookie_path):
        print(f"Error: {cookie_path} not found.")
        return

    print("Parsing cookies...")
    cookies = parse_netscape_cookies(cookie_path)
    if not cookies:
        print("No Twitter/X cookies found in admin/cookies.txt")
        print("Please export your cookies from your browser (using 'Get cookies.txt' extension) and save them to admin/cookies.txt")
        return
    
    print(f"Found {len(cookies)} related cookies.")

    options = Options()
    # options.add_argument("--headless=new") # Comment out for debugging
    options.add_argument("--window-size=1280,720")
    
    print("Launching browser...")
    driver = webdriver.Chrome(options=options)
    
    try:
        print("Navigating to x.com...")
        driver.get("https://x.com")
        
        print("Injecting cookies...")
        for cookie in cookies:
            try:
                # Selenium requires domain to match.
                # Sometimes cookies have leading dots which might confuse Selenium if not on that domain.
                # We are on x.com. 
                # If cookie domain is .twitter.com, we might need to add it while on twitter.com?
                # X redirects. Let's try adding generic ones.
                if 'x.com' in cookie['domain'] or 'twitter.com' in cookie['domain']:
                    # Minimal cookie for Selenium
                    c = {
                        'name': cookie['name'],
                        'value': cookie['value'],
                         # 'domain': cookie['domain'] # Let Selenium infer or being strict can fail
                    }
                    driver.add_cookie(c)
            except Exception as e:
                print(f"Warning: Failed to add cookie {cookie['name']}: {e}")

        print("Refreshing to apply cookies...")
        driver.refresh()
        time.sleep(5) 
        
        # Check login
        if "login" in driver.current_url:
            print("❌ Still on login page. Cookies might be invalid or expired.")
        else:
            print("✅ Likely logged in.")
            
            # Compose Tweet
            print("Navigating to compose...")
            driver.get("https://x.com/compose/tweet")
            
            wait = WebDriverWait(driver, 20)
            
            # Find editor
            print("Waiting for editor...")
            # This class selector is fragile and changes often on X. 
            # Trying by aria-label "Post text" usually works.
            editor = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="tweetTextarea_0"]')))
            editor.click()
            editor.send_keys("Test tweet from Studio OS (Browser Automation) 🤖")
            
            time.sleep(2)
            
            # Click Post
            print("Clicking Post...")
            post_button = driver.find_element(By.CSS_SELECTOR, '[data-testid="tweetButton"]')
            # post_button.click() 
            print("⚠️ Not clicking POST yet, just verifying UI interaction works.")
            
    except Exception as e:
        print(f"Error: {e}")
        # driver.save_screenshot("debug_error.png")
    finally:
        print("Closing browser...")
        driver.quit()

if __name__ == "__main__":
    main()
