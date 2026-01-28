@echo off
echo ========================================
echo   Kountry Eyecare - Build Desktop App
echo ========================================
echo.

:: Step 1: Build Frontend
echo [1/4] Building Frontend...
cd /d "%~dp0frontend"
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)

:: Step 2: Copy frontend build to desktop
echo [2/4] Copying frontend build...
cd /d "%~dp0desktop"
if exist "frontend-build" rmdir /s /q "frontend-build"
xcopy /E /I /Y "%~dp0frontend\dist" "frontend-build"

:: Step 3: Create backend executable with PyInstaller
echo [3/4] Building Backend executable...
cd /d "%~dp0backend"
call venv\Scripts\activate
pip install pyinstaller -q
pyinstaller --onefile --name kountry-backend --add-data "app;app" --hidden-import uvicorn.logging --hidden-import uvicorn.protocols.http --hidden-import uvicorn.protocols.http.auto --hidden-import uvicorn.protocols.websockets --hidden-import uvicorn.protocols.websockets.auto --hidden-import uvicorn.lifespan --hidden-import uvicorn.lifespan.on app\main.py
if errorlevel 1 (
    echo ERROR: Backend build failed!
    pause
    exit /b 1
)

:: Step 4: Copy backend dist to desktop
echo [4/4] Copying backend executable...
cd /d "%~dp0desktop"
if exist "backend-dist" rmdir /s /q "backend-dist"
mkdir "backend-dist"
copy "%~dp0backend\dist\kountry-backend.exe" "backend-dist\"
copy "%~dp0backend\.env" "backend-dist\" 2>nul
copy "%~dp0backend\kountry_eyecare.db" "backend-dist\" 2>nul

:: Step 5: Build Electron app
echo [5/5] Building Electron installer...
call npm install
call npm run build:win

echo.
echo ========================================
echo   Build Complete!
echo   Installer: desktop\dist\
echo ========================================
pause
