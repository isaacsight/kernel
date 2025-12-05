import os
import requests

def download_file(url, dest_path):
    if os.path.exists(dest_path):
        print(f"✅ {dest_path} already exists.")
        return

    print(f"⬇️ Downloading {url}...")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    
    with open(dest_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"✅ Downloaded to {dest_path}")

def main():
    base_dir = "admin/brain/kokoro_models"
    if not os.path.exists(base_dir):
        os.makedirs(base_dir)

    model_url = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/kokoro-v0_19.onnx"
    voices_url = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/voices.json"

    download_file(model_url, os.path.join(base_dir, "kokoro-v0_19.onnx"))
    download_file(voices_url, os.path.join(base_dir, "voices.json"))

if __name__ == "__main__":
    main()
