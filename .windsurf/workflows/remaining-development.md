---
description: Complete remaining development tasks for AI trading bot
---

# Remaining Development Workflow

## Current Status
- [x] Core trading engine with paper trading
- [x] Dashboard with real-time updates
- [x] AI Playground for parameter testing
- [x] Cerebras AI integration (llama-3.3-70b)
- [x] Basic terminal UI (read-only commands)
- [x] Enhanced AI chat (conversational responses)
- [x] Full terminal with real shell (xterm.js + child_process)
- [ ] AI agent with terminal control
- [ ] Multi-exchange price feeds
- [ ] Shadow mode / backtesting

## Notes
- **BlackBox API**: Primary AI provider (keys being fixed, ETA: end of week)
- **Perplexity API**: Temporary primary until BlackBox keys ready
- **Cerebras API**: Backup AI provider
- Last updated: 2025-12-06

---

## Phase 1: Full Terminal Integration (xterm.js + node-pty)

**Goal**: Replace mock terminal with real shell access, enabling AI to control platform via commands.

### 1.1 Backend: WebSocket Terminal Server
```bash
# Files to create/modify:
- src/api/terminalServer.ts     (new - WebSocket + node-pty)
- src/api/server.ts             (integrate terminal WS endpoint)
```

**Dependencies:**
```bash
npm install node-pty ws @types/ws
```

**Features:**
- Spawn real shell process (PowerShell/Bash based on OS)
- WebSocket connection for real-time I/O
- Session management (multiple terminals if needed)
- Resize handling
- Graceful shutdown

### 1.2 Frontend: xterm.js Integration
```bash
# Files to create/modify:
- dashboard/src/components/XTerminal.tsx  (new - replaces Terminal.tsx)
- dashboard/package.json                   (add xterm dependencies)
```

**Dependencies (dashboard):**
```bash
cd dashboard && npm install xterm xterm-addon-fit xterm-addon-web-links
```

**Features:**
- Full ANSI color support
- Auto-resize to container
- Copy/paste support
- Clickable links
- Command history (shell-native)

### 1.3 Custom Bot Commands
```bash
# Add shell aliases/scripts for bot control:
- bot start        -> Start trading bot
- bot stop         -> Stop trading bot  
- bot status       -> Show bot status
- bot paper        -> Switch to paper mode
- bot live         -> Switch to live mode
- portfolio        -> Show portfolio
- prices           -> Show current prices
- signals          -> Show active signals
- config [key]     -> View/edit config
```

**Implementation options:**
- PowerShell module with bot functions
- Bash aliases sourced on shell start
- Custom CLI tool (TypeScript compiled to executable)

---

## Phase 2: AI Agent with Terminal Control

**Goal**: AI can control entire platform via terminal commands with full unrestricted backend access.

### Notes
- **Current primary**: Perplexity API (temporary)
- **Future primary**: BlackBox API (once keys fixed)
- **Backup**: Cerebras API

---

## Phase 2.5: Testnet Live Trading

**Goal**: Disable paper trading and run AI-driven trading on Hyperliquid testnet with real testnet coins (~1000 USDC from faucet).

### Configuration Changes
```yaml
# config.yaml changes:
bot:
  paper_trading: false    # Disable paper mode

exchange:
  testnet: true           # Keep testnet enabled
```

### Requirements
- [x] Hyperliquid testnet wallet funded (~1000 testnet USDC)
- [ ] HYPERLIQUID_PRIVATE_KEY configured in .env (testnet wallet)
- [ ] HYPERLIQUID_WALLET_ADDRESS configured in .env
- [ ] AI agent operational (Phase 2 complete)

### Behavior
- AI makes all trading decisions (entry, exit, position sizing)
- Real orders placed on Hyperliquid testnet
- Real P&L tracking (testnet coins)
- Full risk management active
- Dashboard shows live positions

### Activation
```bash
# When ready to start testnet trading:
npm run start
# or via terminal command once implemented:
bot start --testnet
```

