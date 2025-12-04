@echo off
echo ========================================
echo   AI Trading Bot + Dashboard Launcher
echo ========================================
echo.

REM Kill any existing processes on ports 3001 and 5175
echo Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5175') do taskkill /F /PID %%a 2>nul

echo.
echo [1/3] Starting Trading Bot (Paper Trading Mode)...
start "AI Trading Bot" cmd /k "cd /d %~dp0 && bun run start"

echo [2/3] Starting Dashboard...
timeout /t 3 /nobreak >nul
start "Dashboard" cmd /k "cd /d %~dp0\dashboard && bun run dev"

echo [3/3] Opening Web Dashboard...
timeout /t 5 /nobreak >nul
start http://localhost:5175
start http://localhost:3001/api/bot/status

echo.
echo ========================================
echo   ✅ Everything Started Successfully!
echo ========================================
echo.
echo 📡 Trading Bot API: Running on port 3001
echo 🌐 Web Dashboard: http://localhost:5175
echo 🤖 Bot Status: http://localhost:3001/api/bot/status
echo.
echo Mode: PAPER TRADING (Safe for testing)
echo Features: Sentiment-enhanced AI, Build Mode, Risk Settings
echo.
echo Both windows will stay open for monitoring.
echo Press Ctrl+C in each window to stop services.
echo.
pause
