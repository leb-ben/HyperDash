@echo off
echo Starting AI Trading Bot...
echo.

:: Start backend in new window
start "Trading Bot Backend" cmd /k "cd /d %~dp0 && set PAPER_TRADING=true && npm run dev"

:: Wait 3 seconds for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend in new window  
start "Trading Bot Dashboard" cmd /k "cd /d %~dp0\dashboard && npm run dev"

echo.
echo Bot starting in paper trading mode!
echo Dashboard will open at: http://localhost:5173
echo API server at: http://localhost:3001
echo.
echo Press any key to close this window...
pause >nul
