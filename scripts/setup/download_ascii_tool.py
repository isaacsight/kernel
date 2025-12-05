import os
import requests

def download_file(url, dest_path):
    print(f"Downloading {url} to {dest_path}...")
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, "wb") as f:
            f.write(response.content)
        print("Download complete.")
    except Exception as e:
        print(f"Error downloading: {e}")

if __name__ == "__main__":
    base_url = "https://raw.githubusercontent.com/AlexEidt/ASCII-Video/master/ascii.py"
    dest = "admin/engineers/ascii_lib/ascii.py"
    download_file(base_url, dest)
