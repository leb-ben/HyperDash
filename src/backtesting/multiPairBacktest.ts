import { FastBacktestEngine } from './fastBacktestEngine.js'
import { HamburgerBotConfig, getLeverageLimit } from '../types/grid.js'
import { logger } from '../utils/logger.js'

interface PairResult {
  symbol: string
  returnPct: number
  sharpeRatio: number
  maxDrawdown: number
  winRate: number
  totalTrades: number
  fees: number
}

/**
 * Multi-Pair Backtest Script
 * 
 * Runs the optimized "Smart Grid" configuration against all supported trading pairs.
 * Automatically caps leverage based on symbol tiers.
 */
class MultiPairBacktest {
  private readonly startTime = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days ago
  private readonly endTime = Date.now()
  private results: PairResult[] = []

  // Winning parameters from bulk backtest + refinement features
  private readonly optimizedParams = {
    gridSpacing: 1.0, // Wider base spacing
    positionSize: 15, // Smaller positions for safety
    stopLossPct: 2.0,
    takeProfitPct: 4.0,
    aiConfidenceThreshold: 75,
    useTrendFilter: false, // Predictive disabled
    useReversalConfirmation: true,
    useTrailingStop: true,
    minVolumeMultiplier: 1.1, // Slightly less restrictive
    maxActivePositions: 1,
    useAdaptiveGrid: true,
    atrMultiplier: 2.5, // Wider adaptive spacing
    useDynamicSLTP: true,
    tpAtrMultiplier: 4.0, // Let winners run more
    slAtrMultiplier: 2.0, // Wider stops to avoid noise
    useBreakEvenStop: true,
    breakEvenThresholdPct: 25, // Move to BE very early (at 25% of TP)
    exitOnTrendFlip: true,
    useRSIFilter: false, // Predictive disabled
    rsiUpperThreshold: 65,
    rsiLowerThreshold: 35,
    useMACDFilter: false, // Predictive disabled
    useReactiveMode: true, // REACTIVE ENABLED
    reactionLookback: 12, // ~12m lookback
    reactionThreshold: 0.15 // 0.15% move to trigger reaction
  }

  private readonly symbols = [
    'BTC', 'ETH', 'SOL', 'XRP', // Tier 1 (40x)
    'DOGE', 'SUI', 'WLD', 'LTC', 'LINK', 'AVAX', 'HYPE', 'TIA', 'APT', 'NEAR', // Tier 2 (20x)
    'OP', 'ARB', 'LDO', 'TON', 'JUP', 'SEI', 'BNB', 'DOT', // Tier 3 (10x)
    'AAVE', 'UNI' // Tier 4 (5x)
  ]

