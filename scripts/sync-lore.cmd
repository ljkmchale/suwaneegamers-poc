@echo off
rem Weekly lore sync - run by the "SuwaneeGamers Lore Sync" Windows scheduled
rem task. Pulls the master lore Google Doc and merges the Territories table
rem into content\territories.json. Logs to logs\sync-lore.log at the repo root.
cd /d "%~dp0.."
if not exist "logs" mkdir "logs"
echo [%date% %time%] lore sync starting >> "logs\sync-lore.log"
node scripts\sync-lore.mjs >> "logs\sync-lore.log" 2>&1
echo [%date% %time%] lore sync finished (exit %errorlevel%) >> "logs\sync-lore.log"
