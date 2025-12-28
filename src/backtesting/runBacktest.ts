#!/usr/bin/env node

/**
 * CLI script to run Hamburger Bot backtests
 */

import { program } from 'commander'
import fs from 'fs/promises'
import path from 'path'
import HamburgerBacktestEngine from './hamburgerBacktestEngine.js'
import type { BacktestConfig } from './hamburgerBacktestEngine.js'
import type { HistoricalData } from './hamburgerBacktestEngine.js'
import type { HamburgerBotConfig } from '../types/grid.js'

interface CliOptions {
  symbol: string
  startDate: string
  endDate: string
  capital: number
  leverage: number
  gridSpacing: number
  aggressiveness: 'low' | 'medium' | 'high'
  confidence: number
  outputFile?: string
  verbose: boolean
}

// Load configuration from file
async function loadConfig(configPath: string): Promise<any> {
  try {
    const content = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error(`Failed to load config from ${configPath}:`, error)
    process.exit(1)
  }
}

// Load historical data from CSV
async function loadDataFromCSV(csvPath: string): Promise<HistoricalData[]> {
  try {
    const content = await fs.readFile(csvPath, 'utf-8')
    const lines = content.split('\n').filter(line => line.trim())
    
    // Skip header if present
    const startIndex = lines[0]?.includes('timestamp') ? 1 : 0
    const data: HistoricalData[] = []
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      const [timestamp, open, high, low, close, volume, funding] = line.split(',')
      if (timestamp && open && high && low && close && volume) {
        data.push({
          timestamp: parseInt(timestamp) * 1000, // Convert to milliseconds
          open: parseFloat(open),
          high: parseFloat(high),
          low: parseFloat(low),
          close: parseFloat(close),
          volume: parseFloat(volume),
          funding_rate: funding ? parseFloat(funding) : undefined
        })
      }
    }
    
    return data
  } catch (error) {
    console.error(`Failed to load data from ${csvPath}:`, error)
    process.exit(1)
  }
}

// Generate sample data if no file provided
function generateSampleData(days: number = 30): HistoricalData[] {
  const data: HistoricalData[] = []
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000
  
  let price = 45000
  
  for (let i = 0; i < days * 24 * 12; i++) { // 5-minute candles
    const timestamp = now - (days * 24 * 60 * 60 * 1000) + (i * fiveMinutes)
    
    // Random walk with trend
    const trend = Math.sin(i / 100) * 0.0001 // Slow oscillating trend
    const noise = (Math.random() - 0.5) * 0.002 // Random noise
    const change = price * (trend + noise)
    
    price = Math.max(price + change, 30000) // Price floor
    
    data.push({
      timestamp,
      open: price,
      high: price * (1 + Math.random() * 0.002),
      low: price * (1 - Math.random() * 0.002),
      close: price * (1 + (Math.random() - 0.5) * 0.001),
      volume: 1000000 + Math.random() * 500000,
      funding_rate: (Math.random() - 0.5) * 0.0001
    })
  }
  
  return data
}

