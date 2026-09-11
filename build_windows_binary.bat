@echo off
setlocal
cd /d "%~dp0"
if not exist ".build-venv-windows\Scripts\python.exe" py -3 -m venv .build-venv-windows
if errorlevel 1 goto :failed
".build-venv-windows\Scripts\python.exe" -m pip install -r requirements-build.txt
if errorlevel 1 goto :failed
".build-venv-windows\Scripts\python.exe" scripts\build_binary.py
if errorlevel 1 goto :failed
pause
exit /b 0
:failed
echo Build failed. Review the error above.
pause
exit /b 1
