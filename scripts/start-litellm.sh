#!/bin/bash
set -eo pipefail

if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

if ! command -v litellm &> /dev/null; then
    echo "LiteLLM is not installed. Please run 'python3 -m venv .venv && source .venv/bin/activate && pip install \"litellm[proxy]\"' to install it."
    exit 1
fi

echo "Starting LiteLLM proxy..."

# Load environment variables using set -a to export all variables
set -a
if [ -f .env.litellm ]; then
  source .env.litellm
else
  echo "Warning: .env.litellm file not found! Models needing API keys will fail."
fi
set +a

# Start LiteLLM Proxy on port 4000
litellm --config litellm_config.yaml --port 4000
