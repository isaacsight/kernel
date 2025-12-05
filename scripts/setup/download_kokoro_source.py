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
    if not os.path.exists(base_dir):
        os.makedirs(base_dir)
        # Create empty __init__.py to make it a package
        with open(os.path.join(base_dir, "__init__.py"), "w") as f:
            f.write("")

    # URLs based on typical structure
    # Trying the main file. Often in src/kokoro_onnx/__init__.py or just kokoro_onnx/__init__.py on main branch
    # Let's try to get the raw content from main branch
    
    files = [
        ("https://raw.githubusercontent.com/thewh1teagle/kokoro-onnx/main/src/kokoro_onnx/__init__.py", "kokoro.py"),
        ("https://raw.githubusercontent.com/thewh1teagle/kokoro-onnx/main/src/kokoro_onnx/tokenizer.py", "tokenizer.py"),
        ("https://raw.githubusercontent.com/thewh1teagle/kokoro-onnx/main/src/kokoro_onnx/config.json", "config.json")
    ]
    
    for url, filename in files:
        download_file(url, os.path.join(base_dir, filename))

if __name__ == "__main__":
    main()
