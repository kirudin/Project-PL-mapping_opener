@echo off
setlocal
cd /d "%~dp0"
set WIN_PKG_VERSION=v0.1

echo PL Mapping Viewer Windows Package %WIN_PKG_VERSION%
echo.

echo.
echo [1/2] Checking Python and required packages...
where py >nul 2>nul
if %errorlevel%==0 (
  py -m pip show pandas >nul 2>nul
  if %errorlevel% neq 0 (
    echo pandas is not installed. Installing now...
    py -m pip install pandas
    if %errorlevel% neq 0 goto :install_failed
  )
  py -m pip show pyinstaller >nul 2>nul
  if %errorlevel% neq 0 (
    echo PyInstaller is not installed. Installing now...
    py -m pip install pyinstaller
    if %errorlevel% neq 0 goto :install_failed
  )
  set PY_CMD=py
) else (
  where python >nul 2>nul
  if %errorlevel% neq 0 goto :python_missing
  python -m pip show pandas >nul 2>nul
  if %errorlevel% neq 0 (
    echo pandas is not installed. Installing now...
    python -m pip install pandas
    if %errorlevel% neq 0 goto :install_failed
  )
  python -m pip show pyinstaller >nul 2>nul
  if %errorlevel% neq 0 (
    echo PyInstaller is not installed. Installing now...
    python -m pip install pyinstaller
    if %errorlevel% neq 0 goto :install_failed
  )
  set PY_CMD=python
)

echo.
echo [2/2] Building PLMappingViewer.exe...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist PLMappingViewer.spec del /f /q PLMappingViewer.spec
%PY_CMD% -m PyInstaller --noconfirm --onedir --console --name PLMappingViewer --collect-all pandas --collect-all numpy --exclude-module matplotlib --exclude-module scipy --exclude-module PIL --add-data "pl_mapping_static;pl_mapping_static" pl_mapping_viewer.py
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
echo Python was not found in PATH.
echo Install Python 3 first, then run this file again.
pause
endlocal
exit /b 1

:install_failed
echo.
echo Failed to install one or more required packages.
echo Try installing manually:
echo py -m pip install pandas pyinstaller
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
