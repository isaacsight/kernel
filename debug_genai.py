import sys
try:
    import google.genai as genai
    print(f"Imported google.genai from: {genai.__file__}")
    # Try to find version
    try:
        print(f"Version: {genai.__version__}")
    except:
        print("Version attribute not found.")
    
    # Inspect Client
    try:
        from google.genai import Client
        client = Client(api_key="TEST")
        print(f"Client attributes: {dir(client)}")
        if hasattr(client, 'interactions'):
            print("SUCCESS: client.interactions exists.")
        else:
            print("FAILURE: client.interactions does NOT exist.")
    except ImportError:
        print("Could not import Client from google.genai")
        # Maybe it's the old SDK?
        print(f"Package contents: {dir(genai)}")
        
except ImportError:
    print("Could not import google.genai")

# Check if google.generativeai is installed and what version
try:
    import google.generativeai as old_genai
    print(f"Imported google.generativeai from: {old_genai.__file__}")
    print(f"Old SDK Version: {old_genai.__version__}")
except ImportError:
    print("google.generativeai not installed.")
