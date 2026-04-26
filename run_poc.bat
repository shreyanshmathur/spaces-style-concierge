@echo off
echo ====================================================
echo SPACES POC - Startup Script
echo ====================================================
echo.
echo Step 1: Installing Python dependencies...
python -m pip install -r backend\requirements.txt

echo.
echo Step 2: Starting Server on port 8001...
start "SPACES Backend" cmd /k "cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8001"

echo.
echo Server is starting... Please wait a few seconds...
timeout /t 4 /nobreak >nul

echo.
echo Automatically opening the SPACES clone in your browser...
start http://127.0.0.1:8001/index.html
