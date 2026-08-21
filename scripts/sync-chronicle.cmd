@echo off
rem Daily chronicle sync - run by the "SuwaneeGamers Chronicle Sync" scheduled
rem task. Pulls the HOE session-notes Google Doc and rebuilds the living
rem chronicle page (chronicle-poc\emberstran-chronicle.html). Per-session
rem images in chronicle-poc\session-images.json are preserved.
rem Logs to logs\sync-chronicle.log at the repo root.
cd /d "%~dp0.."
if not exist "logs" mkdir "logs"
echo [%date% %time%] chronicle sync starting >> "logs\sync-chronicle.log"
node scripts\sync-chronicle.mjs >> "logs\sync-chronicle.log" 2>&1
echo [%date% %time%] chronicle sync finished (exit %errorlevel%) >> "logs\sync-chronicle.log"
