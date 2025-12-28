import { FastBacktestEngine } from './fastBacktestEngine'
import { HamburgerBotConfig } from '../types/grid'
import { logger } from '../utils/logger'

interface BulkTestResult {
  config: HamburgerBotConfig
  metrics: any
  trades: any[]
  score: number
}

interface ParameterRanges {
  gridSpacing: { min: number; max: number }
  positionSize: { min: number; max: number }
  leverage: { min: number; max: number }
  stopLossPct: { min: number; max: number }
  takeProfitPct: { min: number; max: number }
  maxActivePositions: { min: number; max: number }
  aiConfidenceThreshold: { min: number; max: number }
}

/**
 * Bulk Backtest Script
 * 
 * Runs randomized parameter optimizations to identify profitable configurations.
 * Tests the single position theory and various parameter combinations.
 */
class BulkBacktest {
  private engine: FastBacktestEngine
  private results: BulkTestResult[] = []
  private readonly symbol = 'BTC'
  private readonly startTime = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days ago
  private readonly endTime = Date.now()
  
  // Parameter ranges for randomization
  private readonly ranges: ParameterRanges = {
    gridSpacing: { min: 0.2, max: 2.0 }, // 0.2% to 2.0%
    positionSize: { min: 10, max: 50 }, // 10% to 50% of capital
    leverage: { min: 2, max: 10 }, // 2x to 10x leverage
    stopLossPct: { min: 0.5, max: 3.0 }, // 0.5% to 3.0%
    takeProfitPct: { min: 0.5, max: 3.0 }, // 0.5% to 3.0%
    maxActivePositions: { min: 1, max: 3 }, // Test 1-3 active positions
    aiConfidenceThreshold: { min: 60, max: 90 } // 60% to 90%
  }
  
  constructor() {
    // Initialize with a default config
    const defaultConfig: HamburgerBotConfig = {
      id: 'bulk-test',
      symbol: this.symbol,
      enabled: true,
      totalInvestmentUsd: 1000,
      leverage: 5,
      positionType: 'percentage',
      positionSize: 25,
      gridSpacing: 0.5,
      gridSpacingType: 'percentage',
      minPositions: 2,
      maxPositions: 4,
      maxActivePositions: 1, // Test single position theory
      stopLossPct: 1.5,
      takeProfitPct: 1.5,
      rebalanceThresholdPct: 10,
      maxCapitalUtilization: 95,
      maxPositionBiasPct: 60,
      aiAggressiveness: 'medium',
      aiConfidenceThreshold: 70
    }
    
    this.engine = new FastBacktestEngine(defaultConfig)
  }
  
  /**
   * Generate random configuration within parameter ranges
   */
  private generateRandomConfig(iteration: number): HamburgerBotConfig {
    const random = (min: number, max: number): number => 
      Math.random() * (max - min) + min
    
    const config: HamburgerBotConfig = {
      id: `bulk-test-${iteration}`,
      symbol: this.symbol,
      enabled: true,
      totalInvestmentUsd: 1000,
      leverage: Math.round(random(this.ranges.leverage.min, this.ranges.leverage.max)),
      positionType: 'percentage',
      positionSize: Math.round(random(this.ranges.positionSize.min, this.ranges.positionSize.max)),
      gridSpacing: Math.round(random(this.ranges.gridSpacing.min, this.ranges.gridSpacing.max) * 100) / 100,
      gridSpacingType: 'percentage',
      minPositions: 2,
      maxPositions: 4,
      maxActivePositions: Math.round(random(this.ranges.maxActivePositions.min, this.ranges.maxActivePositions.max)),
      stopLossPct: Math.round(random(this.ranges.stopLossPct.min, this.ranges.stopLossPct.max) * 100) / 100,
      takeProfitPct: Math.round(random(this.ranges.takeProfitPct.min, this.ranges.takeProfitPct.max) * 100) / 100,
      rebalanceThresholdPct: 10,
      maxCapitalUtilization: 95,
      maxPositionBiasPct: 60,
      aiAggressiveness: 'medium',
      aiConfidenceThreshold: Math.round(random(this.ranges.aiConfidenceThreshold.min, this.ranges.aiConfidenceThreshold.max))
    }
    
    // Log the config for bulk-test-26 (the best performer)
    if (iteration === 26) {
      logger.info(`Best performer config (bulk-test-26):`)
      logger.info(`  Grid Spacing: ${config.gridSpacing}%`)
      logger.info(`  Position Size: ${config.positionSize}%`)
      logger.info(`  Leverage: ${config.leverage}x`)
      logger.info(`  Max Active Positions: ${config.maxActivePositions}`)
      logger.info(`  Stop Loss: ${config.stopLossPct}%`)
      logger.info(`  Take Profit: ${config.takeProfitPct}%`)
      logger.info(`  AI Confidence: ${config.aiConfidenceThreshold}%`)
    }
    
    return config
  }
  
