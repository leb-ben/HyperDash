# Known Issues

## Exchange API Connectivity Issues

### Description
The Hyperliquid exchange API occasionally returns "An unknown error occurred" for `getOHLCV` calls, affecting candlestick data retrieval.

### Impact
- **Non-critical**: Bot continues to function normally
- Market data collection works via `getAllTickers`
- AI analysis and trading decisions proceed normally
- Only technical indicator calculations may be affected

### Reproduction Steps
1. Start bot in paper trading mode
2. Monitor logs during cycle execution
3. Look for: `ERROR [getOHLCV] An unknown error occurred`

### Current Workaround
- Bot uses available ticker data for analysis
- Sentiment integration provides additional signals
- System remains fully functional for paper trading

### Resolution Status
- Likely testnet-specific connectivity issue
- Does not affect core trading functionality
- Can be addressed in future updates
- No immediate action required for deployment

## Port Conflicts on Restart

### Description
When restarting the bot rapidly, port 3001 may remain in use causing startup failures.

### Impact
- Bot fails to start with "EADDRINUSE" error
- Dashboard may start on different ports (5174, 5175)

### Resolution
- Use unified launcher `start-everything.bat` which handles cleanup
- Manual cleanup: `netstat -ano | findstr :3001` then `taskkill /PID <pid> /F`

## Dashboard Port Variability

### Description
Vite development server may use different ports if 5173/5174 are occupied.

### Impact
- Dashboard URL may vary (localhost:5173-5175)
- Unified launcher opens correct port automatically

### Resolution
- Check terminal output for actual dashboard URL
- Unified launcher handles port detection automatically
