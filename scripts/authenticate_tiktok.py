import sys
import os
import json
import webbrowser
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading
import time

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from admin.engineers.tiktok_api_client import TikTokAPIClient

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("TikTokAuth")

# Global variable to store the auth code
AUTH_CODE = None
SERVER_PORT = 8080
REDIRECT_URI = f"http://localhost:{SERVER_PORT}/callback"

class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global AUTH_CODE
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == "/callback":
            query_params = parse_qs(parsed_path.query)
            if "code" in query_params:
                AUTH_CODE = query_params["code"][0]
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b"<h1>Authentication Successful!</h1><p>You can close this window now.</p>")
                logger.info(f"Captured Auth Code: {AUTH_CODE}")
            else:
                self.send_response(400)
                self.wfile.write(b"Missing code param")
                logger.error("Callback received but missing 'code' parameter.")
        else:
            self.send_response(404)
            self.wfile.write(b"Not Found")

def start_server():
    server = HTTPServer(('localhost', SERVER_PORT), CallbackHandler)
    logger.info(f"Starting ephemeral server on port {SERVER_PORT}...")
    # Handle one request then close? Or run in thread until code found.
    # For simplicity, we'll let it handle requests indefinitely but check AUTH_CODE in main loop.
    return server

def load_config():
    config_path = os.path.join(os.path.dirname(__file__), '../admin/social_config.json')
    if not os.path.exists(config_path):
        logger.error(f"Config not found at {config_path}")
        return None, None
    
    with open(config_path, 'r') as f:
        data = json.load(f)
        
    return data, config_path

def save_tokens(config_path, data, tokens):
    # Update data structure
    tiktok_config = data['platforms']['tiktok']
    tiktok_config['access_token'] = tokens.get('access_token')
    tiktok_config['refresh_token'] = tokens.get('refresh_token')
    tiktok_config['token_scopes'] = tokens.get('scope') # TikTok returns 'scope' or 'open_id' etc.
    # Also save expires_in if you want, but sticking to requested fields.
    
    with open(config_path, 'w') as f:
        json.dump(data, f, indent=4)
    logger.info("Tokens saved to admin/social_config.json")

def main():
    logger.info("🎬 Starting TikTok Authentication Flow")
    
    # 1. Load Config
    config_data, config_path = load_config()
    if not config_data:
        return

    tiktok_config = config_data['platforms'].get('tiktok', {})
    client_key = tiktok_config.get('client_key')
    client_secret = tiktok_config.get('client_secret')
    
    if not client_key or not client_secret:
        logger.error("Client Key or Secret missing in admin/social_config.json")
        return

    # 2. Init Client
    client = TikTokAPIClient(client_key, client_secret, REDIRECT_URI)
    
    # 2a. Generate PKCE
    verifier, challenge = client.generate_pkce_pair()
    logger.info(f"Generated PKCE Verifier: {verifier[:10]}...")
    logger.info(f"Generated PKCE Challenge: {challenge}")

    # 3. Start Server in Thread
    server = start_server()
    thread = threading.Thread(target=server.serve_forever)
    thread.daemon = True
    thread.start()
    
    # 4. Open Browser
    auth_url = client.get_auth_url(code_challenge=challenge)
    logger.info(f"Opening browser for: {auth_url}")
    print(f"\n👉 Please authorize the app here: {auth_url}\n")
    # webbrowser.open(auth_url)
    
    # 5. Wait for Code
    logger.info("Waiting for callback...")
    try:
        while AUTH_CODE is None:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Aborted by user.")
        server.shutdown()
        return

    # 6. Success - Exchange Token
    logger.info("Code received. Exchanging for tokens...")
    try:
        token_data = client.get_access_token(AUTH_CODE, code_verifier=verifier)
        logger.info(f"Token Data Received: {token_data}")
        
        if 'access_token' in token_data:
            save_tokens(config_path, config_data, token_data)
            print("\n✅ Authentication Complete! Tokens saved.")
        else:
            logger.error(f"Failed to get access_token. Response: {token_data}")
            
    except Exception as e:
        logger.error(f"Error exchanging token: {e}")
    finally:
        server.shutdown()

if __name__ == "__main__":
    main()
