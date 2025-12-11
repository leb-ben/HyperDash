# AI Trading Bot

An AI-powered cryptocurrency trading bot for Hyperliquid perpetual futures, using Cerebras AI for ultra-fast market analysis and autonomous trade execution.

## ✨ Features

- **AI-Driven Decisions**: Cerebras AI (`gpt-oss-120b`) analyzes markets with ~700ms response times
- **Technical Analysis**: RSI, MACD, Bollinger Bands, ATR, SMA, EMA across multiple timeframes
- **Risk Management**: Position sizing, stop losses, take profits, drawdown protection
- **Paper Trading**: Test strategies with $500 simulated funds before going live
- **Multi-Coin Portfolio**: Manages BTC, ETH, SOL, HYPE, JUP (configurable)
- **Hyperliquid DEX**: Non-custodial perpetual futures trading - you keep your keys
- **Real-Time Dashboard**: Beautiful web UI to monitor bot performance
- **5-Minute Cycles**: Analyzes and trades every 5 minutes automatically

## 🧠 AI Model

**Cerebras Cloud** - `gpt-oss-120b`
- Free tier API access
- Fastest inference speeds globally (~700ms responses)
- OpenAI-compatible API format
- Temperature: 0.3 (for consistent decisions)
- Min confidence to trade: 60%

Get your free API key: https://cloud.cerebras.ai/

## 🏦 How Hyperliquid Works (Important!)

**Hyperliquid is a decentralized exchange (DEX)** - this means:

✅ **Self-Custody**: Your funds stay in YOUR wallet, not on an exchange
✅ **No KYC Required**: Connect wallet and trade immediately
✅ **Non-Custodial**: You control your private keys at all times
✅ **On-Chain Settlement**: All trades settle on Arbitrum

### Fund Flow:
1. You hold crypto in your wallet (MetaMask, etc.)
2. Deposit USDC to Hyperliquid from your wallet
3. Trade perpetual futures on Hyperliquid
4. Withdraw back to your wallet anytime

**Your funds are NEVER held by a third party** - Hyperliquid's smart contracts handle settlement, but you can withdraw at any time.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy example config
copy .env.example .env
```

Edit `.env`:

```env
# Required for AI analysis
CEREBRAS_API_KEY=your_cerebras_api_key

# Required ONLY for live trading (not needed for paper trading)
HYPERLIQUID_PRIVATE_KEY=your_wallet_private_key
HYPERLIQUID_WALLET_ADDRESS=your_wallet_address

# Bot mode
PAPER_TRADING=false
HYPERLIQUID_TESTNET=true
```

### 3. Run Paper Trading (Recommended First!)

```bash
# Start the bot
node --import tsx src/index.ts

# Start the dashboard (separate terminal)
cd dashboard
npm install --ignore-scripts
.\node_modules\.bin\vite
```

Dashboard: http://localhost:3000

### 4. Connect Real Hyperliquid Account (Live Trading)

**Prerequisites:**
1. Ethereum-compatible wallet (MetaMask, Rabby, etc.)
2. USDC on Arbitrum network
3. Deposited funds to Hyperliquid via https://app.hyperliquid.xyz

**Setup:**
1. Export your wallet's private key:
   - MetaMask: Settings → Security → Reveal Private Key
   - **⚠️ NEVER share this with anyone!**
2. Add to `.env`:
   ```env
   HYPERLIQUID_PRIVATE_KEY=0x...your_private_key
   HYPERLIQUID_WALLET_ADDRESS=0x...your_wallet_address
   PAPER_TRADING=false
   HYPERLIQUID_TESTNET=false  # Use mainnet
   ```
3. Start with small amounts to test!

**Testnet Practice:**
- Get testnet funds: https://app.hyperliquid.xyz/testnet
- Set `HYPERLIQUID_TESTNET=true` in `.env`

## Configuration

### Coins

```yaml
coins:
  stable: "USDC"
  tracked:
    - symbol: "BTC"
      max_position_pct: 25
      leverage: 3
    - symbol: "ETH"
      max_position_pct: 20
      leverage: 3
```

### Risk Management

```yaml
risk:
  min_stable_pct: 30          # Always keep 30% in stablecoins
  max_single_position_pct: 25 # Max 25% per coin
  max_daily_loss_pct: 10      # Pause if daily loss > 10%
  max_leverage: 10            # Never exceed 10x leverage
  default_stop_loss_pct: 5    # 5% stop loss default
```

### AI Settings

```yaml
ai:
  provider: "cerebras"
  model: "llama-3.3-70b"
  temperature: 0.3
  min_confidence_to_trade: 0.6  # Only trade with >60% confidence
