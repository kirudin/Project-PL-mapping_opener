PL Mapping Viewer Windows Setup

This folder is a standalone Windows setup package for PL Mapping Viewer.

[Windows Package Version]
- Current: v0.1
- Source of truth: VERSION.txt in this folder

[What This Folder Contains]
- pl_mapping_viewer.py
- pl_mapping_static/
- launch_windows.py
- run_windows.bat
- build_exe.bat
- VERSION.txt

[Option 1: Run With Python]
If Python 3 is already installed on Windows:
1. Double-click run_windows.bat
2. The local viewer server starts
3. The browser opens automatically
4. Use Choose Pickle File to open your PL mapping file

[Option 2: Build EXE For Distribution]
Double-click:
- build_exe.bat

What it does:
1. Checks whether required packages are installed
2. Installs pandas and PyInstaller if needed
3. Builds:
   dist\PLMappingViewer\PLMappingViewer.exe

This EXE package is for Windows users who do not have Python installed.
The target PC does not need Python.
Only the build PC needs Python once to create the EXE.

[Important]
- The generated app is a --onedir build
- Keep the whole dist\PLMappingViewer folder together
- Do not move only the .exe file by itself
- Distribute the full dist\PLMappingViewer folder to Windows users

[First Launch]
- No bundled dataset folder is required
- Open the app and choose any .pickle file from your PC
