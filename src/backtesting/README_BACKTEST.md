# Hamburger Bot Backtesting Engine

A complete backtesting implementation for the Hamburger Bot trading strategy, providing realistic simulation with conservative assumptions.

## Features

### Core Functionality
- **Historical Data Processing**: Load and process OHLCV data with funding rates
- **Signal Calculation**: Parabolic SAR, ATR, Volume Spike, and ROC indicators
- **AI Decision Engine**: Full implementation of the Hamburger Bot decision hierarchy
- **Position Management**: Dynamic 2-4 position management with market orders
- **Performance Metrics**: Comprehensive performance analysis including Sharpe ratio, drawdown, win rate

### Realistic Assumptions
- **Taker Fees**: Always 0.05% (conservative assumption)
- **Slippage**: 0.01-0.05% based on volatility
- **Funding Rates**: Historical rates when available
- **Leverage Limits**: Enforced per symbol (40x, 20x, 10x, 3x tiers)
- **Market Orders**: No limit order fills, always market execution

## Quick Start

```typescript
import HamburgerBacktestEngine from './src/backtesting/hamburgerBacktestEngine.js'

// Configure backtest
const config = {
  symbol: 'BTC',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  initialCapital: 10000,
  commission: 0.0005,
  slippage: 0.0002,
  fundingRate: 0.0001
}

// Configure strategy
const strategy = {
  symbol: 'BTC',
  leverage: 10,
  gridSpacing: 1.0,
  aiAggressiveness: 'medium',
  aiConfidenceThreshold: 70,
  // ... other settings
}

// Create and run backtest
const engine = new HamburgerBacktestEngine(config, strategy)
await engine.loadData(historicalData)
const results = await engine.runBacktest()

// View results
console.log(`Return: ${results.performance.totalReturnPct.toFixed(2)}%`)
console.log(`Sharpe: ${results.performance.sharpeRatio.toFixed(2)}`)
```

## Data Format

Historical data should be an array of:

```typescript
interface HistoricalData {
  timestamp: number    // Unix timestamp in milliseconds
  open: number        // Open price
  high: number        // High price
  low: number         // Low price
  close: number       // Close price
  volume: number      // Volume in base currency
  funding_rate?: number // Funding rate (optional)
}
```

## Performance Metrics

The engine calculates comprehensive metrics:

- **Return Metrics**: Total return, percentage return, capital efficiency
- **Risk Metrics**: Sharpe ratio, maximum drawdown, volatility
- **Trade Metrics**: Win rate, profit factor, average win/loss
- **Cost Analysis**: Total fees, funding costs, slippage impact

## Decision Engine

The AI decision engine follows the exact hierarchy:

1. **ROC Panic Trigger** (>5% move) → Immediate cluster/flatten
2. **Volume Spike** (>2x average) → Prepare for movement
3. **Virtual Level Crossings** → Grid shifting
4. **SAR Trend Direction** → Position bias
5. **Default** → Hold positions

## Example Scenarios

### Bull Market Test
```typescript
const bullMarketConfig = {
  ...config,
  symbol: 'BTC',
  startDate: '2024-01-01',
  endDate: '2024-03-31' // Bull period
}
```

### Bear Market Test
```typescript
const bearMarketConfig = {
  ...config,
  symbol: 'ETH',
  startDate: '2024-05-01',
  endDate: '2024-06-30' // Bear period
}
```

### High Volatility Test
```typescript
const highVolConfig = {
  ...strategy,
  aiAggressiveness: 'high',
  gridSpacing: 0.5, // Tighter grid
  leverage: 20
}
```

## Parameter Optimization

Run multiple backtests to find optimal parameters:

```typescript
const gridSpacings = [0.5, 1.0, 1.5, 2.0]
const leverages = [5, 10, 15, 20]
const aggressiveness = ['low', 'medium', 'high']

for (const spacing of gridSpacings) {
  for (const leverage of leverages) {
    const testStrategy = { ...strategy, gridSpacing: spacing, leverage }
    const result = await runBacktest(testStrategy)
    console.log(`Spacing: ${spacing}%, Leverage: ${leverage}x, Return: ${result.performance.totalReturnPct}%`)
  }
}
```

## Export Results

### JSON Export
```typescript
import fs from 'fs'
fs.writeFileSync('backtest-results.json', JSON.stringify(results, null, 2))
```

### CSV Export
```typescript
const csv = [
  'Timestamp,Equity,Drawdown,Positions',
  ...results.equityCurve.map(p => `${p.timestamp},${p.equity},${p.drawdown},${p.openPositions}`)
].join('\n')
fs.writeFileSync('equity-curve.csv', csv)
```

## Validation

### Compare with Live Trading
1. Use same parameters as live bot
2. Compare actual fees vs assumed
3. Check slippage assumptions
4. Validate decision outcomes

### Stress Testing
- Test extreme market conditions
- Verify leverage limits enforcement
- Check position limits (2-4 positions)
- Validate stop loss/take profit execution

## Best Practices

1. **Conservative Assumptions**: Always use higher fees and slippage
2. **Sufficient Data**: Use at least 3 months of data
3. **Multiple Timeframes**: Test across different market conditions
4. **Parameter Sweeps**: Don't rely on single parameter set
5. **Out-of-Sample Testing**: Hold out recent data for validation

## Integration with Live Bot

The backtest engine uses the same:
- Signal calculations as live bot
- AI decision logic
- Position management rules
- Risk management parameters

This ensures backtest results are representative of live performance.

## Troubleshooting

### Poor Performance
- Check signal calculations
- Verify confidence thresholds
- Adjust grid spacing
- Review leverage usage

### Too Many Trades
- Increase confidence threshold
- Reduce AI aggressiveness
- Widen grid spacing
- Check for false signals

### Low Win Rate
- Verify stop loss/take profit settings
- Check position sizing
- Review decision reasoning
- Adjust signal parameters

## Files

- `hamburgerBacktestEngine.ts` - Main backtesting engine
- `example.ts` - Example usage and test
- `gridBacktestInterface.ts` - Interface for Blackbox (if needed)

## Dependencies

- Uses existing indicators from `src/indicators/`
- Compatible with main bot configuration
- No external dependencies required
