# PL Mapping Viewer

Version: 0.3.4 — 2026-09-11

Local PL map and spectrum analysis. This release establishes a shared macOS/Windows
source and corrects data/export/session behavior before extending analysis features.

## Run from source

Python 3.10+; install `python3 -m pip install -r requirements.txt` in a virtual environment.

- macOS: double-click `run_pl_mapping.command`.
- Windows: `run_pl_mapping.bat`.
- Manual: `python3 pl_mapping_viewer.py --port 8234`.
- Headless: append `--no-browser`. Port conflicts try the next 19 ports; `--port 0` chooses any free port.
- Stop: Ctrl+C in the launcher terminal.

## Workflow

Open Data File → choose file → confirm dimensions → select a wavelength/range →
select points or lines → inspect spectra or heatmap → export / save session.
Read [USER_GUIDE.txt](USER_GUIDE.txt) for input conventions, missing values, and export semantics.

## Build on the target OS

Create an isolated environment and install `requirements-build.txt`, then run
`python scripts/build_binary.py`. On Windows use `build_windows_binary.bat`.
The shared root source is used on both OSes. No cross-compilation is assumed.

ZIPs appear in `release/`, containing a PyInstaller directory bundle, version and
user guide. Keep the whole extracted folder together. Python is not needed by recipients.
The macOS folder includes `Launch PL Mapping Viewer.command`; Windows includes
`PL-Mapping-Viewer.exe`. macOS launcher log: `~/Library/Logs/PL Mapping Viewer/launcher.log`.
Windows diagnostics remain in the console window.

Code signing/notarization is not configured. Package building is distinct from public release publishing.
This repository publishes the shared application source, developer documentation, tests and
build scripts. Packaged executables are distributed through GitHub Releases. Measurement
data, local environments and generated build folders are not source-control inputs.
The app checks GitHub once daily (can be disabled), supports manual checks and preview/stable filtering, and opens release pages only when clicked. No automatic package download/install is performed.
The v0.3.0 and v0.3.1 previews are available on [GitHub Releases](https://github.com/kirudin/Project-PL-mapping_opener/releases).
Those original release tags predate the source publication; use the source-commit links in
the release notes or the current main branch for the updated implementation.

## User data

Uploads and the latest session live outside the package:

- macOS: `~/Library/Application Support/PL Mapping Viewer/`
- Windows: `%APPDATA%\PL Mapping Viewer\`
- Linux: `$XDG_DATA_HOME/PL Mapping Viewer/` or `~/.local/share/PL Mapping Viewer/`

`PL_MAPPING_DATA_HOME` overrides this directory for isolated tests. Replacing the package
preserves it. Uploaded files are retained until the user removes them; no automatic cleanup.
Session writes are atomic. Save session also downloads a JSON snapshot. The original source
file must still be accessible when reopening a session. JSON does not bundle the whole cube.
Legacy browser storage is read as a fallback; it is not erased. Old temporary uploads may
already have been removed by the OS and cannot be recovered by this update.

## Development and verification

- `python -m unittest discover -s tests -v`
- `node tests/test_processing.cjs`
- `node tests/test_updates.cjs`
- `node --check pl_mapping_static/app.js`
- `bash -n run_pl_mapping.command`

See [DEVELOPER_HANDOFF.md](DEVELOPER_HANDOFF.md), [docs/VALIDATION.md](docs/VALIDATION.md),
[CHANGELOG.md](CHANGELOG.md), and [docs/LEGACY_VERSIONS.md](docs/LEGACY_VERSIONS.md).

Update settings are stored per browser origin; lookup cache is in app-data/update-cache.json. Only public GitHub release metadata is requested; measurements and session contents are never sent.

### macOS 0.3.2 packaging fix

Download the v0.3.2 macOS arm64 ZIP and extract into a fresh folder, then run
`Launch PL Mapping Viewer.command`. Do not merge it with an older `_internal` folder.
Python and native libraries are embedded in one executable, matching the TMM console
build approach. macOS builds are ad-hoc signed, not Developer ID signed or notarized:
initial macOS approval can still be required. Browser-download Gatekeeper behavior
has not been verified on a clean Mac. No security settings are changed by the launcher.
Saved sessions/uploads remain in the existing application data folder.

### Pickle compatibility fix (0.3.3)

Use v0.3.3 or newer for existing NumPy/pandas pickle measurements. Earlier binaries
omitted NumPy 1.x compatibility modules, causing file analysis/pixel recommendations
to fail. Pickle failures now report their cause without retrying binary data as text.
For packaging verification, run `python tests/smoke_binary_pickle.py /path/to/executable`
with NumPy/pandas installed in the test interpreter. This uploads synthetic legacy
pickles into temporary app storage and checks pixel analysis and map generation.
