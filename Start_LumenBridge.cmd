@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
    python final\run_app.py
) else (
    py -3 final\run_app.py
)
pause
