import json

def main():
    path = "admin/brain/kokoro_models/voices.json"
    try:
        with open(path, 'r') as f:
            voices = json.load(f)
            print(f"Found {len(voices)} voices:")
            for name in sorted(voices.keys()):
                print(f"- {name}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
