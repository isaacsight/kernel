
import requests
import json
import time

BASE_URL = "http://localhost:5001/api/chat"

class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_ai_response(response_data):
    if response_data['status'] == 'success':
        result = response_data['result']
        message = result.get('message', '')
        intent = result.get('intent', 'unknown')
        action = result.get('action')
        
        print(f"{bcolors.OKCYAN}🤖 [AI] ({intent}):{bcolors.ENDC} {message}")
        if action and action != 'chat':
             print(f"{bcolors.OKGREEN}   ⚡ Executing Action: {action}{bcolors.ENDC}")
             if result.get('data'):
                 print(f"{bcolors.OKGREEN}   📦 Data: {json.dumps(result['data'], indent=2)}{bcolors.ENDC}")
    else:
        print(f"{bcolors.FAIL}🤖 [AI Error]: {response_data.get('message')}{bcolors.ENDC}")

def send_chat(text):
    print(f"\n{bcolors.BOLD}👤 [User]:{bcolors.ENDC} {text}")
    time.sleep(1) # Simulate network/typing
    print(f"{bcolors.WARNING}... thinking ...{bcolors.ENDC}")
    try:
        r = requests.post(BASE_URL, json={"message": text})
        print_ai_response(r.json())
    except Exception as e:
        print(f"{bcolors.FAIL}Connection failed: {e}{bcolors.ENDC}")

if __name__ == "__main__":
    print(f"{bcolors.HEADER}=== STUDIO COMPANION LIVE DEMO ==={bcolors.ENDC}")
    time.sleep(1)
    
    # Scene 1: Introduction
    send_chat("Hello! Who are you?")
    time.sleep(2)
    
    # Scene 2: Status Check
    send_chat("How is the system doing today?")
    time.sleep(2)
    
    # Scene 3: Content Creation
    send_chat("I want to write a blog post about 'The Intersection of AI and Art'")
    time.sleep(2)
    
    # Scene 4: Capability Discovery
    send_chat("What else can you do?")
    
    print(f"\n{bcolors.HEADER}=== DEMO COMPLETE ==={bcolors.ENDC}")
