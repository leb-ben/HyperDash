import { FastBacktestEngine } from './fastBacktestEngine'
import { HamburgerBotConfig } from '../types/grid'
import { logger } from '../utils/logger'

interface ImprovedBulkTestResult {
  config: HamburgerBotConfig
  metrics: any
  trades: any[]
  score: number
  strategy: string
}

/**
 * Improved Bulk Backtest with Strategy Modifications
 * 
 * Tests several enhanced strategies based on quantitative trading best practices:
 * 1. Dynamic Grid Spacing (wider in high volatility)
 * 2. Trend-Following Bias (avoid counter-trend positions)
 * 3. Volatility-Adjusted Position Sizing
 * 4. Mean Reversion Detection
 * 5. Funding Rate Arbitrage Focus
 */
class ImprovedBulkBacktest {
  private engine: FastBacktestEngine
  private results: ImprovedBulkTestResult[] = []
  private readonly symbol = 'BTC'
  private readonly startTime = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days ago
  private readonly endTime = Date.now()
  
  constructor() {
    // Initialize with improved base config
    const defaultConfig: HamburgerBotConfig = {
      id: 'improved-bulk-test',
      symbol: this.symbol,
      enabled: true,
      totalInvestmentUsd: 1000,
      leverage: 3,
      positionType: 'percentage',
      positionSize: 20,
      gridSpacing: 0.8,
      gridSpacingType: 'percentage',
      minPositions: 2,
      maxPositions: 4,
      maxActivePositions: 1,
      stopLossPct: 2.5,
      takeProfitPct: 1.5,
      rebalanceThresholdPct: 10,
      maxCapitalUtilization: 95,
      maxPositionBiasPct: 60,
      useTrendFilter: true,
      useReversalConfirmation: true,
      useTrailingStop: true,
      minVolumeMultiplier: 1.2,
      useAdaptiveGrid: true,
      atrMultiplier: 2.5,
      useDynamicSLTP: true,
      tpAtrMultiplier: 4.0,
      slAtrMultiplier: 2.0,
      useBreakEvenStop: true,
      breakEvenThresholdPct: 25,
      exitOnTrendFlip: true,
      useRSIFilter: false,
      rsiUpperThreshold: 70,
      rsiLowerThreshold: 30,
      useMACDFilter: false,
      useReactiveMode: true,
      reactionLookback: 12,
      reactionThreshold: 0.15,
      aiAggressiveness: 'medium',
      aiConfidenceThreshold: 75,
      ai: {
        aggressiveness: 'medium',
        confidenceThreshold: 75,
        signals: {
          parabolicSAR: { acceleration: 0.02, maximum: 0.2 },
          atr: { period: 14, multiplier: 2 },
          volume: { spikeThreshold: 2.0, lookback: 20 },
          roc: { period: 10, panicThreshold: 5.0 }
        }
      },
      grid: { defaultSpacing: 0.8 }
    }
    
    this.engine = new FastBacktestEngine(defaultConfig)
  }
  
  /**
   * Strategy 1: Dynamic Grid Spacing
   */
  private createDynamicGridConfig(iteration: number): HamburgerBotConfig {
    return {
      id: `dynamic-grid-${iteration}`,
      symbol: this.symbol,
      enabled: true,
      totalInvestmentUsd: 1000,
      leverage: 3,
      positionType: 'percentage',
      positionSize: 25,
      gridSpacing: 1.2,
      gridSpacingType: 'percentage',
      minPositions: 2,
      maxPositions: 4,
      maxActivePositions: 1,
      stopLossPct: 3.0,
      takeProfitPct: 2.0,
      rebalanceThresholdPct: 10,
      maxCapitalUtilization: 95,
      maxPositionBiasPct: 60,
      useTrendFilter: true,
      useReversalConfirmation: true,
      useTrailingStop: true,
      minVolumeMultiplier: 1.5,
      useAdaptiveGrid: true,
      atrMultiplier: 3.0,
      useDynamicSLTP: true,
      tpAtrMultiplier: 4.5,
      slAtrMultiplier: 2.5,
      useBreakEvenStop: true,
      breakEvenThresholdPct: 30,
      exitOnTrendFlip: true,
      useRSIFilter: true,
      rsiUpperThreshold: 75,
      rsiLowerThreshold: 25,
      useMACDFilter: true,
      useReactiveMode: false,
      reactionLookback: 12,
      reactionThreshold: 0.2,
      aiAggressiveness: 'low',
      aiConfidenceThreshold: 80,
      ai: {
        aggressiveness: 'low',
        confidenceThreshold: 80,
        signals: {
          parabolicSAR: { acceleration: 0.01, maximum: 0.15 },
          atr: { period: 20, multiplier: 3 },
          volume: { spikeThreshold: 2.5, lookback: 30 },
          roc: { period: 14, panicThreshold: 6.0 }
        }
      },
      grid: { defaultSpacing: 1.2 }
    };
  }

