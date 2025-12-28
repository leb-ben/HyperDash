/**
 * Example usage of the Hamburger Bot Backtesting Engine
 */

import HamburgerBacktestEngine, { type BacktestConfig, type HistoricalData } from './hamburgerBacktestEngine.js'
import type { HamburgerBotConfig } from '../types/grid.js'

// Example configuration
const backtestConfig: BacktestConfig = {
  symbol: 'BTC',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  initialCapital: 10000,
  commission: 0.0005, // 0.05% taker fees
  slippage: 0.0002, // 0.02% slippage
  fundingRate: 0.0001 // 0.01% per 8 hours
}

const strategyConfig: HamburgerBotConfig = {
  id: 'test-bot',
  symbol: 'BTC',
  enabled: true,
  totalInvestmentUsd: 10000,
  leverage: 10,
  gridSpacing: 1.0,
  gridSpacingType: 'percentage',
  minPositions: 2,
  maxPositions: 4,
  stopLossPct: 3.0,
  takeProfitPct: 2.0,
  rebalanceThresholdPct: 0.5,
  maxCapitalUtilization: 95,
  maxPositionBiasPct: 60,
  aiAggressiveness: 'medium',
  aiConfidenceThreshold: 70,
  ai: {
    aggressiveness: 'medium',
    confidenceThreshold: 70,
    signals: {
      parabolicSAR: {
        acceleration: 0.02,
        maximum: 0.2
      },
      atr: {
        period: 14,
        multiplier: 2
      },
      volume: {
        spikeThreshold: 2.0,
        lookback: 20
      },
      roc: {
        period: 10,
        panicThreshold: 5.0
      }
    }
  },
  grid: {
    defaultSpacing: 1.0
  }
}

// Example historical data generation (in real use, fetch from API)
function generateSampleData(): HistoricalData[] {
  const data: HistoricalData[] = []
  let timestamp = new Date('2024-01-01').getTime()
  let price = 45000
  
  for (let i = 0; i < 10000; i++) { // ~70 days of 5-minute data
    // Random walk with some trends
    const change = (Math.random() - 0.48) * price * 0.001 // Slight upward bias
    price = Math.max(price + change, 30000) // Min price floor
    
    data.push({
      timestamp,
      open: price,
      high: price * (1 + Math.random() * 0.002),
      low: price * (1 - Math.random() * 0.002),
      close: price * (1 + (Math.random() - 0.5) * 0.001),
      volume: 1000000 + Math.random() * 500000,
      funding_rate: (Math.random() - 0.5) * 0.0001
    })
    
    timestamp += 5 * 60 * 1000 // 5 minutes
  }
  
  return data
}

// Run the backtest
async function runBacktest(): Promise<void> {
  console.log('Starting Hamburger Bot backtest...')
  
  // Create engine
  const engine = new HamburgerBacktestEngine(backtestConfig, strategyConfig)
  
  // Load data
  const historicalData = generateSampleData()
  await engine.loadData(historicalData)
  
  // Run backtest
  const results = await engine.runBacktest()
  
  // Display results
  console.log('\n=== BACKTEST RESULTS ===')
  console.log(`Symbol: ${results.config.symbol}`)
  console.log(`Period: ${results.config.startDate} to ${results.config.endDate}`)
  console.log(`Initial Capital: $${results.config.initialCapital.toLocaleString()}`)
  const finalEquity = results.equityCurve[results.equityCurve.length - 1]
  console.log(`Final Equity: $${finalEquity?.equity.toFixed(2) || '0'}`)
  console.log(`Total Return: ${results.performance.totalReturnPct.toFixed(2)}%`)
  console.log(`Sharpe Ratio: ${results.performance.sharpeRatio.toFixed(2)}`)
  console.log(`Max Drawdown: ${results.performance.maxDrawdownPct.toFixed(2)}%`)
  console.log(`Win Rate: ${results.performance.winRate.toFixed(2)}%`)
  console.log(`Profit Factor: ${results.performance.profitFactor.toFixed(2)}`)
  console.log(`Total Trades: ${results.performance.totalTrades}`)
  console.log(`Total Fees: $${results.performance.totalFees.toFixed(2)}`)
  
  // Show recent trades
  console.log('\n=== RECENT TRADES ===')
  results.trades.slice(-5).forEach(trade => {
    console.log(`${trade.side.toUpperCase()} ${trade.symbol}: Entry $${trade.entryPrice.toFixed(2)}, Exit $${trade.exitPrice.toFixed(2)}, PnL $${trade.pnl.toFixed(2)} (${trade.pnlPct.toFixed(2)}%)`)
  })
  
  // Show recent decisions
  console.log('\n=== RECENT DECISIONS ===')
  results.decisions.slice(-5).forEach(decision => {
    console.log(`${decision.action.toUpperCase()} (Confidence: ${decision.confidence}%): ${decision.reasoning}`)
  })
}

// Export for use
export { runBacktest, backtestConfig, strategyConfig }

// Run if executed directly
if (require.main === module) {
  runBacktest().catch(console.error)
}
