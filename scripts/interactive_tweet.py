#!/usr/bin/env python3
"""
Interactive Tweet Poster
Run this script to post a tweet using browser automation.
The browser will be visible so you can see what's happening.
"""

import time
import os
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

COOKIE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../admin/cookies.txt"))

def parse_netscape_cookies(cookie_file):
    """Parse Netscape format cookies file."""
    cookies = []
    with open(cookie_file, 'r') as f:
        for line in f:
            if line.startswith('#') or not line.strip():
                continue
            parts = line.strip().split('\t')
            if len(parts) >= 7:
                domain = parts[0]
                if 'twitter.com' in domain or 'x.com' in domain:
                    cookie = {
                        'name': parts[5],
                        'value': parts[6],
                        'domain': domain if domain.startswith('.') else f".{domain}",
                        'path': parts[2],
                        'secure': parts[3] == 'TRUE',
                    }
                    cookies.append(cookie)
    return cookies

def post_tweet(tweet_text):
    """Post a tweet using browser automation."""
    print("=" * 50)
    print("Interactive Tweet Poster")
    print("=" * 50)
    
    if not os.path.exists(COOKIE_PATH):
        print(f"Error: Cookie file not found at {COOKIE_PATH}")
        return False
    
    cookies = parse_netscape_cookies(COOKIE_PATH)
    if not cookies:
        print("No Twitter/X cookies found!")
        return False
    
    print(f"Found {len(cookies)} cookies")
    
    options = Options()
    # options.add_argument("--headless=new")  # Run visible for debugging
    options.add_argument("--window-size=1280,800")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    print("Launching browser...")
    driver = webdriver.Chrome(options=options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    try:
        # First navigate to x.com to set domain
        print("Navigating to x.com...")
        driver.get("https://x.com")
        time.sleep(2)
        
        # Add cookies
        print("Injecting cookies...")
        for cookie in cookies:
            try:
                driver.add_cookie({
                    'name': cookie['name'],
                    'value': cookie['value'],
                    'domain': '.x.com',
                    'path': '/',
                    'secure': cookie['secure']
                })
            except Exception as e:
                print(f"Warning: Could not add cookie {cookie['name']}: {e}")
        
        # Refresh to apply cookies
        print("Refreshing to apply login...")
        driver.get("https://x.com/home")
        time.sleep(5)
        
        # Check if logged in
        if "login" in driver.current_url.lower():
            print("❌ Not logged in. Cookies may be expired.")
            print("Please log in manually in the browser window...")
            input("Press Enter after you've logged in...")
        
        # Navigate to compose
        print("Going to compose...")
        driver.get("https://x.com/compose/tweet")
        time.sleep(3)
        
        wait = WebDriverWait(driver, 20)
        
        # Find the tweet textarea
        print("Looking for text area...")
        textarea = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, '[data-testid="tweetTextarea_0"]')
        ))
        
        # Click and type
        print(f"Typing tweet: {tweet_text}")
        textarea.click()
        time.sleep(0.5)
        textarea.send_keys(tweet_text)
        time.sleep(2)
        
        # Find and click post button
        print("Finding post button...")
        post_button = wait.until(EC.element_to_be_clickable(
            (By.CSS_SELECTOR, '[data-testid="tweetButton"]')
        ))
        
        print("Clicking Post...")
        post_button.click()
        time.sleep(3)
        
        print("✅ Tweet posted successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        print("Closing browser in 5 seconds...")
        time.sleep(5)
        driver.quit()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        tweet = " ".join(sys.argv[1:])
    else:
        tweet = "🧪 Studio OS test post - browser automation working! #StudioOS #AI"
    
    post_tweet(tweet)
