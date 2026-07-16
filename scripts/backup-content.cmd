@echo off
rem Nightly content backup - run by the "SuwaneeGamers Content Backup" Windows
rem scheduled task. Copies content\ (SQLite via online backup API) into
rem backups\YYYY-MM-DD\ at the repo root and keeps 14 days of backups.
rem Logs to logs\backup-content.log at the repo root.
cd /d "%~dp0.."
if not exist "logs" mkdir "logs"
echo [%date% %time%] content backup starting >> "logs\backup-content.log"
node scripts\backup-content.mjs >> "logs\backup-content.log" 2>&1
echo [%date% %time%] content backup finished (exit %errorlevel%) >> "logs\backup-content.log"
