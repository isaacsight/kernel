#!/bin/bash

# DTFR Claude Code Sync Utility
# This script prepares a "context bundle" for Claude Code to ingest.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTEXT_DIR="$REPO_ROOT/.context_bundle"

echo "🚀 Preparing DTFR context for Claude Code..."

# Create context directory if it doesn't exist
mkdir -p "$CONTEXT_DIR"

# 1. Sync Decision Log
if [ -f "$REPO_ROOT/decision-log.md" ]; then
    cp "$REPO_ROOT/decision-log.md" "$CONTEXT_DIR/decision-log.md"
    echo "  ✅ Synced decision-log.md"
fi

# 2. Sync Active Tasks (Mental State)
if [ -f "$REPO_ROOT/.gemini/antigravity/brain/*/task.md" ]; then
    # Grab the latest task.md from the active brain directory
    LATEST_TASK=$(ls -t "$REPO_ROOT/.gemini/antigravity/brain/"*"/task.md" | head -n 1)
    cp "$LATEST_TASK" "$CONTEXT_DIR/active-task.md"
    echo "  ✅ Synced active-task.md"
fi

# 3. Create a README for Claude
cat <<EOF > "$CONTEXT_DIR/README.md"
# DTFR CONTEXT BUNDLE
This directory contains the latest mental state and architectural decisions for the DTFR project.
Use this context to inform your 'Plan Mode' engineering tasks.

**Files:**
- decision-log.md: Record of key architectural shifts and mission outcomes.
- active-task.md: The current granular checklist for the ongoing mission.
EOF

echo "  ✅ Created README.md"

echo "----------------------------------------------------"
echo "Mission context is ready at: $CONTEXT_DIR"
echo "To ingest, run in your terminal:"
echo "  claude --plan \"Review $(basename $CONTEXT_DIR) and suggest my next engineering moves\""
echo "----------------------------------------------------"
