# PL Mapping Viewer Windows Setup

This folder is a standalone Windows setup package for `PL Mapping Viewer`.

## Windows Package Version

- Current: `v0.1`
- Source of truth: `VERSION.txt` in this folder

## What This Folder Contains

- `pl_mapping_viewer.py`
- `pl_mapping_static/`
- `launch_windows.py`
- `run_windows.bat`
- `build_exe.bat`
- `cmd_build.txt`
- `VERSION.txt`

## Option 1: Run With Python

If Python 3 is already installed on Windows:

1. Double-click `run_windows.bat`
2. The local viewer server starts
3. The browser opens automatically
4. Use `Choose Pickle File` to open your PL mapping file

## Option 2: Build EXE (One Click)

Double-click:

- `build_exe.bat`

Or run the same commands manually in CMD:

- `cmd_build.txt`

What it does:

1. Checks whether `pandas` and `PyInstaller` are installed
2. Installs them if needed
3. Builds the viewer server itself as the EXE:

```text
dist\PLMappingViewer\PLMappingViewer.exe
```

This EXE package is for Windows users who do not have Python installed.
The target PC does not need Python.
Only the build PC needs Python once to create the EXE.

## Important

- The generated app is a `--onedir` build
- Keep the whole `dist\PLMappingViewer` folder together
- Do not move only the `.exe` file by itself

## First Launch

- No bundled dataset folder is required
- Open the app and choose any `.pickle` file from your PC
