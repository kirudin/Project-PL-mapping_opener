from __future__ import annotations
import json
import math
import os
import sys
import tempfile
import threading
from pathlib import Path

APP_VERSION = "0.3.3"
def data_home() -> Path:
    if os.environ.get("PL_MAPPING_DATA_HOME"):
        return Path(os.environ["PL_MAPPING_DATA_HOME"]).expanduser().resolve()
    if sys.platform == "darwin":
        return Path.home() / "Library/Application Support/PL Mapping Viewer"
    if os.name == "nt":
        return Path(os.environ.get("APPDATA", str(Path.home()))) / "PL Mapping Viewer"
    return Path(os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local/share"))) / "PL Mapping Viewer"

DATA_HOME = data_home()
UPLOAD_DIR = (DATA_HOME / "uploads").resolve()
LEGACY_UPLOAD_DIR = (Path(tempfile.gettempdir()) / "pl-mapping-viewer-uploads").resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SESSION_PATH = DATA_HOME / "session.json"
_SESSION_LOCK = threading.Lock()

def load_session() -> dict:
    with _SESSION_LOCK:
        try:
            return json.loads(SESSION_PATH.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

def save_session(payload: dict) -> None:
    if not isinstance(payload, dict) or payload.get("schema_version") != 3:
        raise ValueError("Unsupported session schema; expected version 3")
    text = json.dumps(payload, ensure_ascii=False, allow_nan=False)
    with _SESSION_LOCK:
        if "saved_at_ms" in payload:
            stamp = payload["saved_at_ms"]
            if not isinstance(stamp, (int, float)) or not math.isfinite(stamp):
                raise ValueError("Invalid session timestamp")
            try:
                previous = json.loads(SESSION_PATH.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                previous = {}
            if previous.get("saved_at_ms", -1) > stamp:
                return
        fd, name = tempfile.mkstemp(prefix="session-", suffix=".tmp", dir=DATA_HOME)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(text)
                f.flush()
                os.fsync(f.fileno())
            os.replace(name, SESSION_PATH)
        finally:
            Path(name).unlink(missing_ok=True)