```

## 🧠 Self-Learning System

The bot continuously improves itself through machine learning from its own trades:

### Trade Memory
- Records every trade with full context (market conditions, AI reasoning, indicators)
- Tracks outcomes (P&L, hold time, win/loss)
- Builds patterns from successes and failures

### Learning Feedback Loop
- Past performance data is included in every AI prompt
- AI learns to avoid patterns that led to losses
- AI reinforces patterns that led to wins
- Statistical insights by coin, market condition, confidence level

### Weekly Self-Maintenance (Automatic)
Every 7 days, the bot runs self-maintenance:
1. Analyzes overall performance trends
2. Trims old/irrelevant data to stay lean
3. Consolidates similar strategy notes
4. AI generates strategic recommendations
5. Updates insights based on recent trades

### Learning Data
Stored in `data/learning.db`:
- **Trade Outcomes**: Full context + P&L for every closed trade
- **Strategy Notes**: Categorized learnings (success/failure patterns)
- **Performance Snapshots**: Weekly performance summaries

## 📊 Dashboard

The bot includes a real-time web dashboard built with React + TailwindCSS:

- **Portfolio Value**: Live tracking with daily P&L
- **Performance Metrics**: Win rate, total trades, cycle count
- **24-Hour Chart**: Portfolio value over time
- **Open Positions**: Current holdings with entry/exit prices
- **Market Analysis**: Trend strength for all tracked coins
- **AI Decisions**: Latest analysis with market regime and risk level
- **Trade History**: Recent trades with realized P&L

## Technical Details

### Trading Cycle (Every 5 Minutes)
1. Fetch prices from Hyperliquid for all tracked coins
2. Calculate technical indicators (RSI, MACD, BB, ATR, SMA, EMA)
3. Build structured market report with all data
4. Send to Cerebras AI for analysis
5. AI returns JSON with trade decisions and confidence scores
6. Risk manager validates against position limits
7. Executor places trades (or simulates in paper mode)
8. Update portfolio state and log results

### Risk Controls
| Parameter | Default | Description |
|-----------|---------|-------------|
| `min_stable_pct` | 30% | Always keep in USDC |
| `max_single_position_pct` | 25% | Max per coin |
| `max_daily_loss_pct` | 10% | Auto-pause trigger |
| `max_drawdown_pct` | 20% | Emergency stop |
| `default_leverage` | 3x | Starting leverage |
| `max_leverage` | 10x | Hard cap |
| `default_stop_loss_pct` | 5% | Per position |

### File Structure
```
Trade_bot/
├── src/
│   ├── index.ts              # Main bot entry point
│   ├── config/settings.ts    # Config loader + validation
│   ├── core/
│   │   ├── aiEngine.ts       # Cerebras AI integration
│   │   ├── dataCollector.ts  # Market data fetching
│   │   ├── executor.ts       # Trade execution
│   │   ├── learningEngine.ts # Self-improvement system
│   │   ├── maintenance.ts    # Weekly self-maintenance
│   │   ├── portfolio.ts      # Paper trading state
│   │   └── riskManager.ts    # Risk validation
│   ├── exchange/
│   │   └── hyperliquid.ts    # Hyperliquid SDK wrapper
│   ├── indicators/index.ts   # Technical analysis
│   └── types/index.ts        # TypeScript interfaces
├── dashboard/                # React dashboard
├── data/
│   ├── portfolio.db          # Paper trading state
│   └── learning.db           # Trade memory + learnings
├── config.yaml               # Trading configuration
└── .env                      # API keys (gitignored)
```

## 🛡️ Security Notes

1. **Private keys**: Never commit to git, never share
2. **`.env` is gitignored**: Keys won't be uploaded
3. **Paper trading first**: Always test before live trading
4. **Start small**: Test with minimal funds initially
5. **Monitor actively**: Don't leave unattended with large sums

## 🚧 Future Roadmap

Features planned for future development:

### Phase 1 - Core Improvements
- [ ] Wire dashboard to real bot data via WebSocket API
- [ ] Add more technical indicators (Fibonacci, Volume Profile)
- [ ] Backtesting module with historical data
- [ ] Multiple strategy support (Grid, DCA, Momentum)

### Phase 2 - User Experience
- [ ] **Connect Wallet Button**: One-click wallet connection via WalletConnect
- [ ] **Streamlined Funding**: Direct deposit/withdraw from dashboard
- [ ] Mobile-responsive dashboard
- [ ] Telegram/Discord alerts integration
- [ ] Email notifications for trades

### Phase 3 - Platform (Future)
- [ ] **User Accounts**: Multi-user support with authentication
- [ ] **Subscription Tiers**: Free paper trading, paid live features
- [ ] **Hosted Version**: Run bot in cloud without local setup
- [ ] **Strategy Marketplace**: Share/sell profitable strategies
- [ ] **Social Trading**: Copy successful traders

### Phase 4 - Advanced
- [ ] Multi-exchange support (dYdX, GMX, etc.)
- [ ] Portfolio rebalancing automation
- [ ] Tax reporting integration
- [ ] Advanced AI models (Claude, GPT-4)

## ⚠️ Disclaimer

**This software is for educational purposes only.**

- Cryptocurrency trading carries substantial risk of loss
- Past performance does not guarantee future results
- Never trade with money you cannot afford to lose
- The authors are not financial advisors
- You are solely responsible for your trading decisions

**USE AT YOUR OWN RISK**

## 📄 License

MIT License - feel free to modify and distribute.

---
Bee Anon