  private createTrendFollowingConfig(iteration: number): HamburgerBotConfig {
    return {
      id: `trend-follow-${iteration}`,
      symbol: this.symbol,
      enabled: true,
      totalInvestmentUsd: 1000,
      leverage: 4,
      positionType: 'percentage',
      positionSize: 30,
      gridSpacing: 0.6,
      gridSpacingType: 'percentage',
      minPositions: 2,
      maxPositions: 4,
      maxActivePositions: 1,
      stopLossPct: 1.5,
      takeProfitPct: 3.0,
      rebalanceThresholdPct: 10,
      maxCapitalUtilization: 95,
      maxPositionBiasPct: 60,
      useTrendFilter: true,
      useReversalConfirmation: false,
      useTrailingStop: true,
      minVolumeMultiplier: 1.0,
      useAdaptiveGrid: false,
      atrMultiplier: 2.0,
      useDynamicSLTP: false,
      tpAtrMultiplier: 3.0,
      slAtrMultiplier: 1.5,
      useBreakEvenStop: true,
      breakEvenThresholdPct: 20,
      exitOnTrendFlip: true,
      useRSIFilter: false,
      rsiUpperThreshold: 70,
      rsiLowerThreshold: 30,
      useMACDFilter: true,
      useReactiveMode: true,
      reactionLookback: 8,
      reactionThreshold: 0.1,
      aiAggressiveness: 'high',
      aiConfidenceThreshold: 70,
      ai: {
        aggressiveness: 'high',
        confidenceThreshold: 70,
        signals: {
          parabolicSAR: { acceleration: 0.03, maximum: 0.25 },
          atr: { period: 10, multiplier: 1.5 },
          volume: { spikeThreshold: 1.5, lookback: 15 },
          roc: { period: 8, panicThreshold: 4.0 }
        }
      },
      grid: { defaultSpacing: 0.6 }
    };
  }

  private createVolatilityAdjustedConfig(iteration: number): HamburgerBotConfig {
    return {
      id: `vol-adj-${iteration}`,
      symbol: this.symbol,
      enabled: true,
      totalInvestmentUsd: 1000,
      leverage: 2,
      positionType: 'percentage',
      positionSize: 15,
      gridSpacing: 1.5,
      gridSpacingType: 'percentage',
      minPositions: 2,
      maxPositions: 4,
      maxActivePositions: 1,
      stopLossPct: 4.0,
      takeProfitPct: 1.0,
      rebalanceThresholdPct: 10,
      maxCapitalUtilization: 95,
      maxPositionBiasPct: 60,
      useTrendFilter: true,
      useReversalConfirmation: true,
      useTrailingStop: true,
      minVolumeMultiplier: 2.0,
      useAdaptiveGrid: true,
      atrMultiplier: 4.0,
      useDynamicSLTP: true,
      tpAtrMultiplier: 5.0,
      slAtrMultiplier: 3.0,
      useBreakEvenStop: true,
      breakEvenThresholdPct: 40,
      exitOnTrendFlip: false,
      useRSIFilter: true,
      rsiUpperThreshold: 80,
      rsiLowerThreshold: 20,
      useMACDFilter: false,
      useReactiveMode: false,
      reactionLookback: 20,
      reactionThreshold: 0.3,
      aiAggressiveness: 'low',
      aiConfidenceThreshold: 85,
      ai: {
        aggressiveness: 'low',
        confidenceThreshold: 85,
        signals: {
          parabolicSAR: { acceleration: 0.005, maximum: 0.1 },
          atr: { period: 30, multiplier: 4 },
          volume: { spikeThreshold: 3.0, lookback: 40 },
          roc: { period: 20, panicThreshold: 8.0 }
        }
      },
      grid: { defaultSpacing: 1.5 }
    };
  }

