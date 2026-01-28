import subprocess
import json
import time
import sys
import os

# Configuration
CLAUDE_PATH = "/Users/isaachernandez/Library/Application Support/Claude/claude-code/2.0.72/claude"
CONFIG_FILE = "swarm_config.json"
PROMPT = "Report your status and your prime directive."


def load_agents():
    with open(CONFIG_FILE, "r") as f:
        data = json.load(f)
    return list(data["agents"].keys())


def run_swarm():
    agents = load_agents()
    processes = []

    print(f"🚀 Launching swarm with {len(agents)} agents...")

    for agent in agents:
        print(f"  [+] Spawning {agent}...")
        # Construct command
        # Note: We pass the whole config file content as --agents because file path support is unconfirmed for that specific flag,
        # but --settings matches keys. Let's try passing the specific dictionary chunk if possible, or just the file if supported.
        # safely we will just read the file content and pass it as json string to --agents to be sure.

        with open(CONFIG_FILE, "r") as f:
            config_str = f.read()
            # The config file has {"agents": {...}}, but --agents expects just the {...} part usually?
            # Or asking for the JSON object defining custom agents.
            # Let's parse and re-dump just the agents part to be safe.
            full_config = json.loads(config_str)
            agents_json = json.dumps(full_config["agents"])

        cmd = [CLAUDE_PATH, "--agents", agents_json, "--agent", agent, "--print", PROMPT]

        # Start process asynchronously
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        processes.append((agent, p))

    print(f"\n⏳ Waiting for responses from {len(processes)} agents...\n")
    print("-" * 60)

    # Collect results
    for agent, p in processes:
        stdout, stderr = p.communicate()
        print(f"🤖 AGENT: {agent.upper()}")
        if stderr:
            print(f"errors: {stderr.strip()}")
        print(f"{stdout.strip()}")
        print("-" * 60)


if __name__ == "__main__":
    run_swarm()
