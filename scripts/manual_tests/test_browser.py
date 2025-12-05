from selenium import webdriver
import time

def test_browser():
    print("Attempting to launch Chrome...")
    try:
        driver = webdriver.Chrome()
        print("Chrome launched successfully!")
        driver.get("https://www.google.com")
        print("Navigated to Google.")
        time.sleep(5)
        driver.quit()
        print("Browser closed.")
    except Exception as e:
        print(f"Failed to launch browser: {e}")

if __name__ == "__main__":
    test_browser()