  /**
   * Calculate a score for ranking configurations
   * Higher score = better performance
   */
  private calculateScore(metrics: any): number {
    // Weight factors for different metrics
    const weights = {
      totalReturn: 0.3,
      sharpeRatio: 0.25,
      maxDrawdown: -0.2, // Negative because lower is better
      winRate: 0.15,
      profitFactor: 0.1
    }
    
    // Normalize metrics to 0-100 scale
    const normalizedReturn = Math.max(0, Math.min(100, (metrics.totalReturnPct + 50) * 2)) // -50% to 0% maps to 0-100
    const normalizedSharpe = Math.max(0, Math.min(100, (metrics.sharpeRatio + 2) * 25)) // -2 to 2 maps to 0-100
    const normalizedDrawdown = Math.max(0, 100 - metrics.maxDrawdown) // Lower drawdown is better
    const normalizedWinRate = metrics.winRate
    const normalizedProfitFactor = Math.max(0, Math.min(100, metrics.profitFactor * 20)) // 0-5 profit factor maps to 0-100
    
    const score = 
      normalizedReturn * weights.totalReturn +
      normalizedSharpe * weights.sharpeRatio +
      normalizedDrawdown * weights.maxDrawdown +
      normalizedWinRate * weights.winRate +
      normalizedProfitFactor * weights.profitFactor
    
    return Math.round(score * 100) / 100
  }
  
  /**
   * Run a single backtest with the given configuration
   */
  private async runSingleBacktest(config: HamburgerBotConfig): Promise<BulkTestResult> {
    logger.info(`Running backtest for config: ${config.id}`)
    
    // Create new engine with this config
    const engine = new FastBacktestEngine(config)
    
    try {
      // Load data and run backtest
      await engine.loadData(config.symbol, this.startTime, this.endTime)
      const result = await engine.runBacktest()
      
      const score = this.calculateScore(result.metrics)
      
      const bulkResult: BulkTestResult = {
        config,
        metrics: result.metrics,
        trades: result.trades,
        score
      }
      
      logger.info(`Config ${config.id} completed - Score: ${score} - Return: ${result.metrics.totalReturnPct.toFixed(2)}% - Sharpe: ${result.metrics.sharpeRatio.toFixed(2)}`)
      
      return bulkResult
    } catch (error) {
      logger.error(`Backtest failed for config ${config.id}:`, error)
      
      // Return a failed result
      return {
        config,
        metrics: {
          totalReturn: 0,
          totalReturnPct: 0,
          sharpeRatio: 0,
          maxDrawdown: 100,
          winRate: 0,
          profitFactor: 0,
          totalTrades: 0,
          totalFees: 0
        },
        trades: [],
        score: 0
      }
    }
  }
  
  /**
   * Run bulk backtests with randomized parameters
   */
  async runBulkBacktests(numTests: number = 100): Promise<BulkTestResult[]> {
    logger.info(`Starting bulk backtest with ${numTests} randomized configurations...`)
    
    this.results = []
    
    // Run tests in batches to avoid overwhelming the system
    const batchSize = 10
    for (let i = 0; i < numTests; i += batchSize) {
      const batch = Math.min(batchSize, numTests - i)
      const promises: Promise<BulkTestResult>[] = []
      
      for (let j = 0; j < batch; j++) {
        const config = this.generateRandomConfig(i + j)
        promises.push(this.runSingleBacktest(config))
      }
      
      // Wait for batch to complete
      const batchResults = await Promise.all(promises)
      this.results.push(...batchResults)
      
      logger.info(`Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(numTests / batchSize)} completed`)
    }
    
    // Sort results by score (best first)
    this.results.sort((a, b) => b.score - a.score)
    
    logger.info('Bulk backtest completed!')
    this.printSummary()
    
    return this.results
  }
  
  /**
   * Print summary of top results
   */
  private printSummary(): void {
    logger.info('\n=== TOP 10 CONFIGURATIONS ===')
    
    for (let i = 0; i < Math.min(10, this.results.length); i++) {
      const result = this.results[i]
      if (!result) continue
      
      logger.info(`\n#${i + 1} - Score: ${result.score}`)
      logger.info(`  Return: ${result.metrics.totalReturnPct.toFixed(2)}%`)
      logger.info(`  Sharpe: ${result.metrics.sharpeRatio.toFixed(2)}`)
      logger.info(`  Max Drawdown: ${result.metrics.maxDrawdown.toFixed(2)}%`)
      logger.info(`  Win Rate: ${result.metrics.winRate.toFixed(2)}%`)
      logger.info(`  Profit Factor: ${result.metrics.profitFactor.toFixed(2)}`)
      logger.info(`  Config:`)
      logger.info(`    Grid Spacing: ${result.config.gridSpacing}%`)
      logger.info(`    Position Size: ${result.config.positionSize}%`)
      logger.info(`    Leverage: ${result.config.leverage}x`)
      logger.info(`    Max Active Positions: ${result.config.maxActivePositions}`)
      logger.info(`    Stop Loss: ${result.config.stopLossPct}%`)
      logger.info(`    Take Profit: ${result.config.takeProfitPct}%`)
      logger.info(`    AI Confidence: ${result.config.aiConfidenceThreshold}%`)
    }
    
    // Analyze patterns in top performers
    this.analyzePatterns()
  }
  
