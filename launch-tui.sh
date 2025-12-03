#!/bin/bash
export STUDIO_NODE_URL="http://192.168.1.56:8000"
source venv/bin/activate
cd "$(dirname "$0")"
python3 admin/tui.py
