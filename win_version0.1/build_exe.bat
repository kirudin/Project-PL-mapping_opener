@echo off
setlocal
cd /d "%~dp0"
set WIN_PKG_VERSION=v0.1

echo PL Mapping Viewer Windows Package %WIN_PKG_VERSION%
echo.

echo [1/3] Checking Python...
where py >nul 2>nul
if %errorlevel%==0 (
  set PY_CMD=py
) else (
  where python >nul 2>nul
  if %errorlevel% neq 0 goto :python_missing
  set PY_CMD=python
)

echo.
echo [2/3] Checking required packages...
%PY_CMD% -m pip show pandas >nul 2>nul
if %errorlevel% neq 0 (
  echo pandas is not installed. Installing now...
  %PY_CMD% -m pip install pandas
  if %errorlevel% neq 0 goto :install_failed
)

%PY_CMD% -m pip show pyinstaller >nul 2>nul
if %errorlevel% neq 0 (
  echo PyInstaller is not installed. Installing now...
  %PY_CMD% -m pip install pyinstaller
  if %errorlevel% neq 0 goto :install_failed
)

echo.
echo [3/3] Building PLMappingViewer.exe...
%PY_CMD% -m PyInstaller --noconfirm --onedir --console --name PLMappingViewer --add-data "pl_mapping_static;pl_mapping_static" --add-data "pl_mapping_viewer.py;." launch_windows.py
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
