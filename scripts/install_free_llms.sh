#!/bin/bash

# install_free_llms.sh
# Installs Ollama locally and sets up LiteLLM for the Studio OS.

set -e

echo "🚀 Starting Free LLM Resources Setup..."

# 1. Install Ollama
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is already installed."
else
    echo "📦 Ollama not found. Attempting to install..."
    if command -v brew &> /dev/null; then
        echo "🍺 Installing Ollama via Homebrew..."
        brew install --cask ollama
    else
        echo "⚠️  Homebrew not found. Please install Ollama manually from: https://ollama.com/download"
        echo "Once installed, run this script again."
    fi
fi

# 2. Check and Install LiteLLM in the virtual environment
if [ -d ".venv" ]; then
    echo "🐍 Virtual environment found. Installing LiteLLM..."
    source .venv/bin/activate
    pip install litellm ollama
else
    echo "⚠️  No .venv found. Installing LiteLLM globally (not recommended)..."
    pip install litellm ollama
fi

# 3. Pull a default lightweight model
if command -v ollama &> /dev/null; then
    echo "📥 Pulling Llama 3.2 (3B) as a default free model..."
    ollama pull llama3.2
else
    echo "⚠️  Ollama not available to pull models. Please install and run it first."
fi

echo "✅ Free LLM setup complete!"
echo "You can now use local models in your Studio OS agents."
