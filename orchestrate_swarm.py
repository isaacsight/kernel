import asyncio
import json
import sys
import shutil

# Configuration
CLAUDE_BIN = "/Users/isaachernandez/Library/Application Support/Claude/claude-code/2.0.72/claude"
CONFIG_FILE = "swarm_config.json"


async def read_stream(stream, label, color_code):
    """Reads from a stream and prints with a label."""
    while True:
        line = await stream.readline()
        if not line:
            break
        decoded = line.decode("utf-8").strip()
        if decoded:
            # Colorize output
            print(f"\033[{color_code}m[{label.upper()}]\033[0m {decoded}")


async def run_agent(name, agents_json):
    """Starts a single agent process."""
    cmd = [
        CLAUDE_BIN,
        "--agents",
        agents_json,
        "--agent",
        name,
        # We use --print to get non-interactive output mode which is easier to parse,
        # BUT --print exits after one turn. We need interactive mode but headless?
        # Actually, for persistent chat, 'claude' usually expects a TTY or strictly interactive session.
        # Let's try running without arguments (interactive mode) but piping stdio.
        # Note: Claude CLI might detect non-TTY and behave differently (headless mode).
        "--input-format",
        "text",  # Ensure text input
    ]

    # Create subprocess
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        limit=1024 * 1024,  # Expand buffer
    )
    return process


async def main():
    # Load config
    with open(CONFIG_FILE, "r") as f:
        config_data = json.load(f)
        agents_def = config_data["agents"]
        agents_json = json.dumps(agents_def)
        agent_names = list(agents_def.keys())

    print(f"🚀 Initializing Swarm Controller via AsyncIO...")
    print(f"   Targeting agents: {', '.join(agent_names)}")
    print("----------------------------------------------------------------")
    print("COMMANDS:")
    print("  ALL: <message>   -> Broadcast to everyone")
    print("  @name: <message> -> Send to specific agent")
    print("  /exit            -> Kill swarm")
    print("----------------------------------------------------------------")

    # Start all agents
    swarm = {}
    tasks = []

    colors = [31, 32, 33, 34, 35, 36]  # Red, Green, Yellow, Blue, Magenta, Cyan

    for i, name in enumerate(agent_names):
        print(f"Assigning {name}...")
        proc = await run_agent(name, agents_json)
        swarm[name] = proc

        # Start reading stdout/stderr in background
        color = colors[i % len(colors)]
        tasks.append(asyncio.create_task(read_stream(proc.stdout, name, color)))
        tasks.append(
            asyncio.create_task(read_stream(proc.stderr, f"{name}:ERR", "41"))
        )  # Red background for errors

    print("✅ Swarm Online. Awaiting inputs.")

    # Input loop (Async input reading is tricky in Python, using a simple blocking executor for stdin)
    loop = asyncio.get_event_loop()

    while True:
        try:
            # Non-blocking input handling? For simplicity in this script, we'll use blocking input()
            # wrapped in run_in_executor to not block the read loops.
            msg = await loop.run_in_executor(None, sys.stdin.readline)
            msg = msg.strip()

            if not msg:
                continue

            if msg == "/exit":
                print("Shutting down swarm...")
                for p in swarm.values():
                    p.terminate()
                break

            # Broadcast or Unicast
            if msg.startswith("@"):
                # Unicast
                target, content = msg.split(":", 1)
                target = target[1:].strip().lower()
                if target in swarm:
                    swarm[target].stdin.write(f"{content}\n".encode())
                    await swarm[target].stdin.drain()
                    print(f"Sent to {target}.")
                else:
                    print(f"❌ Unknown agent: {target}")

            elif (
                msg.startswith("ALL:") or True
            ):  # Default to broadcast if ambiguous? Let's be strict or default.
                # Let's say default is Broadcast for now for "control all 6"
                content = msg
                if msg.startswith("ALL:"):
                    content = msg.split(":", 1)[1]

                print(f"📢 Broadcasting to {len(swarm)} agents...")
                for name, p in swarm.items():
                    p.stdin.write(f"{content}\n".encode())
                    await p.stdin.drain()

        except KeyboardInterrupt:
            print("\nInterrupted.")
            break

    # Cleanup
    for p in swarm.values():
        try:
            p.terminate()
        except:
            pass


if __name__ == "__main__":
    asyncio.run(main())
