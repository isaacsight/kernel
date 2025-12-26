
import sys
import inspect
import os
import datetime

# Adjust path to find admin module
sys.path.append(os.path.join(os.getcwd()))

try:
    from admin.brain.system_prompts import SystemPrompts
except ImportError:
    print("Could not import SystemPrompts.")
    sys.exit(1)

def export_prompts():
    output_file = "SOVEREIGN_PROMPTS_LIBRARY.md"
    
    methods = [
        method_name for method_name, _ in inspect.getmembers(SystemPrompts, predicate=inspect.isfunction)
        if method_name.startswith("get_") and method_name.endswith("_prompt")
    ]
    
    methods.sort()
    
    with open(output_file, "w") as f:
        f.write("# Sovereign Prompts Library\n\n")
        f.write(f"**Generated on:** {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**Total Prompts:** {len(methods)}\n\n")
        f.write("---\n\n")
        
        for i, method_name in enumerate(methods):
            method = getattr(SystemPrompts, method_name)
            try:
                # Get the docstring
                doc = inspect.getdoc(method) or "No description."
                # Run the prompt
                prompt_content = method()
                
                # Format the method name to be readable title
                title = method_name.replace("get_", "").replace("_prompt", "").replace("_", " ").title()
                
                f.write(f"## {i+1}. {title}\n")
                f.write(f"_{doc}_\n\n")
                f.write("```markdown\n")
                f.write(prompt_content + "\n")
                f.write("```\n\n")
                f.write("---\n\n")
            except Exception as e:
                print(f"Error processing {method_name}: {e}")

    print(f"Successfully exported {len(methods)} prompts to {output_file}")

if __name__ == "__main__":
    export_prompts()