### 2.1 AI Provider Abstraction
```bash
# Files to create/modify:
- src/core/aiProviders/index.ts       (new - provider interface)
- src/core/aiProviders/perplexity.ts  (new - primary for now)
- src/core/aiProviders/blackbox.ts    (new - future primary)
- src/core/aiProviders/cerebras.ts    (refactor from aiEngine.ts)
```

**Provider interface:**
```typescript
interface AIProvider {
  name: string;
  chat(messages: Message[]): Promise<string>;
  analyze(context: MarketContext): Promise<AIResponse>;
  isAvailable(): Promise<boolean>;
}
```

### 2.2 AI Agent with Shell Execution
```bash
# Files to create:
- src/core/aiAgent.ts                 (new - agent orchestrator)
- src/core/agentTools.ts              (new - tool definitions)
```

**Existing open-source options to consider:**
- **LangChain.js** - Agent framework with tool use (npm install langchain)
- **OpenInterpreter** - Python-based, could run as subprocess
- **Vercel AI SDK** - Lightweight, good for streaming

**Agent capabilities:**
- Execute shell commands (full access)
- Read/write files
- Control bot lifecycle
- Modify configuration
- Query market data
- Place/manage trades

### 2.3 Chat Interface with Agent
```bash
# Files to modify:
- dashboard/src/components/AIChat.tsx  (connect to agent)
- src/api/server.ts                    (agent chat endpoint)
```

**Flow:**
```
User message -> AI Agent -> Decides action -> Executes via terminal/API -> Returns result
```

---

## Phase 3: Multi-Exchange Price Intelligence

### 3.1 Price Feed Aggregator
```bash
# Files to create:
- src/core/multiExchangeFeed.ts    (new)
- src/core/divergenceDetector.ts   (new)
```

**Exchange integrations (via ccxt):**
- Binance (primary lead source)
- Coinbase Pro (US institutional flow)
- OKX (Asia market leader)
- Bybit (perpetual specialist)
- Hyperliquid (execution target)

**Dependencies:**
```bash
npm install ccxt
```

### 3.2 Divergence Detection
- Real-time price comparison across exchanges
- Volume-weighted average calculation
- Lead/lag detection (10-60 second edge)
- Arbitrage opportunity alerts

---

## Phase 4: Shadow Mode & Backtesting

### 4.1 Shadow Trading Engine
```bash
# Files to create:
- src/core/shadowMode.ts          (new)
```

**Features:**
- Track what bot WOULD do without executing
- Record hypothetical trades with P&L
- Compare shadow vs actual performance

### 4.2 Backtesting Engine
```bash
# Files to create:
- src/core/backtestingEngine.ts   (new)
```

**Features:**
- Historical data replay
- Strategy parameter optimization
- Performance metrics (Sharpe, max drawdown, win rate)

---

## Phase 5: Enterprise Features (Future)

- Advanced risk management (VaR, correlation analysis)
- Email/Telegram notifications
- Multi-user support
- Audit logging

---

## Quick Commands

```bash
# Build and test
npm run build
npm run check

# Start development
npm run paper
npm run start:dashboard

# Run tests
npm test
```

---

## Open Source Tools to Evaluate

| Tool | Use Case | Link |
|------|----------|------|
| xterm.js | Browser terminal emulator | https://xtermjs.org |
| node-pty | Spawn shell processes | https://github.com/microsoft/node-pty |
| LangChain.js | AI agent framework | https://js.langchain.com |
| Vercel AI SDK | Streaming AI responses | https://sdk.vercel.ai |
| ccxt | Multi-exchange API | https://github.com/ccxt/ccxt |

---

## Priority Order

1. **Phase 1** - Full terminal (enables AI control foundation)
2. **Phase 2** - AI agent with terminal access (enables autonomous operation)
3. **Phase 3** - Multi-exchange feeds (provides trading edge)
4. **Phase 4** - Shadow mode / backtesting (enables safe testing)
5. **Phase 5** - Enterprise features (polish & scale)
