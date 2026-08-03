@echo off
setlocal
cd /d "%~dp0"
start "" http://localhost:49215
npm run dev
