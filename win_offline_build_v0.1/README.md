# PL Mapping Viewer Offline Windows Build

This folder is for building a Windows EXE without internet access on the build PC.

## Version

- Current: `v0.1`
- Source of truth: `VERSION.txt`

## Goal

Build:

```text
dist\PLMappingViewer\PLMappingViewer.exe
```

without downloading anything from the internet.

## Required Offline Assets

You must place these files in this folder before running the build:

- `python\python.exe`
  - A local Windows Python installation or portable Python copy
- `wheels\`
  - Local wheel files for:
  - `pandas`
  - `pyinstaller`
  - and their dependencies

## Folder Layout

```text
win_offline_build_v0.1/
  build_offline_exe.bat
  launch_windows.py
  pl_mapping_viewer.py
  pl_mapping_static/
  python/
    python.exe
  wheels/
    *.whl
```

## How To Build Offline

1. Copy a working Windows Python into `python\`
2. Put required wheel files into `wheels\`
3. Double-click `build_offline_exe.bat`

## What The Script Does

1. Uses `python\python.exe`
2. Installs local wheels only with `--no-index`
3. Builds a `PyInstaller --onedir` package

## Important

- No internet is used
- The full `dist\PLMappingViewer\` folder must be kept together
- The target Windows PC does not need Python installed

## Included Files

- `pl_mapping_viewer.py`
- `pl_mapping_static/`
- `launch_windows.py`
- `build_offline_exe.bat`
- `VERSION.txt`

