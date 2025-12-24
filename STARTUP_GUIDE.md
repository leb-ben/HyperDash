# AI Trading Bot - Startup Script

## What `start-everything.bat` Does

This script automatically sets up and starts your AI trading bot with proper error handling and dependency management.

### Prerequisites Check:
- ✅ **Node.js**: Verifies Node.js is installed
- ✅ **Dependencies**: Installs `npm install` if `node_modules` is missing
- ✅ **Build**: Runs `npm run build` if `dist/` folder doesn't exist
- ✅ **Configuration**: Validates `.env` file exists and contains required keys

### Required Environment Variables:
```env
HYPERLIQUID_PRIVATE_KEY=0x...your_private_key
HYPERLIQUID_WALLET_ADDRESS=0x...your_wallet_address
HYPERLIQUID_TESTNET=true
CEREBRAS_API_KEY=your_cerebras_api_key
```

### What It Starts:
1. **AI Trading Bot**: Runs `npm run dev` (live trading mode on Hyperliquid testnet)
2. **Dashboard**: Opens http://localhost:3003 in your browser
3. **Process Management**: Kills any existing processes on port 3003

### Output:
- Green success messages with clear status updates
- Error messages if something goes wrong
- One minimized command window running the bot

### To Stop:
- Close the "AI Trading Bot" command window
- Or press Ctrl+C in the command window

## Troubleshooting:

**"Dependencies missing"**: The script will install them automatically
**"Build failed"**: Check TypeScript errors in the console
**"Environment configuration missing"**: Copy `.env.example` to `.env` and add your keys
**Port 3003 in use**: Script kills existing processes automatically

## Manual Alternative:
If you prefer manual control:
```bash
npm install
npm run build
npm run dev
```

Then open http://localhost:3003 in your browser.