// Run backtest with options
async function runBacktest(options: CliOptions): Promise<void> {
  if (options.verbose) {
    console.log('Starting backtest with options:', options)
  }
  
  // Create backtest config
  const backtestConfig: BacktestConfig = {
    symbol: options.symbol || 'BTC',
    startDate: options.startDate || '2024-01-01',
    endDate: options.endDate || '2024-12-31',
    initialCapital: options.capital || 10000,
    commission: 0.0005, // 0.05% taker fees
    slippage: 0.0002, // 0.02% slippage
    fundingRate: 0.0001
  }
  
  // Create strategy config
  const strategyConfig: HamburgerBotConfig = {
    id: `backtest-${Date.now()}`,
    symbol: options.symbol || 'BTC',
    enabled: true,
    totalInvestmentUsd: options.capital || 10000,
    leverage: options.leverage || 10,
    gridSpacing: options.gridSpacing || 1.0,
    gridSpacingType: 'percentage',
    minPositions: 2,
    maxPositions: 4,
    stopLossPct: 3.0,
    takeProfitPct: 2.0,
    rebalanceThresholdPct: 0.5,
    maxCapitalUtilization: 95,
    maxPositionBiasPct: 60,
    aiAggressiveness: options.aggressiveness || 'medium',
    aiConfidenceThreshold: options.confidence || 70,
    ai: {
      aggressiveness: options.aggressiveness || 'medium',
      confidenceThreshold: options.confidence || 70,
      signals: {
        parabolicSAR: { acceleration: 0.02, maximum: 0.2 },
        atr: { period: 14, multiplier: 2 },
        volume: { spikeThreshold: 2.0, lookback: 20 },
        roc: { period: 10, panicThreshold: 5.0 }
      }
    },
    grid: { defaultSpacing: options.gridSpacing || 1.0 }
  }
  
  // Create engine
  const engine = new HamburgerBacktestEngine(backtestConfig, strategyConfig)
  
  // Load data
  const data = generateSampleData(30) // 30 days of sample data
  await engine.loadData(data)
  
  if (options.verbose) {
    console.log(`Loaded ${data.length} data points`)
  }
  
  // Run backtest
  console.log('Running backtest...')
  const results = await engine.runBacktest()
  
  // Display results
  console.log('\n=== BACKTEST RESULTS ===')
  console.log(`Symbol: ${results.config.symbol}`)
  console.log(`Period: ${results.config.startDate} to ${results.config.endDate}`)
  console.log(`Initial Capital: $${results.config.initialCapital.toLocaleString()}`)
  const finalEquity = results.equityCurve[results.equityCurve.length - 1]
  console.log(`Final Equity: $${finalEquity?.equity.toFixed(2) || '0'}`)
  console.log(`\nPerformance:`)
  console.log(`  Total Return: ${results.performance.totalReturnPct.toFixed(2)}%`)
  console.log(`  Sharpe Ratio: ${results.performance.sharpeRatio.toFixed(2)}`)
  console.log(`  Max Drawdown: ${results.performance.maxDrawdownPct.toFixed(2)}%`)
  console.log(`  Win Rate: ${results.performance.winRate.toFixed(2)}%`)
  console.log(`  Profit Factor: ${results.performance.profitFactor.toFixed(2)}`)
  console.log(`\nTrading:`)
  console.log(`  Total Trades: ${results.performance.totalTrades}`)
  console.log(`  Winning Trades: ${results.performance.winningTrades}`)
  console.log(`  Losing Trades: ${results.performance.losingTrades}`)
  console.log(`  Average Win: $${results.performance.avgWin.toFixed(2)}`)
  console.log(`  Average Loss: $${results.performance.avgLoss.toFixed(2)}`)
  console.log(`\nCosts:`)
  console.log(`  Total Fees: $${results.performance.totalFees.toFixed(2)}`)
  console.log(`  Total Slippage: $${results.performance.totalSlippage.toFixed(2)}`)
  
  // Save results if output file specified
  if (options.outputFile) {
    const outputPath = path.resolve(options.outputFile)
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2))
    console.log(`\nResults saved to: ${outputPath}`)
  }
}

// Setup CLI
program
  .name('hamburger-backtest')
  .description('Run backtests for the Hamburger Bot strategy')
  .option('-s, --symbol <symbol>', 'Trading symbol', 'BTC')
  .option('--start-date <date>', 'Start date (YYYY-MM-DD)', '2024-01-01')
  .option('--end-date <date>', 'End date (YYYY-MM-DD)', '2024-12-31')
  .option('-c, --capital <amount>', 'Initial capital in USD', '10000')
  .option('-l, --leverage <amount>', 'Leverage multiplier', '10')
  .option('-g, --grid-spacing <percentage>', 'Grid spacing percentage', '1.0')
  .option('-a, --aggressiveness <level>', 'AI aggressiveness (low/medium/high)', 'medium')
  .option('--confidence <percentage>', 'AI confidence threshold', '70')
  .option('-o, --output <file>', 'Output results to file')
  .option('-v, --verbose', 'Verbose output')
  .action(runBacktest)

// Parse and run
program.parse()
