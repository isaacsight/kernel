#!/usr/bin/env python3
import argparse
import sys
import os

# Add the parent directory to sys.path to allow imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from admin.engineers.alchemist import Alchemist
except ImportError:
    # Fallback if run directly from admin dir
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))
    from engineers.alchemist import Alchemist

def main():
    parser = argparse.ArgumentParser(description="Gemini CLI (Alchemist Wrapper)")
    parser.add_argument("prompt", nargs="?", help="The prompt or query to send to Gemini.")
    parser.add_argument("--chat", action="store_true", help="Start an interactive chat session.")
    parser.add_argument("--file", "-f", action="append", help="Include file content as context (can be used multiple times).")
    
    args = parser.parse_args()
    
    try:
        alchemist = Alchemist()
    except Exception as e:
        print(f"Error initializing Alchemist: {e}")
        sys.exit(1)

    if args.chat:
        print("Starting chat session with The Alchemist (Gemini). Type 'exit' or 'quit' to end.")
        alchemist.start_chat()
        while True:
            try:
                user_input = input("You: ")
                if user_input.lower() in ['exit', 'quit']:
                    break
                response = alchemist.chat(user_input)
                print(f"Alchemist: {response}")
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"Error: {e}")
    
    elif args.prompt:
        if args.file:
            # Analyze code mode
            # Resolve absolute paths
            files = [os.path.abspath(f) for f in args.file]
            print(f"Analyzing {len(files)} files...")
            response = alchemist.analyze_code(files, args.prompt)
            print(response)
        else:
            # Simple generation/chat message
            # We can use the chat method for a single turn
            response = alchemist.chat(args.prompt)
            print(response)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
