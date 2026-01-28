#!/bin/bash
# Install Animated Drawings (Option 4)
# This script clones the repo and installs it in editable mode.

TARGET_DIR="admin/engineers/AnimatedDrawings"
REPO_URL="https://github.com/facebookresearch/AnimatedDrawings.git"

echo "🎨 Installing Animated Drawings..."

if [ -d "$TARGET_DIR" ]; then
    echo "Directory $TARGET_DIR already exists. Pulling latest..."
    cd "$TARGET_DIR"
    git pull
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$TARGET_DIR"
    cd "$TARGET_DIR"
fi

echo "Installing python dependencies..."
# We try to install with current python. 
# Note: Official docs say 3.8, but 3.9 might work.
pip install -e .

echo "✅ Installation complete (hopefully)."
