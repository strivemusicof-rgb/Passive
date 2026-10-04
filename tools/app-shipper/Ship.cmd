@echo off
rem App Shipper: double-click to open. Keep this window open while shipping.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening the download page...
  start "" https://nodejs.org/en/download
  pause
  exit /b 1
)
title App Shipper
node server.mjs
pause
