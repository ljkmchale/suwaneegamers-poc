@echo off
rem Content-sync safety net - run by the "SuwaneeGamers Content Sync" scheduled
rem task at 11:40, after the prod-embedded scheduler's daily jobs (10:00-11:25).
rem If the prod service is down at a job's scheduled minute, that day's sync -
rem including the Chronicles/Library reindex - is silently skipped. This task runs
rem content-scheduler.mjs --once, which runs only jobs whose next_run_at is due in
rem the shared SQLite state: a harmless no-op when prod already ran them, a
rem catch-up when prod was down. Pure content sync + reindex, no LLM.
cd /d "%~dp0.."
if not exist "logs" mkdir "logs"
echo [%date% %time%] content-sync safety net starting >> "logs\content-sync.log"
node scripts\content-scheduler.mjs --once >> "logs\content-sync.log" 2>&1
echo [%date% %time%] content-sync safety net finished (exit %errorlevel%) >> "logs\content-sync.log"
