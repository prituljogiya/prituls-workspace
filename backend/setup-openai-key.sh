#!/bin/bash
# Add OpenAI API key to .env from environment — never hardcode secrets.

set -e
cd "$(dirname "$0")"

if [ -z "$OPENAI_API_KEY" ]; then
  echo "❌ Set OPENAI_API_KEY first, e.g.:"
  echo "   export OPENAI_API_KEY=sk-..."
  echo "   ./setup-openai-key.sh"
  exit 1
fi

if [ -f .env ]; then
  if grep -q "^OPENAI_API_KEY=" .env; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=${OPENAI_API_KEY}|" .env
    else
      sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=${OPENAI_API_KEY}|" .env
    fi
  else
    echo "OPENAI_API_KEY=${OPENAI_API_KEY}" >> .env
  fi
else
  echo "OPENAI_API_KEY=${OPENAI_API_KEY}" > .env
fi

echo "✅ OPENAI_API_KEY written to .env (do not commit .env)"
