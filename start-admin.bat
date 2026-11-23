@echo off
setlocal
title Undertow local tree editor
set "UNDERTOW_LAUNCHER=%~f0"
set "UNDERTOW_LAUNCHER_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Undertow Admin.lnk')); $s.TargetPath=$env:UNDERTOW_LAUNCHER; $s.WorkingDirectory=$env:UNDERTOW_LAUNCHER_DIR; $s.Save()" >nul 2>&1
set "NODE_EXE=node"
where node >nul 2>&1
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
  ) else if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
  ) else (
    echo Node.js is not installed or Windows cannot find it.
    echo Install Node.js, restart this window, and double-click this file again.
    echo The download is at https://nodejs.org/
    pause
    exit /b 1
  )
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-admin.ps1" -NodeExecutable "%NODE_EXE%"
if errorlevel 1 echo The editor stopped because of the error shown above.
pause
