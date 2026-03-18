#!/bin/bash
# Install kbot — Kernel's terminal AI agent
# Usage: curl -fsSL https://kernel.chat/install.sh | bash
#
# This script:
# 1. Detects your platform (macOS/Linux, arm64/x64)
# 2. Installs kbot via npm globally
# 3. Creates ~/.kbot/ directory
# 4. Prompts for API key setup

set -e

BOLD="\033[1m"
DIM="\033[2m"
PURPLE="\033[35m"
GREEN="\033[32m"
RED="\033[31m"
RESET="\033[0m"

echo ""
echo -e "${PURPLE}${BOLD}┌─────────────────────────────────────┐${RESET}"
echo -e "${PURPLE}${BOLD}│  kbot — Terminal AI Agent Framework │${RESET}"
echo -e "${PURPLE}${BOLD}│  22 agents. 262 tools. 20 providers.│${RESET}"
echo -e "${PURPLE}${BOLD}└─────────────────────────────────────┘${RESET}"
echo ""

# Check Node.js — install if missing
install_node() {
  echo -e "${DIM}Node.js not found. Installing...${RESET}"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS — use official installer pkg via curl
    if command -v brew &> /dev/null; then
      echo -e "${DIM}Installing Node.js via Homebrew...${RESET}"
      brew install node@22
      brew link --overwrite node@22
    else
      echo -e "${DIM}Installing Node.js via official installer...${RESET}"
      ARCH=$(uname -m)
      if [ "$ARCH" = "arm64" ]; then
        NODE_URL="https://nodejs.org/dist/v22.14.0/node-v22.14.0-darwin-arm64.tar.gz"
      else
        NODE_URL="https://nodejs.org/dist/v22.14.0/node-v22.14.0-darwin-x64.tar.gz"
      fi
      curl -fsSL "$NODE_URL" -o /tmp/node.tar.gz
      sudo mkdir -p /usr/local/lib/nodejs
      sudo tar -xzf /tmp/node.tar.gz -C /usr/local/lib/nodejs
      NODE_DIR=$(ls /usr/local/lib/nodejs | grep node | head -1)
      sudo ln -sf "/usr/local/lib/nodejs/$NODE_DIR/bin/node" /usr/local/bin/node
      sudo ln -sf "/usr/local/lib/nodejs/$NODE_DIR/bin/npm" /usr/local/bin/npm
      sudo ln -sf "/usr/local/lib/nodejs/$NODE_DIR/bin/npx" /usr/local/bin/npx
      rm /tmp/node.tar.gz
    fi
  elif [[ "$OSTYPE" == "linux"* ]]; then
    # Linux — use NodeSource
    if command -v apt-get &> /dev/null; then
      echo -e "${DIM}Installing Node.js via apt...${RESET}"
      curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
      sudo apt-get install -y nodejs
    elif command -v dnf &> /dev/null; then
      echo -e "${DIM}Installing Node.js via dnf...${RESET}"
      curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
      sudo dnf install -y nodejs
    elif command -v yum &> /dev/null; then
      echo -e "${DIM}Installing Node.js via yum...${RESET}"
      curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
      sudo yum install -y nodejs
    else
      echo -e "${RED}Could not auto-install Node.js. Install manually: https://nodejs.org${RESET}"
      exit 1
    fi
  else
    echo -e "${RED}Unsupported OS. Install Node.js manually: https://nodejs.org${RESET}"
    exit 1
  fi

  # Verify
  if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js installation failed. Install manually: https://nodejs.org${RESET}"
    exit 1
  fi
  echo -e "${GREEN}✓ Node.js $(node -v) installed${RESET}"
}

if ! command -v node &> /dev/null; then
  install_node
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "${DIM}Node.js v${NODE_VERSION} found, but v20+ required. Upgrading...${RESET}"
  install_node
fi

# Verify npm (comes with Node.js)
if ! command -v npm &> /dev/null; then
  echo -e "${RED}npm not found. Reinstall Node.js: https://nodejs.org${RESET}"
  exit 1
fi

echo -e "${DIM}Installing @kernel.chat/kbot...${RESET}"

# Install globally via npm
npm install -g @kernel.chat/kbot 2>/dev/null || {
  echo -e "${DIM}Global install needs permissions. Trying with sudo...${RESET}"
  sudo npm install -g @kernel.chat/kbot
}

# Create config directory
mkdir -p "$HOME/.kbot/memory"
mkdir -p "$HOME/.kbot/history"

echo ""
echo -e "${GREEN}${BOLD}✓ kbot installed successfully!${RESET}"
echo ""

# Check if already configured
if [ -f "$HOME/.kbot/config.json" ]; then
  echo -e "${DIM}API key already configured.${RESET}"
  echo ""
  echo -e "  Run ${BOLD}kbot${RESET} to start chatting."
else
  echo -e "  ${BOLD}Next step:${RESET}"
  echo -e "  Run ${BOLD}kbot${RESET} — it will walk you through setup."
fi

echo ""
echo -e "${DIM}Documentation: kernel.chat/#/api-docs${RESET}"
echo -e "${DIM}Support: api@kernel.chat${RESET}"
echo ""