  private createMeanReversionConfig(iteration: number): HamburgerBotConfig {
    return {
      id: `mean-rev-${iteration}`,
      symbol: this.symbol,
      enabled: true,
      totalInvestmentUsd: 1000,
      leverage: 5,
      positionType: 'percentage',
      positionSize: 20,
      gridSpacing: 0.4,
      gridSpacingType: 'percentage',
      minPositions: 2,
      maxPositions: 4,
      maxActivePositions: 1,
      stopLossPct: 1.0,
      takeProfitPct: 1.0,
      rebalanceThresholdPct: 10,
      maxCapitalUtilization: 95,
      maxPositionBiasPct: 60,
      useTrendFilter: false,
      useReversalConfirmation: true,
      useTrailingStop: false,
      minVolumeMultiplier: 1.0,
      useAdaptiveGrid: true,
      atrMultiplier: 1.5,
      useDynamicSLTP: false,
      tpAtrMultiplier: 2.0,
      slAtrMultiplier: 1.0,
      useBreakEvenStop: false,
      breakEvenThresholdPct: 10,
      exitOnTrendFlip: true,
      useRSIFilter: true,
      rsiUpperThreshold: 65,
      rsiLowerThreshold: 35,
      useMACDFilter: true,
      useReactiveMode: true,
      reactionLookback: 6,
      reactionThreshold: 0.05,
      aiAggressiveness: 'medium',
      aiConfidenceThreshold: 75,
      ai: {
        aggressiveness: 'medium',
        confidenceThreshold: 75,
        signals: {
          parabolicSAR: { acceleration: 0.02, maximum: 0.2 },
          atr: { period: 14, multiplier: 1.5 },
          volume: { spikeThreshold: 2.0, lookback: 20 },
          roc: { period: 10, panicThreshold: 5.0 }
        }
      },
      grid: { defaultSpacing: 0.4 }
    };
  }

  private createFundingRateConfig(iteration: number): HamburgerBotConfig {
    return {
      id: `funding-arb-${iteration}`,
      symbol: this.symbol,
      enabled: true,
      totalInvestmentUsd: 1000,
      leverage: 2,
      positionType: 'percentage',
      positionSize: 40,
      gridSpacing: 2.0,
      gridSpacingType: 'percentage',
      minPositions: 2,
      maxPositions: 4,
      maxActivePositions: 1,
      stopLossPct: 5.0,
      takeProfitPct: 0.5,
      rebalanceThresholdPct: 10,
      maxCapitalUtilization: 95,
      maxPositionBiasPct: 60,
      useTrendFilter: true,
      useReversalConfirmation: false,
      useTrailingStop: false,
      minVolumeMultiplier: 1.0,
      useAdaptiveGrid: false,
      atrMultiplier: 5.0,
      useDynamicSLTP: false,
      tpAtrMultiplier: 1.0,
      slAtrMultiplier: 5.0,
      useBreakEvenStop: false,
      breakEvenThresholdPct: 0,
      exitOnTrendFlip: false,
      useRSIFilter: false,
      rsiUpperThreshold: 90,
      rsiLowerThreshold: 10,
      useMACDFilter: false,
      useReactiveMode: true,
      reactionLookback: 24,
      reactionThreshold: 0.5,
      aiAggressiveness: 'low',
      aiConfidenceThreshold: 90,
      ai: {
        aggressiveness: 'low',
        confidenceThreshold: 90,
        signals: {
          parabolicSAR: { acceleration: 0.005, maximum: 0.05 },
          atr: { period: 50, multiplier: 5 },
          volume: { spikeThreshold: 5.0, lookback: 100 },
          roc: { period: 50, panicThreshold: 10.0 }
        }
      },
      grid: { defaultSpacing: 2.0 }
    };
  }
  
