import requests
import os
import webbrowser
import time
from urllib.parse import urlencode

class TikTokAPIClient:
    def __init__(self, client_key, client_secret, redirect_uri):
        self.client_key = client_key
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.base_url = "https://open.tiktokapis.com/v2"

    def get_auth_url(self, csrf_state="state"):
        """Generates the authorization URL for the user to click."""
        params = {
            "client_key": self.client_key,
            "scope": "user.info.basic,video.publish,video.upload",
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "state": csrf_state
        }
        return "https://www.tiktok.com/v2/auth/authorize/?" + urlencode(params)

    def get_access_token(self, auth_code):
        """Exchanges the authorization code for an access token."""
        url = f"{self.base_url}/oauth/token/"
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        data = {
            'client_key': self.client_key,
            'client_secret': self.client_secret,
            'code': auth_code,
            'grant_type': 'authorization_code',
            'redirect_uri': self.redirect_uri
        }
        response = requests.post(url, headers=headers, data=data)
        response.raise_for_status()
        return response.json()

    def init_video_upload(self, access_token, open_id, video_size_bytes, title="Uploaded via API"):
        """Initializes the video upload process."""
        url = f"{self.base_url}/post/publish/video/init/"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        data = {
            "post_info": {
                "title": title,
                "privacy_level": "SELF_ONLY", # Default to private for safety
                "disable_duet": False,
                "disable_comment": False,
                "disable_stitch": False,
                "video_cover_timestamp_ms": 1000
            },
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": video_size_bytes,
                "chunk_size": video_size_bytes, # Upload in one go if possible, or handle chunking
                "total_chunk_count": 1
            }
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code != 200:
             print(f"Error initializing upload: {response.text}")
             return None
        return response.json()

    def upload_video_file(self, upload_url, video_path):
        """Uploads the actual video file to the provided URL."""
        with open(video_path, 'rb') as f:
            headers = {'Content-Type': 'video/mp4'} # or 'application/octet-stream'
            response = requests.put(upload_url, headers=headers, data=f)
            return response.status_code == 200

    def refresh_token(self, refresh_token):
        """Refreshes the access token using the refresh token."""
        url = f"{self.base_url}/oauth/token/"
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        data = {
            'client_key': self.client_key,
            'client_secret': self.client_secret,
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }
        response = requests.post(url, headers=headers, data=data)
        return response.json()

# Example usage helper
def run_setup(client_key, client_secret):
    client = TikTokAPIClient(client_key, client_secret, "http://localhost:8080/callback") 
    print(f"Please visit: {client.get_auth_url()}")
    # In a real app, you'd run a local server to catch the callback.
    # For now, we'll ask the user to paste the code.
    code = input("Paste the code from the URL: ")
    token_data = client.get_access_token(code)
    print("Access Token Data:", token_data)
    return token_data
