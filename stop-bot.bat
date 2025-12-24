@echo off
echo ========================================
echo   Stopping AI Trading Bot
echo ========================================
echo.

echo [*] Killing Node.js processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo     Node.js processes terminated
) else (
    echo     No Node.js processes found
)

echo [*] Killing Bun processes...
taskkill /F /IM bun.exe 2>nul
if %errorlevel% equ 0 (
    echo     Bun processes terminated
) else (
    echo     No Bun processes found
)

echo [*] Killing TSX processes...
taskkill /F /FI "WINDOWTITLE eq AI Trading Bot Backend*" 2>nul
taskkill /F /FI "WINDOWTITLE eq AI Trading Dashboard*" 2>nul

echo [*] Killing any remaining terminal processes...
taskkill /F /FI "WINDOWTITLE eq Administrator: *tsx*" 2>nul
taskkill /F /FI "WINDOWTITLE eq *vite*" 2>nul

echo.
echo ========================================
echo   All processes stopped
echo ========================================
echo.
pause
