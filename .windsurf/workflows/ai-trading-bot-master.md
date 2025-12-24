---
description: Master workflow for the AI-powered crypto trading bot - covers setup, development phases, testing, and deployment
---

# AI Trading Bot - Master Workflow

## Overview

This workflow guides development of a production-ready AI trading bot for Hyperliquid perpetual futures.

**Tech Stack:**
- Backend: Node.js + TypeScript
- AI: Perplexity (primary), BlackBox (future), Cerebras (backup)
- Exchange: Hyperliquid SDK (testnet/mainnet)
- Dashboard: React + Vite + TailwindCSS
- Terminal: xterm.js + WebSocket

---

## Phase 1: Terminal Integration [COMPLETE]

### 1.1 Backend Terminal Server

// turbo
```bash
# Verify terminal server file exists
cat src/api/terminalServer.ts | head -50
```

The terminal server (`src/api/terminalServer.ts`) uses:
- WebSocket server on port 3002
- child_process.spawn for PowerShell/Bash
- Session management for multiple connections

### 1.2 Frontend XTerminal Component

// turbo
```bash
# Verify XTerminal component
cat dashboard/src/components/XTerminal.tsx | head -50
```

Dependencies installed:
- @xterm/xterm
- @xterm/addon-fit
- @xterm/addon-web-links

### 1.3 Test Terminal

// turbo
```bash
# Start bot (includes terminal server)
npm run dev
```

// turbo
```bash
# Start dashboard (separate terminal)
cd dashboard && npm run dev
```

**Verification:**
1. Open dashboard at http://localhost:5173
2. Find "Shell Terminal" section
3. Confirm PowerShell prompt appears
4. Type `echo "Hello"` and verify output

---

## Phase 2: AI Agent Integration [IN PROGRESS]

### 2.1 AI Provider Configuration

Update `.env` with API keys:
```env
CEREBRAS_API_KEY=your_cerebras_key
PERPLEXITY_API_KEY=your_perplexity_key
BLACKBOX_API_KEY=your_blackbox_key  # When available
```

### 2.2 Create AI Provider Abstraction

Create `src/core/aiProviders.ts`:
```typescript
// Multi-provider AI abstraction
// Primary: Perplexity
// Future Primary: BlackBox
// Backup: Cerebras
```

### 2.3 AI Terminal Commands

The AI agent should be able to execute via terminal:
- `bot.start` / `bot.stop` - Control trading
- `portfolio.show` - View positions
- `analyze <symbol>` - Get AI analysis
- `trade <symbol> <side> <size>` - Execute trades
- `risk.check` - Assess risk levels

### 2.4 Test AI Integration

// turbo
```bash
# Test AI response
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the current market sentiment?"}'
```

---

## Phase 2.5: Testnet Live Trading

### 2.5.1 Configuration Changes

Edit `config.yaml`:
```yaml
bot:
  paper_trading: false  # DISABLE paper trading

exchange:
  testnet: true  # Keep on testnet for safety
```

### 2.5.2 Verify Wallet Setup

// turbo
```bash
# Check wallet address is configured
grep -i wallet .env
```

Ensure:
- `HYPERLIQUID_PRIVATE_KEY` is set
- `HYPERLIQUID_WALLET_ADDRESS` is set
- Wallet has testnet USDC (use testnet faucet)

### 2.5.3 Get Testnet Funds

1. Visit https://app.hyperliquid.xyz/testnet
2. Connect wallet
3. Use faucet to get testnet USDC
4. Verify balance in dashboard

### 2.5.4 Enable AI Trading

The AI will make all trading decisions:
- Analyze market every 5 minutes
- Execute trades when confidence > 60%
- Respect risk limits (max 20% per position)
- Auto stop-loss at 5%

---

## Phase 3: Multi-Exchange Price Intelligence [PLANNED]

### 3.1 Add Price Feeds

- Binance WebSocket
- Coinbase WebSocket
- Kraken REST API

### 3.2 Cross-Exchange Arbitrage Detection

Identify price discrepancies > 0.5% across exchanges.

---

## Testing Checklist

### Unit Tests
// turbo
```bash
npm test
```

### Type Check
// turbo
```bash
npm run check
```

### Build Verification
// turbo
```bash
npm run build
```

### Dashboard Build
// turbo
```bash
cd dashboard && npx vite build
```

### Integration Test
1. Start bot: `npm run dev`
2. Start dashboard: `cd dashboard && npm run dev`
3. Verify WebSocket connections
4. Test AI chat responses
5. Verify terminal commands work
6. Check real-time price updates

---

## Troubleshooting

### Terminal Not Connecting
```bash
# Check if port 3002 is in use
netstat -ano | findstr :3002

# Kill process if stuck
taskkill /F /PID <pid>
```

### AI Not Responding
```bash
# Verify API keys
echo %CEREBRAS_API_KEY%
echo %PERPLEXITY_API_KEY%
```

### WebSocket Errors
```bash
# Check CORS settings in server.ts
grep -i "cors\|origin" src/api/server.ts
```

### Build Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Quick Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start bot in development |
| `npm run paper` | Start in paper trading mode |
| `npm run live` | Start in live trading mode |
| `npm run check` | TypeScript type check |
| `npm run build` | Production build |
| `cd dashboard && npm run dev` | Start dashboard |

---

## File Structure

```
Trade_bot/
├── src/
│   ├── api/
│   │   ├── server.ts          # API endpoints
│   │   └── terminalServer.ts  # WebSocket terminal
│   ├── core/
│   │   ├── aiEngine.ts        # AI decision engine
│   │   ├── portfolio.ts       # Portfolio management
│   │   └── signalProcessor.ts # Signal processing
│   └── exchange/
│       └── hyperliquid.ts     # Exchange integration
├── dashboard/
│   └── src/
│       ├── App.tsx
│       └── components/
│           ├── XTerminal.tsx  # Full terminal
│           └── Terminal.tsx   # Basic terminal
├── config.yaml                # Bot configuration
└── .env                       # API keys (not committed)
```

---

## Safety Reminders

1. **Always test on testnet first**
2. **Never commit API keys to git**
3. **Set conservative risk limits initially**
4. **Monitor the bot actively during live trading**
5. **Have a kill switch ready (Ctrl+C or safety panel)**

---

## Next Steps

After completing each phase:
1. Run full test suite
2. Update this workflow with completion status
3. Document any issues in KNOWN_ISSUES.md
4. Commit changes with descriptive message
