#!/bin/bash
# kbot installer — installs Node.js (if needed) and kbot
# Usage: curl -fsSL https://kernel.chat/install.sh | bash

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BOLD}  kbot installer${NC}"
echo -e "  Open-source terminal AI agent — kernel.chat"
echo ""

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"

# Check if Node.js is installed
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//')
  MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [ "$MAJOR" -ge 20 ]; then
    echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION found"
  else
    echo -e "${YELLOW}⚠${NC} Node.js $NODE_VERSION found but kbot requires >= 20"
    echo -e "  Upgrading via nvm..."
    NEED_NODE=true
  fi
else
  echo -e "${YELLOW}⚠${NC} Node.js not found — installing..."
  NEED_NODE=true
fi

# Install Node.js if needed
if [ "$NEED_NODE" = true ]; then
  if command -v nvm &> /dev/null; then
    echo -e "  Installing Node.js 22 via nvm..."
    nvm install 22
    nvm use 22
  elif command -v brew &> /dev/null; then
    echo -e "  Installing Node.js via Homebrew..."
    brew install node
  else
    echo -e "  Installing nvm + Node.js 22..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 22
    nvm use 22
  fi

  # Verify
  if command -v node &> /dev/null; then
    echo -e "${GREEN}✓${NC} Node.js $(node -v) installed"
  else
    echo -e "${RED}✗${NC} Failed to install Node.js"
    echo -e "  Install manually: https://nodejs.org"
    exit 1
  fi
fi

# Install kbot
echo ""
echo -e "  Installing @kernel.chat/kbot..."
npm install -g @kernel.chat/kbot

# Verify
if command -v kbot &> /dev/null; then
  echo ""
  echo -e "${GREEN}✓${NC} kbot installed successfully!"
  echo ""
  echo -e "  Get started:"
  echo -e "    ${BOLD}kbot${NC}              # Interactive mode"
  echo -e "    ${BOLD}kbot auth${NC}         # Set up your API key"
  echo -e "    ${BOLD}kbot --help${NC}       # See all commands"
  echo ""
  echo -e "  ${BOLD}https://kernel.chat${NC}"
else
  echo -e "${RED}✗${NC} Installation failed"
  echo -e "  Try: npm install -g @kernel.chat/kbot"
  exit 1
fi
