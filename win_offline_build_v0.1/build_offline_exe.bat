@echo off
setlocal
cd /d "%~dp0"
set WIN_PKG_VERSION=v0.1

set PY_DIR=%CD%\python
set PY_EXE=%PY_DIR%\python.exe
set WHEEL_DIR=%CD%\wheels

echo PL Mapping Viewer Offline Windows Build %WIN_PKG_VERSION%
echo.

if not exist "%PY_EXE%" goto :python_missing
if not exist "%WHEEL_DIR%" goto :wheels_missing

echo [1/2] Installing local wheels...
"%PY_EXE%" -m pip install --no-index --find-links="%WHEEL_DIR%" pandas pyinstaller
if %errorlevel% neq 0 goto :install_failed

echo.
echo [2/2] Building PLMappingViewer.exe...
"%PY_EXE%" -m PyInstaller --noconfirm --onedir --console --name PLMappingViewer --add-data "pl_mapping_static;pl_mapping_static" --add-data "pl_mapping_viewer.py;." launch_windows.py
if %errorlevel% neq 0 goto :build_failed

echo.
echo Build completed.
echo Output:
echo %CD%\dist\PLMappingViewer\PLMappingViewer.exe
echo.
echo Keep the full dist\PLMappingViewer folder together.
pause
endlocal
exit /b 0

:python_missing
echo.
echo Missing offline Python runtime:
echo %PY_EXE%
echo.
echo Copy a Windows Python folder into:
echo %PY_DIR%
pause
endlocal
exit /b 1

:wheels_missing
echo.
echo Missing wheel directory:
echo %WHEEL_DIR%
echo.
echo Create the wheels folder and copy local .whl files into it.
pause
endlocal
exit /b 1

:install_failed
echo.
echo Failed to install local wheel packages.
echo Make sure the wheels folder contains pandas, pyinstaller, and dependencies.
pause
endlocal
exit /b 1

:build_failed
echo.
echo Build failed.
echo Review the messages above for details.
pause
endlocal
exit /b 1
