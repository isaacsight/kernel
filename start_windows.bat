@echo off
echo Starting Frontier Team Backend (Windows)...
echo.

:: Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not in PATH. Please install Python 3.9+.
    pause
    exit /b
)

:: Install dependencies
echo Installing/Updating dependencies...
pip install fastapi uvicorn websockets pydantic python-dotenv google-generativeai openai anthropic

:: Run Server
echo.
echo Starting Server on 0.0.0.0:8000...
echo You can access this from your phone using your Windows machine's IP address.
echo.
python server.py
pause
