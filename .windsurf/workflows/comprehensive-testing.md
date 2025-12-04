---
description: Comprehensive testing workflow with logged evidence
---

# Comprehensive Testing Workflow

## Test Environment Setup
```bash
# Ensure services are running
npm run paper                    # Backend (port 3001)
npm run start:dashboard          # Frontend (port 5173)

# Test data setup
PAPER_TRADING=true
OPENAI_API_KEY=your_key_here
CEREBRAS_API_KEY=your_key_here
```

## Test 1: Terminal Mutation Capabilities

### 1.1 Close Position via Terminal
```bash
# Test command to send:
positions.close BTC

# Expected behavior:
- Terminal shows: "✅ BTC position closed successfully"
- Portfolio updates: Position removed from list
- Activity log: "Position closed via terminal"
- P&L calculated and added to available balance
```

### 1.2 Dashboard Update via Terminal
```bash
# Test command to send:
dashboard.theme light

# Expected behavior:
- Terminal shows: "✅ Dashboard theme changed to light"
- UI updates: Background changes from dark to light
- Persistent: Theme preference saved to localStorage
- Reload test: Theme persists after page refresh
```

### 1.3 API Call to Cerebras via Terminal
```bash
# Test command to send:
ai.ask "What is the current market sentiment for BTC?"

# Expected behavior:
- Terminal shows: "🤖 Processing AI request..."
- Cerebras responds with market analysis
- Response includes: Current price context, technical indicators, sentiment
- Latency logged: "Response time: 1.2s"
```

## Test 2: AI Chat Integration

### 2.1 Paper Trade Modification via AI Chat
```bash
# Chat message to send:
"Close my BTC position and open a short ETH position with 2x leverage"

# Expected behavior:
- AI acknowledges: "I'll help you manage those positions"
- Terminal shows: "Closing BTC position..."
- Portfolio updates: BTC removed, ETH short added
- Risk check: Validates position size and leverage
- Confirmation: "BTC closed, ETH short opened at $2,345 with 2x leverage"
```

### 2.2 Dashboard Cosmetic Change via AI Chat
```bash
# Chat message to send:
"Change the dashboard to light theme and hide the portfolio section"

# Expected behavior:
- AI responds: "Updating dashboard appearance..."
- UI changes: Theme switches to light mode
- Portfolio section: Hidden from view
- Settings saved: Preferences persist after reload
- Confirmation: "Dashboard updated to light theme with portfolio hidden"
```

### 2.3 Complex Analysis Request via AI Chat
```bash
# Chat message to send:
"Analyze the current market conditions and suggest 3 trading opportunities with risk/reward ratios"

# Expected behavior:
- AI processes: "Analyzing market conditions..."
- Returns: 3 specific trade suggestions
- Each includes: Symbol, direction, entry price, stop loss, take profit, risk/reward
- Technical context: RSI, MACD, volume analysis
- Risk warning: "These are suggestions, always do your own research"
```

## Test 3: OpenAI Assistant Function Integration

### 3.1 Multi-Exchange Price Comparison
```bash
# Assistant function call:
get_prices({
  symbol: "BTC",
  exchanges: ["binance", "coinbase", "hyperliquid"],
  compare_prices: true
})

# Expected response:
{
  "binance": {"price": 96750, "volume": "1.2B"},
  "coinbase": {"price": 96745, "volume": "800M"},
  "hyperliquid": {"price": 96730, "volume": "50M"},
  "arbitrage_opportunity": "Binance leading Hyperliquid by $20 (0.02%)"
}
```

### 3.2 Advanced Signal Filtering
```bash
# Assistant function call:
get_signals({
  min_strength: 75,
  signal_types: ["RSI_Oversold", "MACD_Cross_Up"],
  symbols: ["BTC", "ETH"],
  include_indicators: true
})

# Expected response:
{
  "signals": [
    {
      "symbol": "BTC",
      "type": "RSI_Oversold",
      "strength": 82,
      "indicators": {"rsi": 28, "macd": -150, "bb_position": 15}
    }
  ],
  "total_signals": 1
}
```

### 3.3 Comprehensive Trade Analysis
```bash
# Assistant function call:
analyze_trade({
  "symbol": "ETH",
  "side": "long",
  "size_usd": 1000,
  "leverage": 3,
  "risk_reward_ratio": 2.5,
  "analysis_depth": "comprehensive"
})

# Expected response:
{
  "feasible": true,
  "entry_price": 2345,
  "stop_loss": 2280,
  "take_profits": [2380, 2420, 2480],
  "risk_reward": 3.2,
  "fees": 1.50,
  "margin_required": 333.33,
  "technical_analysis": "RSI oversold at 28, MACD bullish crossover",
  "risk_assessment": "Medium - 3x leverage within limits"
}
```

## Test Evidence Logging

### Automated Test Logger
```bash
# Create test results file
mkdir -p logs
echo "=== Trading Bot Test Results ===" > logs/test-results.txt
echo "Date: $(date)" >> logs/test-results.txt
echo "" >> logs/test-results.txt
```

### Manual Verification Checklist
```bash
# For each test, verify:
[ ] Command executed without errors
[ ] Expected response received
[ ] UI state updated correctly
[ ] Data persisted appropriately
[ ] No console errors
[ ] Performance acceptable (<2s response)
[ ] Security maintained (no unauthorized actions)
```

## Test Success Criteria

### Terminal Tests
- ✅ All mutation commands execute successfully
- ✅ State changes reflect in real-time
- ✅ Error handling works for invalid inputs
- ✅ Command history and autocomplete functional

### AI Chat Tests
- ✅ Natural language understanding accurate
- ✅ Complex multi-step commands executed
- ✅ Context maintained across conversation
- ✅ Safety measures prevent risky actions

### Assistant Function Tests
- ✅ All 12 functions return expected data
- ✅ Parameter validation works correctly
- ✅ Cross-exchange data accurate
- ✅ Risk calculations precise

## Performance Benchmarks

### Response Time Targets
- Terminal commands: <500ms
- AI chat responses: <2s
- Assistant functions: <1s
- Dashboard updates: <100ms

### Accuracy Requirements
- Price data: <0.01% deviation
- Risk calculations: <1% error margin
- Signal strength: Consistent scoring
- Portfolio values: Real-time sync

## Error Recovery Tests

### Network Failures
- ✅ API timeouts handled gracefully
- ✅ Fallback responses provided
- ✅ User notified of issues
- ✅ No data corruption

### Invalid Inputs
- ✅ Malformed commands rejected
- ✅ Out of range values handled
- ✅ Permission denied responses
- ✅ Clear error messages

## Test Automation Script

```bash
# Create automated test runner
# scripts/run-tests.ts
import { exec } from 'child_process';
import { writeFileSync } from 'fs';

const tests = [
  'terminal_position_close',
  'terminal_theme_change', 
  'ai_chat_trade_modification',
  'ai_chat_dashboard_update',
  'assistant_price_comparison',
  'assistant_signal_filtering',
  'assistant_trade_analysis'
];

for (const test of tests) {
  console.log(`Running test: ${test}`);
  // Execute test and log results
  // Verify expected outcomes
  // Generate report
}
```

## Final Validation

Before considering the system enterprise-ready:
1. All tests pass consistently
2. Performance meets benchmarks
3. Security audit completed
4. Documentation updated
5. User acceptance testing done
6. Production deployment tested
