import os
import sys
import json
from datetime import datetime

# Ensure project root is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def validate_onboarding():
    print("🚀 Antigravity Onboarding Validator")
    print("-----------------------------------")

    errors = []

    # 1. Check for .env
    if not os.path.exists(".env"):
        errors.append("Missing .env file. Please copy .env.example and add your API keys.")
    else:
        print("✓ .env file found.")

    # 2. Check for dependencies (simplified)
    try:
        import google.generativeai

        print("✓ AI dependencies installed.")
    except ImportError:
        errors.append("AI dependencies missing. Run 'pip install -r requirements.txt'.")

    # 3. Check for Brain directory
    if not os.path.exists("admin/brain"):
        errors.append("Brain directory missing. Ensure you are in the project root.")
    else:
        print("✓ Core substrate detected.")

    if errors:
        print("\n❌ Onboarding incomplete:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

    # 4. Success Signal
    print("\n✨ All systems nominal!")
    engineer_name = input("Enter your name to signal successful onboarding: ")

    signal_dir = "admin/brain/missions/onboarding"
    os.makedirs(signal_dir, exist_ok=True)

    signal_file = os.path.join(
        signal_dir, f"{engineer_name.lower().replace(' ', '_')}_onboarded.json"
    )

    data = {
        "engineer": engineer_name,
        "timestamp": datetime.now().isoformat(),
        "status": "active",
        "message": "System initialized and ready for collaborative intelligence.",
    }

    with open(signal_file, "w") as f:
        json.dump(data, f, indent=2)

    print(f"\n✅ Signal sent! Antigravity will alert Isaac that you are ready.")
    print(f"Signal file created at: {signal_file}")


if __name__ == "__main__":
    validate_onboarding()
