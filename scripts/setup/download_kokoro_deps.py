import os
import requests

def download_file(url, dest_path):
    print(f"⬇️ Downloading {url}...")
    response = requests.get(url)
    if response.status_code != 200:
        print(f"❌ Failed to download {url}: {response.status_code}")
        return False
    
    with open(dest_path, 'wb') as f:
        f.write(response.content)
    print(f"✅ Downloaded to {dest_path}")
    return True

def main():
    base_dir = "admin/engineers/kokoro_lib"
    
    files = [
        ("https://raw.githubusercontent.com/thewh1teagle/kokoro-onnx/main/src/kokoro_onnx/config.py", "config.py"),
        ("https://raw.githubusercontent.com/thewh1teagle/kokoro-onnx/main/src/kokoro_onnx/log.py", "log.py"),
        ("https://raw.githubusercontent.com/thewh1teagle/kokoro-onnx/main/src/kokoro_onnx/trim.py", "trim.py")
    ]
    
    for url, filename in files:
        download_file(url, os.path.join(base_dir, filename))

if __name__ == "__main__":
    main()
