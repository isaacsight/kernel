
import os
import sys
import logging

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from admin.engineers.broadcaster import Broadcaster
from admin.config import config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VideoGenScript")

def main():
    slug = "ibm-quantum-cloud-revolution"
    title = "The Quantum Cloud Revolution: How IBM is Democratizing Access"
    content = """
The release of cloud quantum computing by IBM marks a pivotal moment in the history of technology. It is not merely an upgrade in processing power; it is a fundamental shift in accessibility that is democratizing one of the most complex and powerful technologies ever conceived.

## The Era of Quantum Utility

For decades, quantum computing was a theoretical playground for physicists, locked away in high-security labs and cooled to temperatures colder than outer space. IBM changed this narrative by putting the first quantum computer on the cloud, allowing anyone with an internet connection to access a 5-qubit system.

Today, we have moved beyond simple experimentation into the era of **"quantum utility."** This means that quantum systems are beginning to solve problems at a scale and complexity that challenge even the most powerful classical supercomputers. IBM’s roadmap, featuring processors like *Heron* and *Condor*, and the modular *System Two*, demonstrates a commitment to scaling this utility to thousands of qubits.

## Democratizing Access with Qiskit

The true revolution lies in software. IBM's open-source SDK, **Qiskit**, has become the lingua franca of quantum programming. By abstracting away the complex pulse-level controls of the hardware, Qiskit allows developers, researchers, and students to write quantum programs using Python.

This accessibility has fostered a global community. We are no longer waiting for a "quantum priesthood" to reveal the answers; instead, a distributed network of innovators is building the algorithms of tomorrow, today.

## Transforming Industries

The impact of this cloud-based access is rippling across sectors:

*   **Materials Science:** Researchers are simulating molecular structures to discover new battery materials and more efficient solar cells.
*   **Pharmaceuticals:** Drug discovery is being accelerated by accurately modeling chemical reactions that are too complex for classical computers.
*   **Finance:** Algorithms are optimizing portfolios and managing risk with a level of precision previously unattainable.

## Quantum-Centric Supercomputing

Perhaps the most exciting development is the vision of **quantum-centric supercomputing**. IBM is not proposing that quantum computers will replace classical ones. Instead, they envision a hybrid future where quantum processors work in tandem with classical clusters (CPUs and GPUs) and AI.

In this future, a "job" might consist of a classical pre-processing step, a quantum kernel execution, and a classical post-processing step—all managed seamlessly by the cloud. This convergence is where the true power of the quantum cloud resides.

## Conclusion

IBM's release of cloud quantum computing is a catalyst for a new age of discovery. By lowering the barrier to entry, they have ensured that the quantum revolution will not be centralized, but shared. As we stand on the brink of widespread quantum advantage, one thing is clear: the future is being built on the cloud, one qubit at a time.
    """

    post_data = {
        "title": title,
        "slug": slug,
        "content": content
    }

    logger.info(f"Using Gemini Key: {config.GEMINI_API_KEY[:5]}..." if config.GEMINI_API_KEY else "No Gemini Key Found!")

    broadcaster = Broadcaster()
    logger.info(f"Generating video for: {title}")
    
    # Generate video (engine="moviepy" is default)
    # vibe="tech" might be appropriate for this topic
    video_path = broadcaster.generate_video(post_data, vibe="tech")
    
    if video_path:
        logger.info(f"Video generated successfully at: {video_path}")
    else:
        logger.error("Video generation failed.")

if __name__ == "__main__":
    main()
