#!/bin/bash

# Configuration
REPO_DIR="/Users/isaachernandez/blog design"
CLAUDE_BIN="/Users/isaachernandez/Library/Application Support/Claude/claude-code/2.0.72/claude"
CONFIG_FILE="swarm_config.json"

# Read agents from config using python (since jq might not be available)
AGENTS=$(python3 -c "import json; print(' '.join(json.load(open('$CONFIG_FILE'))['agents'].keys()))")

echo "🚀 Launching interactive terminals for: $AGENTS"

for AGENT in $AGENTS; do
    echo "  [+] Opening Terminal for $AGENT..."
    
    # AppleScript to open a new tab/window and run the command
    # We use a custom title if possible, but Terminal app simple 'do script' is easiest
    osascript <<EOF
tell application "Terminal"
    do script "cd \"$REPO_DIR\" && \"$CLAUDE_BIN\" --agents \"$CONFIG_FILE\" --agent \"$AGENT\""
    activate
end tell
EOF
    
    # Small delay to keep order sane
    sleep 0.5
done

echo "✅ All agents launched in separate windows."
