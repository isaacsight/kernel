from tiktok_uploader.browsers import get_browser
import time

def test_tiktok_browser():
    print("Attempting to launch Chrome using tiktok-uploader logic...")
    try:
        driver = get_browser("chrome", headless=False)
        print("Chrome launched successfully via tiktok-uploader!")
        driver.get("https://www.tiktok.com")
        print("Navigated to TikTok.")
        time.sleep(5)
        driver.quit()
        print("Browser closed.")
    except Exception as e:
        print(f"Failed to launch browser: {e}")

if __name__ == "__main__":
    test_tiktok_browser()
