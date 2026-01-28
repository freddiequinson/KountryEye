@echo off
echo ========================================
echo   Kountry Eyecare - Development Server
echo ========================================
echo.

:: Start Backend
echo Starting Backend Server...
cd /d "%~dp0backend"
start "Kountry Backend" cmd /k "call venv\Scripts\activate && python -m uvicorn app.main:app --reload --port 8000"

:: Wait a moment for backend to start
timeout /t 3 /nobreak > nul

:: Start Frontend
echo Starting Frontend Server...
cd /d "%~dp0frontend"
start "Kountry Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo   Servers Starting...
echo   Backend: http://localhost:8000
echo   Frontend: http://localhost:5173
echo ========================================
echo.
echo Press any key to open the app in browser...
pause > nul
start http://localhost:5173
