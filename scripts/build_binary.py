#!/usr/bin/env python3
"""Build one canonical source tree on the target OS; publish nothing."""
from pathlib import Path
import sys
import platform
import subprocess
import shutil
import zipfile
from datetime import date
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
# Read version without importing runtime_paths (which initializes user storage).
import ast
version = next(ast.literal_eval(n.value) for n in ast.parse((ROOT / "runtime_paths.py").read_text()).body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "APP_VERSION" for t in n.targets))
name = "PL-Mapping-Viewer"
def main():
    command = [sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile" if sys.platform == "darwin" else "--onedir", "--console", "--name", name,
               "--distpath", str(ROOT / "dist" / platform.system()), "--workpath", str(ROOT / "build/pyinstaller"), "--specpath", str(ROOT / "build"),
               "--add-data", str(ROOT / "pl_mapping_static") + (";" if sys.platform == "win32" else ":") + "pl_mapping_static",
               "--exclude-module", "matplotlib", "--exclude-module", "scipy", "--exclude-module", "IPython", "--exclude-module", "tkinter",
               str(ROOT / "pl_mapping_viewer.py")]
    subprocess.run(command, cwd=ROOT, check=True)
    built = ROOT / "dist" / platform.system() / name
    package = ROOT / "build" / "release_staging" / name
    if package.exists():
        shutil.rmtree(package)
    if sys.platform == "darwin":
        package.mkdir(parents=True)
        shutil.copy2(built, package / name)
        subprocess.run(["codesign", "--verify", "--strict", str(package / name)], check=True)
    else:
        shutil.copytree(built, package)
    for document in ("USER_GUIDE.txt",):
        shutil.copy2(ROOT / document, package / document)
    (package / "VERSION.txt").write_text(version + "\n")
    if sys.platform == "darwin":
        launcher = package / "Launch PL Mapping Viewer.command"
        launcher.write_text('''#!/bin/bash
set -o pipefail
cd "$(dirname "$0")" || exit 1
LOG_DIR="$HOME/Library/Logs/PL Mapping Viewer"
mkdir -p "$LOG_DIR"
./PL-Mapping-Viewer "$@" 2>&1 | tee -a "$LOG_DIR/launcher.log"
result=${PIPESTATUS[0]}
if [ "$result" -ne 0 ]; then read -r -p "Launch failed. Press Enter to close."; fi
exit "$result"
''')
        launcher.chmod(0o755)
    release = ROOT / "release"
    release.mkdir(exist_ok=True)
    target = release / f"{name}-{platform.system()}-{platform.machine()}-v{version}-{date.today()}.zip"
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
        for path in sorted(package.rglob("*")):
            if path.is_file():
                z.write(path, path.relative_to(package.parent))
    print(f"Release: {target}")
if __name__ == "__main__":
    main()
