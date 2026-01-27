import os
import sys
import time

# Add project root to path
sys.path.append(os.getcwd())

from admin.brain.neural_link import NeuralLink


def demo_neural_link():
    print(">>> [Antigravity] Initiating Neural Link Transmission...")
    link = NeuralLink()

    target_file = "neural_bridge_test.txt"
    if os.path.exists(target_file):
        os.remove(target_file)

    # Instruction: "Run a shell command..."
    # We use the '!' prefix which OpenCode interprets as a direct shell command
    instruction = f"!touch {target_file}"

    print(f">>> [Signal] Transmitting to OpenCode: '{instruction}'")

    # Transmit
    start_time = time.time()
    response = link.transmit(
        target="opencode", signal=instruction, payload={"model": "google/gemini-2.0-flash"}
    )
    duration = time.time() - start_time

    print(f">>> [Response] Received in {duration:.2f}s:")
    print(response)

    # Verification
    if os.path.exists(target_file):
        print(f"\n>>> [Physical Verification] Success! File created.")
    else:
        print(f"\n>>> [Physical Verification] Failed. File {target_file} not found.")


if __name__ == "__main__":
    demo_neural_link()
