#!/bin/bash
set -euo pipefail

PROJECT_DIR="/Users/hwijewoo/Desktop/Project-PL mapping_opener"
SCRIPT_PATH="$PROJECT_DIR/pl_mapping_viewer.py"

choose_python() {
  if command -v python3 >/dev/null 2>&1; then
    if python3 -c "import pandas" >/dev/null 2>&1; then
      command -v python3
      return
    fi
  fi

  if [ -x /opt/anaconda3/bin/python3 ]; then
    if /opt/anaconda3/bin/python3 -c "import pandas" >/dev/null 2>&1; then
      echo /opt/anaconda3/bin/python3
      return
    fi
  fi

  if [ -x /opt/homebrew/bin/python3 ]; then
    if /opt/homebrew/bin/python3 -c "import pandas" >/dev/null 2>&1; then
      echo /opt/homebrew/bin/python3
      return
    fi
  fi

  echo ""
}

PYTHON_BIN="$(choose_python)"

if [ -z "$PYTHON_BIN" ]; then
  osascript -e 'display alert "PL Mapping Viewer" message "No Python with pandas was found. Install pandas or run with /opt/anaconda3/bin/python3." as critical'
  exit 1
fi

cd "$PROJECT_DIR"
exec "$PYTHON_BIN" "$SCRIPT_PATH"
