@echo off
title AI Trading Bot Launcher
color 0A

REM Check and install backend dependencies
if not exist "node_modules" (
    echo.
    echo ========================================
    echo   INSTALLING BACKEND DEPENDENCIES
    echo ========================================
    echo.
    call bun install
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to install backend dependencies!
        echo Check your Bun installation and try again.
        exit /b 1
    )
)

REM Check and install dashboard dependencies
if not exist "dashboard\node_modules" (
    echo.
    echo ========================================
    echo   INSTALLING DASHBOARD DEPENDENCIES
    echo ========================================
    echo.
    cd dashboard
    call bun install
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to install dashboard dependencies!
        exit /b 1
    )
    cd ..
)

if not exist "dist" (
    echo.
    echo Building project...
    echo.
    call bun run build
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Build failed!
        echo Check build errors and try again.
        exit /b 1
    )
)

if not exist ".env" (
    echo.
    echo ========================================
    echo   ENVIRONMENT CONFIGURATION MISSING!
    echo ========================================
    echo.
    echo Copy .env.example to .env and configure your API keys.
    echo Required: HYPERLIQUID_PRIVATE_KEY, HYPERLIQUID_WALLET_ADDRESS
    echo Optional: CEREBRAS_API_KEY, OPENAI_API_KEY, PERPLEXITY_API_KEY
    echo.
    exit /b 1
)

echo.
echo ========================================
echo    AI Trading Bot Launcher
echo ========================================
echo.

REM Kill any existing processes on our ports
echo [*] Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3003 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5174 "') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo [1/2] Starting AI Trading Bot Backend...
start "AI Trading Bot Backend" cmd /k "cd /d %~dp0 && bun run dev"

echo.
echo [*] Waiting for backend to initialize (10 seconds)...
echo     The backend needs time to connect to exchange and load AI models
timeout /t 10 /nobreak >nul

echo.
echo [2/2] Starting Dashboard (React)...
start "AI Trading Dashboard" cmd /k "cd /d %~dp0\dashboard && bun run dev"

echo.
echo [*] Waiting for dashboard to start (8 seconds)...
timeout /t 8 /nobreak >nul

echo.
echo ========================================
echo    STARTED SUCCESSFULLY
echo ========================================
echo.
echo    Backend API:  http://localhost:3003
echo    Dashboard:    http://localhost:5173 or 5174
echo    Mode:         LIVE TRADING (Hyperliquid Testnet)
echo    Wallet:       Real USDC funds
echo.
echo Two windows are running:
echo    - "AI Trading Bot Backend" (port 3003)
echo    - "AI Trading Dashboard" (port 5173/5174)
echo.
echo Bot is now running in headless mode.
echo Monitor logs in the backend window.
echo.
