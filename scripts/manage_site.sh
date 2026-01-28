#!/bin/bash

# Cleanup function
cleanup() {
    echo "Cleaning up..."
    # Find and kill any python http.server processes started by us or left over
    pkill -f "python3 -m http.server"
    pkill -f "python3 admin/tui.py"
    echo "Done."
}

# Trap exit signals to ensure cleanup
trap cleanup EXIT

echo "Starting Site Manager..."

# Kill any existing instances first to be safe
cleanup

# Launch the TUI
# Launch the Autonomous Operator
python3 -m admin.engineers.operator
