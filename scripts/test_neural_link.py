import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from admin.brain.neural_link import NeuralLink


def test_neural_link():
    print(">>> Testing Neural Link Transmission...")
    link = NeuralLink()

    # Simple echo test
    response = link.transmit(
        target="opencode",
        signal="echo 'Neural Link Active'",
        payload={"model": "google/gemini-2.0-flash"},  # Use the verified model
    )

    print(f"Response: {response}")

    if response.get("success"):
        print(">>> SUCCESS: Neural Link verified.")
    else:
        print(">>> FAILURE: Transmission failed.")


if __name__ == "__main__":
    test_neural_link()
