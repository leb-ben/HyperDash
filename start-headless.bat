@echo off
REM Headless Production Startup Script for AI Trading Bot
REM Designed for server deployment without user interaction

title AI Trading Bot - Headless Mode
color 0A

REM Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

REM Log startup time
echo [%date% %time%] Starting AI Trading Bot in headless mode... >> logs\startup.log

REM Check dependencies
if not exist "node_modules" (
    echo [%date% %time%] Installing backend dependencies... >> logs\startup.log
    call bun install >> logs\startup.log 2>&1
    if %errorlevel% neq 0 (
        echo [%date% %time%] ERROR: Failed to install backend dependencies >> logs\startup.log
        exit /b 1
    )
)

if not exist "dashboard\node_modules" (
    echo [%date% %time%] Installing dashboard dependencies... >> logs\startup.log
    cd dashboard
    call bun install >> logs\startup.log 2>&1
    if %errorlevel% neq 0 (
        echo [%date% %time%] ERROR: Failed to install dashboard dependencies >> logs\startup.log
        exit /b 1
    )
    cd ..
)

REM Build if needed
if not exist "dist" (
    echo [%date% %time%] Building project... >> logs\startup.log
    call bun run build >> logs\startup.log 2>&1
    if %errorlevel% neq 0 (
        echo [%date% %time%] ERROR: Build failed >> logs\startup.log
        exit /b 1
    )
)

REM Validate environment
if not exist ".env" (
    echo [%date% %time%] ERROR: .env file missing >> logs\startup.log
    exit /b 1
)

REM Kill existing processes
echo [%date% %time%] Cleaning up existing processes... >> logs\startup.log
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3003 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5174 "') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

REM Start backend in background with output redirected to log
echo [%date% %time%] Starting backend... >> logs\startup.log
start /B cmd /c "bun run dev >> logs\backend.log 2>&1"

REM Wait for backend initialization
timeout /t 10 /nobreak >nul

REM Start dashboard in background with output redirected to log
echo [%date% %time%] Starting dashboard... >> logs\startup.log
start /B cmd /c "cd dashboard && bun run dev >> ..\logs\dashboard.log 2>&1"

REM Wait for dashboard initialization
timeout /t 8 /nobreak >nul

echo [%date% %time%] Bot started successfully in headless mode >> logs\startup.log
echo.
echo ========================================
echo    AI Trading Bot - Headless Mode
echo ========================================
echo.
echo Status: RUNNING
echo Backend API: http://localhost:3003
echo Dashboard: http://localhost:5173 or 5174
echo.
echo Logs:
echo   - Backend: logs\backend.log
echo   - Dashboard: logs\dashboard.log
echo   - Startup: logs\startup.log
echo.
echo Bot is running in background.
echo Check logs for monitoring.
echo.
