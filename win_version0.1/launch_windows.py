from __future__ import annotations

import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path


HOST = "127.0.0.1"
PORT = 8234
URL = f"http://{HOST}:{PORT}"


def wait_for_server(host: str, port: int, timeout: float = 15.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def main() -> int:
    root = Path(__file__).resolve().parent
    server_script = root / "pl_mapping_viewer.py"
    if not server_script.exists():
        print("pl_mapping_viewer.py was not found.")
        print(f"Expected: {server_script}")
        return 1

    proc = subprocess.Popen(
        [sys.executable, str(server_script)],
        cwd=str(root),
    )

    try:
        if wait_for_server(HOST, PORT):
            webbrowser.open(URL)
            print(f"PL Mapping Viewer is running at {URL}")
            print("Press Ctrl+C to stop the local server.")
        else:
            print("The server did not start in time.")
            proc.terminate()
            return 1
        return proc.wait()
    except KeyboardInterrupt:
        print("\nStopping PL Mapping Viewer...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
