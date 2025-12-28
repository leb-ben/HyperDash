# Hamburger Bot Backtesting Interface

This directory contains the interfaces and data structures needed for Blackbox to implement a comprehensive backtesting engine for the Hamburger Bot strategy.

## Key Files

### `gridBacktestInterface.ts`
The main interface that provides:
- Clean separation of strategy logic from backtesting implementation
- All necessary data structures for historical data, positions, and decisions
- Placeholder methods for Blackbox to implement:
  - Signal calculations (Parabolic SAR, ATR, Volume, ROC)
  - AI decision engine logic
  - Historical data loading

## Implementation Guide for Blackbox

### 1. Data Loading
Implement the `loadData()` method to fetch historical Hyperliquid data:
```typescript
// Required data points per candle:
- timestamp (ms)
- open, high, low, close
- volume
- funding_rate (if available)
```

### 2. Signal Calculations
Replace the placeholder `calculateSignals()` method with actual implementations:

#### Parabolic SAR
```typescript
// Parameters from config:
- acceleration: 0.02
- maximum: 0.2
```

#### ATR (Average True Range)
```typescript
// Parameters from config:
- period: 14
- multiplier: 2
```

#### Volume Spike Detection
```typescript
// Parameters from config:
- spikeThreshold: 2.0 (2x average)
- lookback: 20
```

#### Rate of Change (ROC)
```typescript
// Parameters from config:
- period: 10
- panicThreshold: 5.0%
```

### 3. AI Decision Engine
Implement the `makeAIDecision()` method following this hierarchy:

1. **ROC panic trigger** → Immediate cluster/flatten
2. **Volume spike** → Prepare for movement, tighten risk
3. **SAR trend direction** → Position bias (long/short)
4. **ATR volatility** → Adjust grid spacing

### 4. Fee Assumptions
Always use conservative (heavier) fees:
- Taker fees: 0.05%
- Slippage: 0.01-0.05% based on volatility
- Funding rates: Use historical data when available

### 5. Performance Metrics
The interface calculates all standard metrics:
- Total return and percentage
- Sharpe/Sortino ratios
- Maximum drawdown
- Win rate and profit factor
- Capital efficiency
- Fee impact analysis

## Testing Scenarios

### Market Conditions to Test:
1. **Bull Markets** - Strong uptrends
2. **Bear Markets** - Strong downtrends
3. **Sideways Markets** - Range-bound price
4. **High Volatility** - Pump/dump events
5. **Low Volatility** - Calm markets

### Parameter Sweeps:
Test different configurations:
- Grid spacing: 0.5% - 2.0%
- Rebalance thresholds: 0.5% - 2.0%
- AI aggressiveness: low/medium/high
- Stop losses: 2% - 5%
- Leverage: 3x, 10x, 20x, 40x (per symbol limits)

## Integration Points

### Export Strategy Logic
```typescript
import GridBacktestInterface from './src/backtesting/gridBacktestInterface.js'

// Create backtest instance
const backtest = new GridBacktestInterface(backtestConfig, strategyConfig)

// Load historical data
await backtest.loadData('BTC', '2024-01-01', '2024-12-31')

// Run backtest
const results = await backtest.runBacktest()
```

### Validate Against Live Trading
Compare backtest results with:
- Same parameters as live bot
- Actual fees paid
- Real slippage experienced
- Actual decision outcomes

## Data Export Formats

The interface supports multiple export formats:
- **JSON** - For programmatic access
- **CSV** - For Excel analysis
- **HTML** - For interactive reports

## Key Features to Validate

1. **2-4 Dynamic Positions**
   - Never less than 2, never more than 4
   - Proper clustering during trends

2. **Infinite Virtual Grid**
   - No capital lockup
   - Proper trigger detection

3. **AI Risk Management**
   - Panic response to ROC spikes
   - Volume spike preparation
   - SAR trend following

4. **Market Order Execution**
   - No limit order lockup
   - Quick exit capability

5. **Capital Efficiency**
   - ~95% utilization target
   - Minimal idle capital

## Success Criteria

- [ ] Accurate simulation of all strategy rules
- [ ] Conservative fee assumptions
- [ ] Comprehensive performance metrics
- [ ] Stress testing capabilities
- [ ] Parameter optimization support
- [ ] Clear visualization of results
- [ ] Export capabilities for analysis

## Notes

- This interface provides the structure, Blackbox implements the logic
- All placeholder methods must be implemented
- Use real historical Hyperliquid data
- Always assume heavier fees for conservative results
- Test across multiple timeframes and market conditions
