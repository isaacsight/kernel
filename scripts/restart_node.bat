@echo off
title Studio OS Node - Auto Restart
color 0A

:start
cls
echo ==================================================
echo   STUDIO OS NODE - WATCHDOG
echo ==================================================
echo.
echo [1/3] Killing old processes...
taskkill /f /im python.exe >nul 2>&1

echo [2/3] Pulling latest code...
git pull

echo [3/3] Starting Studio Node...
echo.
python admin/studio_node.py

echo.
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
echo   CRASH DETECTED - RESTARTING IN 5 SECONDS
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
timeout /t 5
goto start
