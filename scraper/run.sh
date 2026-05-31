#!/bin/bash
set -euo pipefail

# Source environment variables
if [ -f "/Users/stevin/Documents/Projects/StevinInternshipAssistant/.env" ]; then
    set -a
    source "/Users/stevin/Documents/Projects/StevinInternshipAssistant/.env"
    set +a
fi

cd /Users/stevin/Documents/Projects/StevinInternshipAssistant/scraper

# Use python3 directly or uv if available
if command -v uv &> /dev/null; then
    uv run python main.py
elif command -v python3 &> /dev/null; then
    python3 main.py
else
    echo "No Python interpreter found"
    exit 1
fi
