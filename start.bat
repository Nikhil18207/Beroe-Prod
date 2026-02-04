@echo off
echo Starting Beroe Prod - Frontend and Backend
echo ==========================================

:: Start backend in a new window
echo Starting Backend on port 8000...
start "Beroe Backend" cmd /k "cd /d f:\Work Terminal\BeroeProd\backend && .venv\Scripts\activate && python -m uvicorn app.main:app --reload --port 8000"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak > nul

:: Start frontend in a new window
echo Starting Frontend on port 3001...
start "Beroe Frontend" cmd /k "cd /d f:\Work Terminal\BeroeProd\frontend && npm run dev"

echo.
echo Both servers starting...
echo - Backend: http://localhost:8000
echo - Frontend: http://localhost:3001
echo.
echo Close this window when done. The server windows will remain open.
