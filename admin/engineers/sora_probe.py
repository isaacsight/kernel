import requests
import http.cookiejar
import os

def load_cookies(cookie_file):
    """Loads cookies from a Netscape format file."""
    cj = http.cookiejar.MozillaCookieJar(cookie_file)
    cj.load()
    return cj

def probe_sora():
    cookie_path = os.path.join(os.path.dirname(__file__), "../sora_cookies.txt")
    if not os.path.exists(cookie_path):
        print(f"Error: Cookie file not found at {cookie_path}")
        return

    print(f"Loading cookies from {cookie_path}...")
    cj = load_cookies(cookie_path)
    
    # Headers to mimic a browser
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://sora.chatgpt.com/",
        "Origin": "https://sora.chatgpt.com"
    }

    # 1. Verify Auth/Session
    print("\n[1] Probing Profile/Session...")
    # Trying the user's requested URL first
    profile_url = "https://sora.chatgpt.com/profile" 
    
    session = requests.Session()
    session.cookies = cj
    session.headers.update(headers)

    try:
        response = session.get(profile_url)
        print(f"Profile URL: {profile_url}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("Success! Access to profile confirmed.")
            if "Sign up" in response.text or "Log in" in response.text:
                print("WARNING: Response body might indicate we are NOT logged in. Checking content...")
                # print(response.text[:500])
            else:
                print("Authenticated successfully (likely).")
        else:
            print("Failed to access profile.")

        # 2. Probe for internal API endpoints (Next.js specific)
        # Common Next.js auth endpoint: /api/auth/session
        api_url = "https://sora.chatgpt.com/api/auth/session"
        print(f"\n[2] Probing API Session: {api_url}")
        api_response = session.get(api_url)
        print(f"Status: {api_response.status_code}")
        print(f"Body: {api_response.text}")
        
        # 3. Probe for User Info (guesswork based on other OAI apps)
        user_url = "https://sora.chatgpt.com/backend/api/users/me" # Hypothetical
        print(f"\n[3] Probing User Info (Hypothetical): {user_url}")
        user_response = session.get(user_url)
        print(f"Status: {user_response.status_code}")
        
    except Exception as e:
        print(f"Error during probe: {e}")

if __name__ == "__main__":
    probe_sora()
