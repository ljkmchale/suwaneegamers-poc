@echo off
rem Daily Chronicle art drafts - run by the "SuwaneeGamers Chronicle Art"
rem scheduled task (as Larry, after the 10:34 Chronicle Sync). Drafts hero art
rem for new session chapters with Codex and publishes it when Codex's own
rem review passes. A failed review waits for
rem `node scripts\chronicle-art.mjs approve <campaign> <n>`.
rem Logs to logs\chronicle-art.log at the repo root.
cd /d "%~dp0.."
if not exist "logs" mkdir "logs"
echo [%date% %time%] chronicle art starting >> "logs\chronicle-art.log"
node scripts\chronicle-art.mjs run >> "logs\chronicle-art.log" 2>&1
echo [%date% %time%] chronicle art finished (exit %errorlevel%) >> "logs\chronicle-art.log"
