import sys
import os
import argparse
import logging

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.lab_scientist import LabScientist

def main():
    parser = argparse.ArgumentParser(description="Run a Lab Experiment via the LabScientist agent.")
    parser.add_argument("--id", required=True, help="Experiment ID to run (e.g., 3)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    print(f"🔬 Initializing Lab Scientist for Experiment #{args.id}...")
    scientist = LabScientist()
    
    try:
        result = scientist.run_experiment(args.id)
        
        if result.get("status") == "success":
            print(f"\n✅ Experiment Complete!")
            print(f"📄 Report: {result['report_path']}")
            print(f"📊 Findings: {result.get('findings')}")
            
            # Print content of report to stdout for immediate view
            print("\n--- REPORT SUMMARY ---\n")
            with open(result['report_path'], 'r') as f:
                print(f.read())
            print("\n----------------------\n")
            
        else:
            print(f"\n❌ Experiment Failed: {result.get('message')}")
            
    except Exception as e:
        print(f"\n❌ Critical Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
