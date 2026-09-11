#!/bin/bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"
PYTHON_BIN="${PL_MAPPING_PYTHON:-}"
if [ -z "$PYTHON_BIN" ]; then
  for candidate in "$PROJECT_DIR/.venv/bin/python3" "$(command -v python3 || true)" /opt/anaconda3/bin/python3; do
    if [ -x "$candidate" ] && "$candidate" -c 'import numpy, pandas, certifi' >/dev/null 2>&1; then
      PYTHON_BIN="$candidate"
      break
    fi
  done
fi
if [ -z "$PYTHON_BIN" ]; then
  echo "Install Python dependencies: python3 -m pip install -r requirements.txt"
  exit 1
fi
exec "$PYTHON_BIN" "$PROJECT_DIR/pl_mapping_viewer.py" "$@"
