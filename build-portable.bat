@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   Kountry Eyecare - Build Portable App
echo ========================================
echo.

:: Set paths
set "PROJECT_DIR=%~dp0"
set "PORTABLE_DIR=%PROJECT_DIR%KountryEyecare-Portable"

:: Clean previous build
echo [1/6] Cleaning previous build...
if exist "%PORTABLE_DIR%" rmdir /s /q "%PORTABLE_DIR%"
mkdir "%PORTABLE_DIR%"
mkdir "%PORTABLE_DIR%\data"
mkdir "%PORTABLE_DIR%\uploads"
mkdir "%PORTABLE_DIR%\frontend"

:: Step 2: Build Frontend
echo [2/6] Building Frontend...
cd /d "%PROJECT_DIR%frontend"
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)

:: Step 3: Copy frontend build
echo [3/6] Copying frontend build...
xcopy /E /I /Y "%PROJECT_DIR%frontend\dist\*" "%PORTABLE_DIR%\frontend\"

:: Step 4: Build Backend executable
echo [4/6] Building Backend executable...
cd /d "%PROJECT_DIR%backend"

:: Activate virtual environment
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else (
    echo ERROR: Virtual environment not found! Please create it first.
    echo Run: python -m venv venv
    echo Then: venv\Scripts\activate
    echo Then: pip install -r requirements.txt
    pause
    exit /b 1
)

:: Install PyInstaller if not present
pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo Installing PyInstaller...
    pip install pyinstaller
)

:: Build the executable
pyinstaller --noconfirm --onedir --console ^
    --name "KountryEyecare" ^
    --add-data "app;app" ^
    --collect-all uvicorn ^
    --collect-all fastapi ^
    --collect-all starlette ^
    --collect-all pydantic ^
    --collect-all pydantic_settings ^
    --collect-all jose ^
    --collect-all passlib ^
    --collect-all bcrypt ^
    --collect-all python_multipart ^
    --collect-all aiosqlite ^
    --collect-all sqlalchemy ^
    --collect-all email_validator ^
    --collect-all reportlab ^
    --collect-all PIL ^
    --collect-all httpx ^
    --hidden-import aiosqlite ^
    --hidden-import sqlalchemy.dialects.sqlite ^
    run_server.py

if errorlevel 1 (
    echo ERROR: Backend build failed!
    pause
    exit /b 1
)

:: Step 5: Copy backend executable and dependencies
echo [5/6] Copying backend files...
xcopy /E /I /Y "%PROJECT_DIR%backend\dist\KountryEyecare\*" "%PORTABLE_DIR%\"

:: Copy existing database if present
if exist "%PROJECT_DIR%backend\data\kountry_eyecare.db" (
    copy "%PROJECT_DIR%backend\data\kountry_eyecare.db" "%PORTABLE_DIR%\data\"
)

:: Step 6: Create launcher
echo [6/6] Creating launcher...

:: Create the main launcher batch file
(
echo @echo off
echo title Kountry Eyecare
echo echo ========================================
echo echo   Kountry Eyecare - Starting...
echo echo ========================================
echo echo.
echo cd /d "%%~dp0"
echo start "" "KountryEyecare.exe"
echo timeout /t 3 /nobreak ^> nul
echo start http://127.0.0.1:8000
echo echo.
echo echo Server running at: http://127.0.0.1:8000
echo echo.
echo echo Press any key to stop the server...
echo pause ^> nul
echo taskkill /F /IM KountryEyecare.exe 2^>nul
) > "%PORTABLE_DIR%\Start Kountry Eyecare.bat"

:: Copy icons
copy "%PROJECT_DIR%desktop\assets\icon.png" "%PORTABLE_DIR%\icon.png"
copy "%PROJECT_DIR%desktop\assets\icon.ico" "%PORTABLE_DIR%\icon.ico"

:: Create a VBS launcher for silent start (no console window)
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.CurrentDirectory = CreateObject^("Scripting.FileSystemObject"^).GetParentFolderName^(WScript.ScriptFullName^)
echo WshShell.Run "KountryEyecare.exe", 0, False
echo WScript.Sleep 3000
echo WshShell.Run "http://127.0.0.1:8000", 1, False
) > "%PORTABLE_DIR%\Kountry Eyecare.vbs"

:: Create a Windows shortcut with the custom icon
(
echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
echo sLinkFile = oWS.CurrentDirectory ^& "\Kountry Eyecare.lnk"
echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
echo oLink.TargetPath = oWS.CurrentDirectory ^& "\Kountry Eyecare.vbs"
echo oLink.WorkingDirectory = oWS.CurrentDirectory
echo oLink.IconLocation = oWS.CurrentDirectory ^& "\icon.ico"
echo oLink.Description = "Kountry Eyecare Clinic Management System"
echo oLink.Save
) > "%PORTABLE_DIR%\create-shortcut.vbs"
cscript //nologo "%PORTABLE_DIR%\create-shortcut.vbs"
del "%PORTABLE_DIR%\create-shortcut.vbs"

:: Create stop script
(
echo @echo off
echo echo Stopping Kountry Eyecare...
echo taskkill /F /IM KountryEyecare.exe 2^>nul
echo echo Done.
echo timeout /t 2
) > "%PORTABLE_DIR%\Stop Kountry Eyecare.bat"

:: Create README
(
echo ========================================
echo   KOUNTRY EYECARE - PORTABLE VERSION
echo ========================================
echo.
echo HOW TO USE:
echo -----------
echo 1. Double-click "Kountry Eyecare.vbs" to start the application
echo    ^(This will start silently and open your browser^)
echo.
echo 2. OR double-click "Start Kountry Eyecare.bat" to start with console
echo    ^(Shows server logs - useful for troubleshooting^)
echo.
echo 3. To stop: Double-click "Stop Kountry Eyecare.bat"
echo    OR close the console window if using the .bat launcher
echo.
echo DATA LOCATION:
echo --------------
echo - Database: data\kountry_eyecare.db
echo - Uploads: uploads\
echo.
echo IMPORTANT:
echo ----------
echo - Keep all files in this folder together
echo - You can copy this entire folder to any Windows PC
echo - No installation required!
echo.
) > "%PORTABLE_DIR%\README.txt"

echo.
echo ========================================
echo   BUILD COMPLETE!
echo ========================================
echo.
echo Portable app created at:
echo %PORTABLE_DIR%
echo.
echo To use:
echo 1. Copy the "KountryEyecare-Portable" folder to a USB drive
echo 2. On the target PC, double-click "Kountry Eyecare.vbs"
echo 3. The app will start and open in the browser
echo.
pause
