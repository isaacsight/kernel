#!/bin/bash

REPO_DIR="/Users/isaachernandez/blog design"

osascript <<EOF
tell application "Terminal"
    do script "cd \"$REPO_DIR\" && python3 orchestrate_swarm.py"
    activate
end tell
EOF
