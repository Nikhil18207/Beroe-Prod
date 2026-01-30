@echo off
echo Starting Beroe Enterprise Platform...
echo.

:: Start backend in background
echo [1/2] Starting Backend on port 8000...
start "Backend" cmd /k "cd /d F:\Work Terminal\BeroeProd\backend && call Beroe\Scripts\activate && uvicorn main:app --reload --port 8000"

:: Wait a moment for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend
echo [2/2] Starting Frontend on port 3004...
start "Frontend" cmd /k "cd /d F:\Work Terminal\BeroeProd\frontend && npm run dev"

echo.
echo Both services starting...
echo - Backend: http://localhost:8000
echo - Frontend: http://localhost:3004
echo - API Docs: http://localhost:8000/docs
echo.
echo Press any key to open the app in browser...
pause >nul
start http://localhost:3004
