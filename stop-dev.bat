@echo off
echo Stopping Kountry Eyecare servers...
taskkill /FI "WINDOWTITLE eq Kountry Backend*" /F 2>nul
taskkill /FI "WINDOWTITLE eq Kountry Frontend*" /F 2>nul
taskkill /F /IM node.exe 2>nul
taskkill /F /IM python.exe 2>nul
echo Done.
pause
