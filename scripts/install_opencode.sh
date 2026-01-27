#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}>>> Installing OpenCode.ai CLI...${NC}"

# Check for brew on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    if ! command -v brew &> /dev/null; then
        echo "Homebrew not found. Falling back to curl installer."
        curl -fsSL https://opencode.ai/install | bash
    else
        # Try installing via brew if available (though opencode might not be in default tap yet, fallback to curl)
        # Using curl is the documented universal method for now.
        curl -fsSL https://opencode.ai/install | bash
    fi
else
    # Linux/Other
    curl -fsSL https://opencode.ai/install | bash
fi

echo -e "${GREEN}>>> OpenCode installed successfully.${NC}"

# Configuration Setup
CONFIG_SRC="$(pwd)/admin/config/opencode.jsonc"
CONFIG_DIR="$HOME/.config/opencode"
CONFIG_DEST="$CONFIG_DIR/config.jsonc"

if [ -f "$CONFIG_SRC" ]; then
    echo -e "${BLUE}>>> linking managed configuration...${NC}"
    mkdir -p "$CONFIG_DIR"
    
    # Backup existing config if it exists and is not a symlink
    if [ -f "$CONFIG_DEST" ] && [ ! -L "$CONFIG_DEST" ]; then
        mv "$CONFIG_DEST" "${CONFIG_DEST}.bak"
        echo "Backed up existing config to ${CONFIG_DEST}.bak"
    fi

    # Create symlink
    ln -sf "$CONFIG_SRC" "$CONFIG_DEST"
    echo -e "${GREEN}>>> Configuration linked to $CONFIG_DEST${NC}"
else
    echo "Warning: Managed configuration file not found at $CONFIG_SRC"
fi

echo -e "${GREEN}>>> Installation complete. Run 'opencode' to start.${NC}"