  /**
   * Analyze patterns in top performing configurations
   */
  private analyzePatterns(): void {
    logger.info('\n=== PATTERN ANALYSIS ===')
    
    const topResults = this.results.slice(0, Math.min(20, this.results.length))
    
    // Calculate averages for top performers
    const avgGridSpacing = topResults.reduce((sum, r) => sum + r.config.gridSpacing, 0) / topResults.length
    const avgPositionSize = topResults.reduce((sum, r) => sum + r.config.positionSize, 0) / topResults.length
    const avgLeverage = topResults.reduce((sum, r) => sum + r.config.leverage, 0) / topResults.length
    const avgMaxActive = topResults.reduce((sum, r) => sum + r.config.maxActivePositions, 0) / topResults.length
    const avgStopLoss = topResults.reduce((sum, r) => sum + r.config.stopLossPct, 0) / topResults.length
    const avgTakeProfit = topResults.reduce((sum, r) => sum + r.config.takeProfitPct, 0) / topResults.length
    const avgAIConfidence = topResults.reduce((sum, r) => sum + r.config.aiConfidenceThreshold, 0) / topResults.length
    
    logger.info(`Top performers average:`)
    logger.info(`  Grid Spacing: ${avgGridSpacing.toFixed(2)}%`)
    logger.info(`  Position Size: ${avgPositionSize.toFixed(1)}%`)
    logger.info(`  Leverage: ${avgLeverage.toFixed(1)}x`)
    logger.info(`  Max Active Positions: ${avgMaxActive.toFixed(1)}`)
    logger.info(`  Stop Loss: ${avgStopLoss.toFixed(2)}%`)
    logger.info(`  Take Profit: ${avgTakeProfit.toFixed(2)}%`)
    logger.info(`  AI Confidence: ${avgAIConfidence.toFixed(1)}%`)
    
    // Check single position theory
    const singlePositionResults = topResults.filter(r => r.config.maxActivePositions === 1)
    const multiPositionResults = topResults.filter(r => r.config.maxActivePositions > 1)
    
    if (singlePositionResults.length > 0 && multiPositionResults.length > 0) {
      const singleAvgScore = singlePositionResults.reduce((sum, r) => sum + r.score, 0) / singlePositionResults.length
      const multiAvgScore = multiPositionResults.reduce((sum, r) => sum + r.score, 0) / multiPositionResults.length
      
      logger.info(`\nSingle Position Theory Check:`)
      logger.info(`  Single position avg score: ${singleAvgScore.toFixed(2)}`)
      logger.info(`  Multi position avg score: ${multiAvgScore.toFixed(2)}`)
      logger.info(`  Single position performs ${singleAvgScore > multiAvgScore ? 'better' : 'worse'}`)
    }
    
    // Save detailed results
    this.saveResults()
  }
  
  /**
   * Save results to file
   */
  private async saveResults(): Promise<void> {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      
      const resultsDir = path.join(process.cwd(), 'bulk_backtest_results')
      await fs.mkdir(resultsDir, { recursive: true })
      
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `bulk-backtest-${this.symbol}-${timestamp}.json`
      const filepath = path.join(resultsDir, filename)
      
      await fs.writeFile(filepath, JSON.stringify(this.results, null, 2))
      logger.info(`\nDetailed results saved to: ${filepath}`)
    } catch (error) {
      logger.error('Failed to save results:', error)
    }
  }
  
  /**
   * Get the best configuration
   */
  getBestConfig(): HamburgerBotConfig | null {
    if (this.results.length === 0) return null
    const bestResult = this.results[0]
    return bestResult ? bestResult.config : null
  }
  
  /**
   * Get top N configurations
   */
  getTopConfigs(n: number): BulkTestResult[] {
    return this.results.slice(0, Math.min(n, this.results.length))
  }
}

// Run bulk backtest if this file is executed directly
if (require.main === module) {
  const bulkBacktest = new BulkBacktest()
  
  // Run 100 randomized tests
  bulkBacktest.runBulkBacktests(100)
    .then(() => {
      logger.info('\nBulk backtest completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Bulk backtest failed:', error)
      process.exit(1)
    })
}

export { BulkBacktest, BulkTestResult, ParameterRanges }
