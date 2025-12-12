import sys
import os
import argparse

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from admin.engineers.toolsmith import Toolsmith

def main():
    parser = argparse.ArgumentParser(description="Studio OS Tool Forge")
    parser.add_argument("action", choices=["create", "register"], help="Action to perform")
    parser.add_argument("name", help="Name of the tool/agent (e.g. 'SystemMonitor')")
    parser.add_argument("--role", default="Specialist", help="Description of the role")
    
    args = parser.parse_args()
    
    forge = Toolsmith()
    
    if args.action == "create":
        print(f"🔨 Forging new tool: {args.name}...")
        success, msg = forge.scaffold_tool(args.name, args.role)
        if success:
            print(f"✅ Created: {msg}")
            # Auto register
            print(f"📝 Registering...")
            reg_success, reg_msg = forge.register_tool(args.name)
            if reg_success:
                print(f"✅ Registered: {reg_msg}")
            else:
                print(f"❌ Registration Failed: {reg_msg}")
        else:
            print(f"❌ Failed: {msg}")

    elif args.action == "register":
        print(f"📝 Registering existing tool: {args.name}...")
        success, msg = forge.register_tool(args.name)
        if success:
             print(f"✅ Registered: {msg}")
        else:
             print(f"❌ Failed: {msg}")

if __name__ == "__main__":
    main()