  /**
   * Run backtest for all pairs
   */
  async runAllPairs(): Promise<void> {
    logger.info(`Starting multi-pair backtest for ${this.symbols.length} pairs...`)
    this.results = []

    for (const symbol of this.symbols) {
      const maxLeverage = getLeverageLimit(symbol)
      // Use optimized leverage (4x) but cap it if symbol limit is lower
      const leverage = Math.min(4, maxLeverage)

      const config: HamburgerBotConfig = {
        id: `multi-pair-${symbol}`,
        symbol,
        enabled: true,
        totalInvestmentUsd: 1000,
        leverage,
        positionType: 'percentage',
        positionSize: this.optimizedParams.positionSize,
        gridSpacing: this.optimizedParams.gridSpacing,
        gridSpacingType: 'percentage',
        minPositions: 2,
        maxPositions: 4,
        maxActivePositions: this.optimizedParams.maxActivePositions,
        stopLossPct: this.optimizedParams.stopLossPct,
        takeProfitPct: this.optimizedParams.takeProfitPct,
        rebalanceThresholdPct: 10,
        maxCapitalUtilization: 95,
        maxPositionBiasPct: 60,
        aiAggressiveness: 'medium',
        aiConfidenceThreshold: this.optimizedParams.aiConfidenceThreshold,
        useTrendFilter: this.optimizedParams.useTrendFilter,
        useReversalConfirmation: this.optimizedParams.useReversalConfirmation,
        useTrailingStop: this.optimizedParams.useTrailingStop,
        minVolumeMultiplier: this.optimizedParams.minVolumeMultiplier,
        useAdaptiveGrid: this.optimizedParams.useAdaptiveGrid,
        atrMultiplier: this.optimizedParams.atrMultiplier,
        useDynamicSLTP: this.optimizedParams.useDynamicSLTP,
        tpAtrMultiplier: this.optimizedParams.tpAtrMultiplier,
        slAtrMultiplier: this.optimizedParams.slAtrMultiplier,
        useBreakEvenStop: this.optimizedParams.useBreakEvenStop,
        breakEvenThresholdPct: this.optimizedParams.breakEvenThresholdPct,
        exitOnTrendFlip: this.optimizedParams.exitOnTrendFlip,
        useRSIFilter: this.optimizedParams.useRSIFilter,
        rsiUpperThreshold: this.optimizedParams.rsiUpperThreshold,
        rsiLowerThreshold: this.optimizedParams.rsiLowerThreshold,
        useMACDFilter: this.optimizedParams.useMACDFilter,
        useReactiveMode: this.optimizedParams.useReactiveMode,
        reactionLookback: this.optimizedParams.reactionLookback,
        reactionThreshold: this.optimizedParams.reactionThreshold
      }

      logger.info(`Running backtest for ${symbol} (Leverage: ${leverage}x)...`)
      
      const engine = new FastBacktestEngine(config)
      
      try {
        await engine.loadData(symbol, this.startTime, this.endTime)
        const result = await engine.runBacktest()
        
        this.results.push({
          symbol,
          returnPct: result.metrics.totalReturnPct,
          sharpeRatio: result.metrics.sharpeRatio,
          maxDrawdown: result.metrics.maxDrawdown,
          winRate: result.metrics.winRate,
          totalTrades: result.metrics.totalTrades,
          fees: result.metrics.totalFees
        })

        logger.info(`${symbol} completed: ${result.metrics.totalReturnPct.toFixed(2)}% return`)
      } catch (error) {
        logger.error(`Backtest failed for ${symbol}:`, error)
      }
    }

    this.printSummary()
    await this.saveResults()
  }

  /**
   * Print final summary table
   */
  private printSummary(): void {
    // Sort results by return percentage
    this.results.sort((a, b) => b.returnPct - a.returnPct)

    logger.info('\n=== MULTI-PAIR BACKTEST SUMMARY ===')
    logger.info(String('').padEnd(8) + ' | ' + String('Return').padStart(8) + ' | ' + String('Sharpe').padStart(6) + ' | ' + String('DD').padStart(6) + ' | ' + String('Win%').padStart(6) + ' | ' + String('Trades').padStart(6))
    logger.info('-'.repeat(55))

    for (const r of this.results) {
      const row = `${r.symbol.padEnd(8)} | ${r.returnPct.toFixed(2).padStart(7)}% | ${r.sharpeRatio.toFixed(2).padStart(6)} | ${r.maxDrawdown.toFixed(2).padStart(5)}% | ${r.winRate.toFixed(1).padStart(5)}% | ${String(r.totalTrades).padStart(6)}`
      logger.info(row)
    }

    const avgReturn = this.results.reduce((sum, r) => sum + r.returnPct, 0) / this.results.length
    const positivePairs = this.results.filter(r => r.returnPct > 0).length
    
    logger.info('-'.repeat(55))
    logger.info(`Overall Average Return: ${avgReturn.toFixed(2)}%`)
    logger.info(`Profitable Pairs: ${positivePairs}/${this.results.length} (${(positivePairs/this.results.length*100).toFixed(1)}%)`)
  }

  /**
   * Save results to JSON
   */
  private async saveResults(): Promise<void> {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      const resultsDir = path.join(process.cwd(), 'backtest_Results')
      await fs.mkdir(resultsDir, { recursive: true })
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filepath = path.join(resultsDir, `multi-pair-results-${timestamp}.json`)
      
      await fs.writeFile(filepath, JSON.stringify(this.results, null, 2))
      logger.info(`\nDetailed results saved to: ${filepath}`)
    } catch (error) {
      logger.error('Failed to save results:', error)
    }
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new MultiPairBacktest()
  tester.runAllPairs()
    .then(() => process.exit(0))
    .catch(err => {
      logger.error('Multi-pair backtest failed:', err)
      process.exit(1)
    })
}

export { MultiPairBacktest }
