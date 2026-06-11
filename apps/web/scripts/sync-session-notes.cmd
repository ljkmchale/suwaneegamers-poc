@echo off
rem Daily session-notes sync — run by the "SuwaneeGamers Session Notes Sync"
rem Windows scheduled task. Logs to logs\sync-session-notes.log at the repo root.
cd /d "%~dp0.."
if not exist "..\..\logs" mkdir "..\..\logs"
echo [%date% %time%] sync starting >> "..\..\logs\sync-session-notes.log"
call npx tsx scripts\sync-session-notes.ts >> "..\..\logs\sync-session-notes.log" 2>&1
echo [%date% %time%] sync finished (exit %errorlevel%) >> "..\..\logs\sync-session-notes.log"
