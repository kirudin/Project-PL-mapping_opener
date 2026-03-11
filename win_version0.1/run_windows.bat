@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py launch_windows.py
) else (
  python launch_windows.py
)

if %errorlevel% neq 0 (
  echo.
  echo Failed to start PL Mapping Viewer.
  echo Check whether Python 3 is installed and available in PATH.
  pause
)

endlocal
