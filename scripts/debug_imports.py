print("Testing imports...")
try:
    print("Importing google.generativeai...")
    import google.generativeai
    print("Success google.generativeai")
except Exception as e:
    print(f"Failed google.generativeai: {e}")

try:
    print("Importing huggingface_hub...")
    import huggingface_hub
    print("Success huggingface_hub")
except Exception as e:
    print(f"Failed huggingface_hub: {e}")

try:
    print("Importing tiktok_uploader...")
    import tiktok_uploader
    print("Success tiktok_uploader")
except Exception as e:
    print(f"Failed tiktok_uploader: {e}")
