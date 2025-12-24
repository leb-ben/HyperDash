@echo off
title Trading Bot Cleanup for Sharing
color 0A

echo.
echo ========================================
echo    CLEANUP SCRIPT FOR SHARING
echo ========================================
echo.
echo This will remove build artifacts and dependencies
echo to reduce the project size for sharing with coworkers.
echo.
echo The bot will need to be re-setup after cleanup.
echo.

set /p confirm="Continue with cleanup? (y/N): "
if /i not "%confirm%"=="y" goto :cancel

echo.
echo [*] Removing node_modules...
if exist "node_modules" (
    rmdir /s /q "node_modules"
    echo    ✓ Removed main node_modules
)

echo [*] Removing dashboard node_modules...
if exist "dashboard\node_modules" (
    rmdir /s /q "dashboard\node_modules"
    echo    ✓ Removed dashboard node_modules
)

echo [*] Removing dist folder...
if exist "dist" (
    rmdir /s /q "dist"
    echo    ✓ Removed dist
)

echo [*] Removing dashboard dist...
if exist "dashboard\dist" (
    rmdir /s /q "dashboard\dist"
    echo    ✓ Removed dashboard dist
)

echo [*] Clearing log files...
if exist "data\bot.log" (
    echo. > "data\bot.log"
    echo    ✓ Cleared bot.log
)
if exist "data\error.log" (
    echo. > "data\error.log"
    echo    ✓ Cleared error.log
)

echo [*] Removing paper trading database...
if exist "data\paper_trades.db" (
    del "data\paper_trades.db"
    echo    ✓ Removed paper_trades.db
)

echo.
echo ========================================
echo    CLEANUP COMPLETE
echo ========================================
echo.

REM Show final size
for /f "tokens=*" %%a in ('powershell -Command "Get-ChildItem -Recurse -File | Measure-Object Length -Sum | Select-Object -ExpandProperty Sum"') do set total_bytes=%%a
powershell -Command "Write-Host 'Total size:' ([math]::Round(%total_bytes% / 1MB, 2)) 'MB'"

echo.
echo To restore the bot after sharing:
echo 1. Run: npm install
echo 2. Run: npm run build
echo 3. Copy .env.example to .env and configure
echo 4. Run: start-everything.bat
echo.
pause
goto :eof

:cancel
echo.
echo Cleanup cancelled.
echo.
pause
