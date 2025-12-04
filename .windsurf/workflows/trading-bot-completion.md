---
description: Complete the AI-powered crypto trading bot with testing modes and parameter tuning
---

# AI Trading Bot Completion Workflow

> **Quick Start**: Run `npm run start:dashboard` and `npm run paper` in separate terminals

## Current Status
- ✅ Core trading engine working
- ✅ Dashboard with real-time updates  
- ✅ AI Playground for parameter testing
- ✅ OpenAI support (including o1 reasoning)
- ✅ Paper trading with realistic fees
- ✅ OpenAI/Gemini Assistant function definitions (12 functions)
- 🔄 Multi-exchange price feeds (Binance, Coinbase, OKX lead detection)
- 🔄 Web search for live market intel
- 🔄 Backtesting mode (planned)
- 🔄 Shadow mode (planned)

## Phase 1: Core Infrastructure ✅ (Mostly Complete)
- [x] Hyperliquid exchange integration (`src/exchange/`)
- [x] AI Engine with Cerebras (`src/core/aiEngine.ts`)
- [x] Portfolio management (`src/core/portfolio.ts`)
- [x] Risk management (`src/core/riskManager.ts`)
- [x] Signal processor (`src/core/signalProcessor.ts`)
- [x] Trading fee simulator (`src/core/tradingFees.ts`)
- [x] Safety manager with kill switch (`src/core/safetyManager.ts`)
- [x] Dashboard with React/Tailwind (`dashboard/`)

## Phase 2: Multi-Provider AI Support
1. Add OpenAI provider alongside Cerebras
2. Add parameter configuration (temperature, top_p, reasoning mode)
3. Create AI Playground for testing prompts and parameters
4. Support o1 "high reasoning" mode for OpenAI

### Files to modify:
- `src/core/aiEngine.ts` - Add OpenAI provider and parameter options
- `src/config/settings.ts` - Add OpenAI config
- `.env` - Add OPENAI_API_KEY
- `dashboard/src/components/AIModelManager.tsx` - Add parameter sliders

## Phase 3: Enhanced Paper Trading
1. Ensure fee accuracy to fraction of a penny
2. Add multiple testing modes:
   - **Backtesting**: Historical data replay
   - **Paper Live**: Real-time prices, simulated execution
   - **Shadow Mode**: Track what bot WOULD do without executing
3. Add detailed trade cost breakdown in UI

### Files to modify:
- `src/core/tradingFees.ts` - Add precision tracking
- `src/core/portfolio.ts` - Add testing mode support
- `dashboard/src/App.tsx` - Add mode selector and cost breakdown

## Phase 4: AI Playground Component
1. Graphical slider interface for:
   - Temperature (0.0 - 2.0)
   - Top P (0.0 - 1.0)
   - Reasoning effort (low/medium/high for o1)
   - Max tokens
2. Test prompt with live response preview
3. Compare responses across providers/settings

### New file:
- `dashboard/src/components/AIPlayground.tsx`

## Phase 5: Multi-Exchange Price Intelligence
The edge: Larger exchanges (Binance, Coinbase, OKX) often lead price movements by 10-60 seconds.

1. Add price feeds from multiple exchanges:
   - **Binance** - Largest volume, often leads
   - **Coinbase** - US institutional flow
   - **OKX** - Asia market leader
   - **Bybit** - Popular perps exchange
   - **MEXC** - Non-KYC alternative
   - **Hyperliquid** - Our execution target

2. Implement price divergence detection:
   - Compare Binance vs Hyperliquid in real-time
   - Alert when price gap exceeds threshold (e.g., 0.1%)
   - Auto-position before the lag catches up

3. Order book depth analysis:
   - Detect large buy/sell walls on leading exchanges
   - Predict short-term direction

### New files needed:
- `src/core/multiExchangeFeed.ts` - Aggregate price feeds
- `src/core/divergenceDetector.ts` - Cross-exchange comparison
- `src/core/webSearch.ts` - Live news/sentiment scraping

## Phase 6: OpenAI Assistant Integration (Optional)
Functions to expose for OpenAI Assistant:
```typescript
// Trading Functions
get_portfolio_state() - Current positions, balance, P&L
get_market_data(symbols: string[]) - Prices, volume, indicators
get_active_signals() - Current trading signals
place_order(symbol, side, size, leverage, stopLoss) - Execute trade
close_position(symbol) - Close existing position

// Analysis Functions  
get_technical_indicators(symbol, timeframe) - RSI, MACD, BB, etc.
get_historical_trades() - Past trade performance
get_fee_estimate(orderSize, isMarket) - Cost estimate
```

## Phase 7: Testing & Validation
1. Validate paper trading accuracy against real Hyperliquid fees
2. Stress test AI failover between providers
3. Backtest with historical data
4. Document API key setup

## Quick Commands
// turbo
```bash
# Start dashboard dev server
cd dashboard && npm run dev
```

// turbo
```bash
# Start bot in paper mode
npm run paper
```

```bash
# Start bot in live mode (CAREFUL!)
npm run live
```

## Environment Variables Required
```env
# AI Providers
CEREBRAS_API_KEY=your_key
OPENAI_API_KEY=your_key

# Exchange
HYPERLIQUID_PRIVATE_KEY=your_wallet_key
HYPERLIQUID_WALLET_ADDRESS=your_address
HYPERLIQUID_TESTNET=true

# Settings
PAPER_TRADING=true
LOG_LEVEL=info
```

## Notes
- Hyperliquid DOES support testnet - already configured
- Paper trading fees use real Hyperliquid fee structure (0.02% maker, 0.05% taker)
- Always test new AI configs in paper mode first
- o1 reasoning models have lower rate limits - use sparingly for important decisions
