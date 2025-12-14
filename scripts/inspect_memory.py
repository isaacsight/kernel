import json
import os

knowledge_path = '/Users/isaachernandez/blog design/admin/brain/collective_knowledge.json'

def inspect_knowledge(path):
    print(f"--- Inspecting {os.path.basename(path)} ---")
    if not os.path.exists(path):
        print("File not found.")
        return

    try:
        with open(path, 'r') as f:
            data = json.load(f)
        
        if isinstance(data, dict):
             # Inspect specific keys
             for key in ['active_goals', 'shared_insights', 'lessons_learned']:
                 if key in data:
                     print(f"\n--- {key.upper()} ---")
                     items = data[key]
                     if isinstance(items, list):
                         for i, item in enumerate(items[-5:]): # Last 5
                             print(f"{i+1}. {item}")
                     elif isinstance(items, dict):
                         print(json.dumps(items, indent=2))
                     else:
                         print(items)
             
    except Exception as e:
        print(f"Error reading file: {e}")

inspect_knowledge(knowledge_path)
