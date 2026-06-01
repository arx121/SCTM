@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "ROOT=%~dp0"
set "SRC=%ROOT%main"
set "DATA=%ROOT%main\data"
set "APP=%TEMP%\SoundCloudRandomMusic\app"

if not exist "%DATA%" mkdir "%DATA%" >nul 2>nul
if not exist "%APP%" mkdir "%APP%" >nul 2>nul

rem User data is portable and stays inside this folder: .\main\data
rem The app itself is copied to TEMP before launch so this folder is not locked by node/npm/mpv.
robocopy "%SRC%" "%APP%" /MIR /XD node_modules .git data /XF package-lock.json >nul
if errorlevel 8 (
  echo Failed to copy app files to "%APP%".
  echo Close SRM/PowerShell/mpv if they are still running and try again.
  pause
  exit /b 1
)

set "SRM_DATA_DIR=%DATA%"
set "SRM_PORTABLE_ROOT=%ROOT%"

where wt.exe >nul 2>nul
if %errorlevel%==0 (
  start "" wt.exe -w 0 new-tab --title "SoundCloud Random Music" -d "%APP%" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%APP%\start.ps1"
  exit /b 0
)

start "SoundCloud Random Music" powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -File "%APP%\start.ps1"
exit /b 0
