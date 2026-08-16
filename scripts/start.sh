#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi
echo "Starting xhs-studio at http://127.0.0.1:8765/"
exec python main.py