  private calculateImprovedScore(metrics: any): number {
    const weights = {
      totalReturn: 0.4,
      sharpeRatio: 0.3,
      maxDrawdown: -0.2,
      winRate: 0.1
    }
    const normalizedReturn = Math.max(0, Math.min(100, (metrics.totalReturnPct + 50) * 2))
    const normalizedSharpe = Math.max(0, Math.min(100, (metrics.sharpeRatio + 2) * 25))
    const normalizedDrawdown = Math.max(0, 100 - metrics.maxDrawdown)
    const normalizedWinRate = metrics.winRate
    const score = normalizedReturn * weights.totalReturn + normalizedSharpe * weights.sharpeRatio + normalizedDrawdown * weights.maxDrawdown + normalizedWinRate * weights.winRate
    return Math.round(score * 100) / 100
  }
  
  private async runSingleBacktest(config: HamburgerBotConfig, strategy: string): Promise<ImprovedBulkTestResult> {
    const engine = new FastBacktestEngine(config)
    try {
      await engine.loadData(config.symbol, this.startTime, this.endTime)
      const result = await engine.runBacktest()
      const score = this.calculateImprovedScore(result.metrics)
      return { config, metrics: result.metrics, trades: result.trades, score, strategy }
    } catch (error) {
      logger.error(`Backtest failed for config ${config.id}:`, error)
      return { config, metrics: { totalReturn: 0, totalReturnPct: 0, sharpeRatio: 0, maxDrawdown: 100, winRate: 0, profitFactor: 0, totalTrades: 0, totalFees: 0 }, trades: [], score: 0, strategy }
    }
  }
  
  async runImprovedBacktests(): Promise<ImprovedBulkTestResult[]> {
    logger.info('Starting improved strategy backtests...')
    this.results = []
    const strategies = [
      { name: 'Dynamic Grid', generator: (i: number) => this.createDynamicGridConfig(i) },
      { name: 'Trend Following', generator: (i: number) => this.createTrendFollowingConfig(i) },
      { name: 'Volatility Adjusted', generator: (i: number) => this.createVolatilityAdjustedConfig(i) },
      { name: 'Mean Reversion', generator: (i: number) => this.createMeanReversionConfig(i) },
      { name: 'Funding Arbitrage', generator: (i: number) => this.createFundingRateConfig(i) }
    ]
    for (const strategy of strategies) {
      for (let i = 0; i < 10; i++) {
        const result = await this.runSingleBacktest(strategy.generator(i), strategy.name)
        this.results.push(result)
      }
    }
    this.results.sort((a, b) => b.score - a.score)
    this.printImprovedSummary()
    return this.results
  }
  
  private printImprovedSummary(): void {
    logger.info('\n=== TOP 10 IMPROVED CONFIGURATIONS ===')
    for (let i = 0; i < Math.min(10, this.results.length); i++) {
      const result = this.results[i]
      if (!result) continue
      logger.info(`#${i + 1} - ${result.strategy} - Score: ${result.score} - Return: ${result.metrics.totalReturnPct.toFixed(2)}%`)
    }
    this.analyzeStrategyPerformance()
  }
  
  private analyzeStrategyPerformance(): void {
    const strategyGroups = this.results.reduce((groups, result) => {
      const strategy = result.strategy
      if (!groups[strategy]) groups[strategy] = []
      groups[strategy].push(result)
      return groups
    }, {} as Record<string, ImprovedBulkTestResult[]>)
    for (const [strategy, results] of Object.entries(strategyGroups)) {
      const avgReturn = results.reduce((sum, r) => sum + r.metrics.totalReturnPct, 0) / results.length
      const positiveCount = results.filter(r => r.metrics.totalReturnPct > 0).length
      logger.info(`\n${strategy}: Avg Return: ${avgReturn.toFixed(2)}%, Positive: ${positiveCount}/${results.length}`)
    }
  }
}

if (require.main === module) {
  const improvedBacktest = new ImprovedBulkBacktest()
  improvedBacktest.runImprovedBacktests()
    .then(() => { logger.info('\nImproved backtest completed!'); process.exit(0); })
    .catch((error) => { logger.error('Improved backtest failed:', error); process.exit(1); })
}

export { ImprovedBulkBacktest, ImprovedBulkTestResult }
