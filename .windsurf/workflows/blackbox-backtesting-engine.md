---
description: Blackbox backtesting engine specification for Hamburger Bot strategy validation
---

# Blackbox Backtesting Engine Workflow

## Overview
Build a backtesting engine that validates the Hamburger Bot strategy against historical Hyperliquid data. The engine must simulate the AI-driven decision making process with realistic fee assumptions and test across multiple timeframes.

## Phase 1: Data Acquisition & Preparation

### 1.1 Historical Data Collection
- Fetch historical price data from Hyperliquid:
  - 24-hour, 7-day, 30-day, and 6-month datasets
  - 1-minute candlestick data for precise execution simulation
  - Volume data for each timestamp
  - Funding rate history for perpetual swaps
  - Include high volatility periods (pumps/dumps)

### 1.2 Data Structure
```typescript
interface HistoricalData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  funding_rate?: number
}

interface MarketSnapshot {
  timestamp: number
  price: number
  volume_24h: number
  volatility: number
  trend_strength: number
}
```

### 1.3 Symbol Coverage
- Test across all leverage tiers:
  - 40x: BTC, ETH, SOL, XRP
  - 20x: DOGE, SUI, WLD, LTC, LINK, AVAX, HYPE, TIA, APT, NEAR
  - 10x: OP, ARB, LDO, TON, JUP, SEI, BNB, DOT
  - 3x: Stablecoins (USDC, USDT) and new listings

## Phase 2: Strategy Simulation Engine

### 2.1 Core Strategy Logic
```typescript
// Simulate the Hamburger Bot algorithm:
class HamburgerBotSimulator {
  // State management
  realPositions: Position[] // 2-4 positions max
  virtualGrid: VirtualLevel[] // Infinite monitoring
  currentPrice: number
  capital: number
  leverage: number
  
  // AI decision simulation
  makeDecision(price: number, signals: Signals): Decision
  executeDecision(decision: Decision): void
  calculatePnL(): number
}
```

### 2.2 Signal Calculation
- **Parabolic SAR**: Calculate SAR dots for each timestamp
- **ATR**: Dynamic volatility-based grid spacing
- **Volume Spikes**: Detect unusual volume (> 2x average)
- **Rate of Change**: Calculate ROC for panic triggers

### 2.3 Decision Logic Simulation
```typescript
// Replicate AI decision hierarchy:
if (ROC > panic_threshold) {
  return CLUSTER_POSITIONS
} else if (volume_spike) {
  return PREPARE_MOVEMENT
} else if (SAR_trend === "bullish") {
  return BIAS_LONG
} else if (SAR_trend === "bearish") {
  return BIAS_SHORT
} else {
  return HOLD
}
```

## Phase 3: Execution & Fee Simulation

### 3.1 Order Execution
- **Market Orders Only**: No limit order simulation
- **Slippage Model**: 0.01-0.05% based on volatility
- **Partial Fills**: Large orders may have slippage

### 3.2 Fee Structure (Conservative Assumptions)
```typescript
// Always assume heavier fees:
const FEES = {
  taker_fee: 0.0005, // 0.05% (worst case)
  funding_rate: historical_funding_rate,
  spread_cost: 0.0001, // 0.01% bid-ask spread
}

function calculateTotalFees(trade: Trade): number {
  return trade.size * trade.price * FEES.taker_fee +
         trade.size * FEES.spread_cost +
         calculateFundingCost(trade.hold_time)
}
```

### 3.3 Position Management
- Track 2-4 real positions dynamically
- Automatic position creation when filled
- Stop loss/take profit execution
- Position clustering during trends

## Phase 4: Performance Metrics

### 4.1 Primary Metrics
```typescript
interface PerformanceReport {
  // Return metrics
  total_return: number
  sharpe_ratio: number
  max_drawdown: number
  win_rate: number
  
  // Efficiency metrics
  capital_efficiency: number // % of capital utilized
  trade_frequency: number
  avg_hold_time: number
  
  // Risk metrics
  var_95: number // Value at Risk
  largest_loss: number
  consecutive_losses: number
  
  // Cost analysis
  total_fees: number
  funding_costs: number
  slippage_costs: number
}
```

### 4.2 Comparative Analysis
- Compare against:
  - Buy and hold strategy
  - Traditional grid bot (simulation)
  - DCA strategy
  - Random entry benchmark

## Phase 5: Testing Scenarios

### 5.1 Market Conditions
Test across various market types:
- **Bull Markets**: Strong uptrends
- **Bear Markets**: Strong downtrends
- **Sideways Markets**: Range-bound price
- **High Volatility**: Pump/dump events
- **Low Volatility**: Calm markets

### 5.2 Parameter Sweeps
```typescript
// Test different configurations:
const TEST_PARAMS = {
  grid_spacing: [0.5%, 1.0%, 1.5%, 2.0%],
  rebalance_threshold: [0.5%, 1.0%, 2.0%],
  ai_aggressiveness: [low, medium, high],
  stop_loss: [2%, 3%, 5%],
  leverage: [3x, 10x, 20x, 40x]
}
```

### 5.3 Stress Testing
- Flash crash scenarios (-30% in 1 hour)
- Liquidity crises
- Funding rate spikes
- API delay simulation

## Phase 6: Reporting & Visualization

### 6.1 Performance Dashboard
- Equity curve visualization
- Drawdown chart
- Trade distribution heatmap
- Position clustering timeline
- Signal effectiveness analysis

### 6.2 Detailed Reports
- Trade-by-trade execution log
- AI decision audit trail
- Fee impact analysis
- Risk metric evolution
- Parameter optimization results

### 6.3 Export Formats
- JSON for programmatic access
- CSV for Excel analysis
- PDF for human-readable reports
- HTML for interactive charts

## Phase 7: Integration Interface

### 7.1 Strategy Import
```typescript
// Import Hamburger Bot logic:
import { HamburgerBotConfig } from './strategy-config'
import { executeBacktest } from './backtest-engine'

const results = await executeBacktest({
  config: HamburgerBotConfig,
  data: historicalData,
  params: testParameters
})
```

### 7.2 Real-time Validation
- Compare backtest vs live performance
- Detect strategy drift
- Alert on performance degradation
- Suggest parameter adjustments

## Success Criteria

- [ ] Accurate simulation of 2-4 position dynamics
- [ ] Realistic fee modeling (always conservative)
- [ ] Comprehensive market condition testing
- [ ] Clear performance visualization
- [ ] Parameter optimization capabilities
- [ ] Integration ready for live strategy

## Technical Requirements

### Performance
- Process 6 months of 1-minute data in < 5 minutes
- Support parallel parameter testing
- Memory efficient for large datasets

### Accuracy
- Tick-level precision for entry/exit
- Exact fee calculations
- Proper leverage accounting
- Realistic slippage modeling

### Usability
- Clear configuration interface
- Interactive result exploration
- Export capabilities
- Documentation for integration

## Deliverables

1. **Backtest Engine Core** - Strategy simulation logic
2. **Data Pipeline** - Historical data fetching and processing
3. **Analysis Suite** - Performance metrics and reporting
4. **Visualization Tools** - Charts and dashboards
5. **Integration Layer** - API for strategy import
6. **Test Suite** - Validation of accuracy
7. **Documentation** - Usage guide and API reference

This specification provides Blackbox with everything needed to build a comprehensive backtesting engine that accurately validates the Hamburger Bot strategy across various market conditions with conservative assumptions.
