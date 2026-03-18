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
echo -e "${PURPLE}${BOLD}│  kbot — Kernel Terminal Agent        │${RESET}"
echo -e "${PURPLE}${BOLD}│  17 agents. Multi-model. Your CLI.  │${RESET}"
echo -e "${PURPLE}${BOLD}└─────────────────────────────────────┘${RESET}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}Error: Node.js is required (v20+). Install from https://nodejs.org${RESET}"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "${RED}Error: Node.js v20+ required (found v${NODE_VERSION}). Please upgrade.${RESET}"
  exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
  echo -e "${RED}Error: npm is required. It usually comes with Node.js.${RESET}"
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
