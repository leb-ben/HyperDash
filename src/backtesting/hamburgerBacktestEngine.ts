/**
 * Hamburger Bot Backtesting Engine
 * Complete backtesting implementation for the Hamburger Bot strategy
 */

import type { 
  GridPosition, 
  VirtualLevel, 
  GridSignals, 
  AIDecision, 
  GridAction,
  HamburgerBotConfig 
} from '../types/grid.js'
import type { OHLCV } from '../types/index.js'
import { ParabolicSAR } from '../indicators/parabolicSAR.js'
import { ATR } from '../indicators/atr.js'
import { VolumeSpike } from '../indicators/volumeSpike.js'
import { ROC } from '../indicators/roc.js'
import { logger } from '../utils/logger.js'
import { GridAction as GridActionEnum } from '../types/grid.js'

// Historical data interface
export interface HistoricalData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  funding_rate?: number
}

// Backtest configuration
export interface BacktestConfig {
  symbol: string
  startDate: string
  endDate: string
  initialCapital: number
  commission: number // 0.05% for taker fees
  slippage: number // 0.01-0.05% based on volatility
  fundingRate: number
}

// Position state for backtesting
export interface BacktestPosition {
  id: string
  symbol: string
  side: 'long' | 'short'
  size: number
  sizeUsd: number
  entryPrice: number
  entryTime: number
  leverage: number
  stopLoss: number
  takeProfit: number
}

// Trade record
export interface TradeRecord {
  id: string
  symbol: string
  side: 'long' | 'short'
  entryTime: number
  exitTime: number
  entryPrice: number
  exitPrice: number
  size: number
  sizeUsd: number
  leverage: number
  pnl: number
  pnlPct: number
  fees: number
  funding: number
  slippage: number
  exitReason: 'stop_loss' | 'take_profit' | 'rebalance' | 'end_of_test'
}

// Performance metrics
export interface PerformanceMetrics {
  totalReturn: number
  totalReturnPct: number
  sharpeRatio: number
  maxDrawdown: number
  maxDrawdownPct: number
  winRate: number
  profitFactor: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  avgWin: number
  avgLoss: number
  largestWin: number
  largestLoss: number
  avgHoldTime: number
  capitalEfficiency: number
  totalFees: number
  totalFundingCosts: number
  totalSlippage: number
}

// Backtest result
export interface BacktestResult {
  config: BacktestConfig
  strategy: HamburgerBotConfig
  performance: PerformanceMetrics
  trades: TradeRecord[]
  positions: BacktestPosition[]
  decisions: AIDecision[]
  equityCurve: EquityPoint[]
  dailyReturns: number[]
}

// Equity curve point
export interface EquityPoint {
  timestamp: number
  equity: number
  openPositions: number
  unrealizedPnl: number
  drawdown: number
}

/**
 * Main backtesting engine
 */
export class HamburgerBacktestEngine {
  private config: BacktestConfig
  private strategy: HamburgerBotConfig
  private data: HistoricalData[] = []
  private positions: BacktestPosition[] = []
  private trades: TradeRecord[] = []
  private decisions: AIDecision[] = []
  private equityCurve: EquityPoint[] = []
  private equity: number
  private peakEquity: number = 0
  
  // Indicators
  private parabolicSAR: ParabolicSAR
  private atr: ATR
  private volumeSpike: VolumeSpike
  private roc: ROC
  
  // Virtual grid levels
  private virtualLevels: VirtualLevel[] = []
  
  constructor(config: BacktestConfig, strategy: HamburgerBotConfig) {
    this.config = config
    this.strategy = strategy
    this.equity = config.initialCapital
    
    // Initialize indicators
    this.parabolicSAR = new ParabolicSAR(
      this.strategy.ai?.signals?.parabolicSAR?.acceleration || 0.02,
      this.strategy.ai?.signals?.parabolicSAR?.maximum || 0.2
    )
    
    this.atr = new ATR(
      this.strategy.ai?.signals?.atr?.period || 14
    )
    
    this.volumeSpike = new VolumeSpike(
      this.strategy.ai?.signals?.volume?.lookback || 20,
      this.strategy.ai?.signals?.volume?.spikeThreshold || 2.0
    )
    
    this.roc = new ROC(
      this.strategy.ai?.signals?.roc?.period || 10,
      this.strategy.ai?.signals?.roc?.panicThreshold || 5.0
    )
  }

  /**
   * Load historical data
   */
  async loadData(data: HistoricalData[]): Promise<void> {
    this.data = data.sort((a, b) => a.timestamp - b.timestamp)
    logger.info(`Loaded ${this.data.length} data points for ${this.config.symbol}`)
  }

  /**
   * Run the backtest
   */
  async runBacktest(): Promise<BacktestResult> {
    if (this.data.length === 0) {
      throw new Error('No data loaded')
    }

    logger.info('Starting backtest...')
    
    // Initialize
    await this.initialize()
    
    // Process each candle
    for (let i = 50; i < this.data.length; i++) { // Start after indicator warmup
      const candle = this.data[i]
      if (!candle) {
        logger.warn(`Skipping undefined candle at index ${i}`)
        continue
      }
      await this.processCandle(candle, i)
    }
    
    // Close all positions at the end
    await this.closeAllPositions()
    
    // Calculate performance
    const performance = this.calculatePerformance()
    
    logger.info('Backtest completed')
    
    return {
      config: this.config,
      strategy: this.strategy,
      performance,
      trades: this.trades,
      positions: this.positions,
      decisions: this.decisions,
      equityCurve: this.equityCurve,
      dailyReturns: this.calculateDailyReturns()
    }
  }

  /**
   * Initialize the backtest
   */
  private async initialize(): Promise<void> {
    const firstCandle = this.data[50] // After warmup
    if (!firstCandle) throw new Error('Insufficient data for initialization')
    
    // Generate virtual grid
    this.generateVirtualGrid(firstCandle.close)
    
    // Create initial 2 positions
    await this.createInitialPositions(firstCandle.close)
    
    // Record initial equity point
    this.recordEquityPoint(firstCandle.timestamp)
  }

  /**
   * Generate virtual grid levels
   */
  private generateVirtualGrid(centerPrice: number): void {
    this.virtualLevels = []
    const spacing = this.strategy.gridSpacing / 100
    
    // Generate 25 levels each side (infinite grid simulation)
    for (let i = 1; i <= 25; i++) {
      // Short positions above
      this.virtualLevels.push({
        id: `virtual_short_${i}`,
        price: centerPrice * Math.pow(1 + spacing, i),
        side: 'short',
        distanceFromCenter: i,
        isReal: false,
        status: 'pending',
        createdAt: Date.now()
      })

      // Long positions below
      this.virtualLevels.push({
        id: `virtual_long_${i}`,
        price: centerPrice * Math.pow(1 - spacing, i),
        side: 'long',
        distanceFromCenter: -i,
        isReal: false,
        status: 'pending',
        createdAt: Date.now()
      })
    }
    
    this.virtualLevels.sort((a, b) => b.price - a.price)
  }

  /**
   * Create initial 2 positions
   */
  private async createInitialPositions(price: number): Promise<void> {
    const positionSize = this.config.initialCapital / 2
    const leverage = Math.min(this.strategy.leverage, this.getSymbolLeverageLimit(this.strategy.symbol))
    
    // Short position above
    const shortPrice = price * (1 + this.strategy.gridSpacing / 100)
    const shortPosition: BacktestPosition = {
      id: `pos_short_${Date.now()}`,
      symbol: this.strategy.symbol,
      side: 'short',
      size: (positionSize * leverage) / shortPrice,
      sizeUsd: positionSize,
      entryPrice: shortPrice,
      entryTime: Date.now(),
      leverage,
      stopLoss: shortPrice * (1 + this.strategy.stopLossPct / 100),
      takeProfit: shortPrice * (1 - this.strategy.takeProfitPct / 100)
    }
    
    // Long position below
    const longPrice = price * (1 - this.strategy.gridSpacing / 100)
    const longPosition: BacktestPosition = {
      id: `pos_long_${Date.now()}`,
      symbol: this.strategy.symbol,
      side: 'long',
      size: (positionSize * leverage) / longPrice,
      sizeUsd: positionSize,
      entryPrice: longPrice,
      entryTime: Date.now(),
      leverage,
      stopLoss: longPrice * (1 - this.strategy.stopLossPct / 100),
      takeProfit: longPrice * (1 + this.strategy.takeProfitPct / 100)
    }
    
    this.positions = [shortPosition, longPosition]
  }

  /**
   * Process a single candle
   */
  private async processCandle(candle: HistoricalData, index: number): Promise<void> {
    // Get signals
    const signals = this.calculateSignals(index)
    
    // Check for virtual level crossings
    const crossedLevels = this.checkVirtualCrossings(candle.close)
    
    // Make AI decision
    const decision = this.makeAIDecision(signals, crossedLevels)
    this.decisions.push(decision)
    
    // Execute decision if confident enough
    if (decision.confidence >= (this.strategy.aiConfidenceThreshold || 70)) {
      await this.executeDecision(decision, candle)
    }
    
    // Update position PnL
    this.updatePositionPnL(candle.close)
    
    // Check stop losses and take profits
    await this.checkStopOrders(candle)
    
    // Record equity curve every 10 candles
    if (index % 10 === 0) {
      this.recordEquityPoint(candle.timestamp)
    }
  }

  /**
   * Calculate signals from indicators
   */
  private calculateSignals(index: number): GridSignals {
    const candles = this.data.slice(Math.max(0, index - 100), index + 1)
    const ohlcv: OHLCV[] = candles.map(c => ({
      timestamp: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }))
    
    // Parabolic SAR
    const sarResult = this.parabolicSAR.getLatest(ohlcv)
    
    // ATR
    const atrResult = this.atr.getLatest(ohlcv)
    const atrPercentage = atrResult ? (atrResult / candles[candles.length - 1].close) * 100 : 0
    
    // Volume
    const volumeResult = this.volumeSpike.getLatest(ohlcv)
    
    // ROC
    const rocResult = this.roc.getLatest(ohlcv)
    
    return {
      parabolicSAR: {
        value: sarResult?.value || 0,
        isUptrend: sarResult?.isUptrend || false
      },
      atr: {
        value: atrResult || 0,
        multiplier: atrPercentage
      },
      volume: {
        current: volumeResult?.current || 0,
        average: volumeResult?.average || 0,
        spikeMultiplier: volumeResult?.spikeMultiplier || 0,
        isSpike: volumeResult?.isSpike || false
      },
      roc: {
        value: rocResult?.percentage || 0,
        panicThreshold: this.strategy.ai?.signals?.roc?.panicThreshold || 5.0,
        isPanic: rocResult?.isPanic || false
      }
    }
  }

  /**
   * Make AI decision based on signals
   */
  private makeAIDecision(signals: GridSignals, crossedLevels: VirtualLevel[]): AIDecision {
    let action: GridAction = GridActionEnum.HOLD
    let confidence = 50
    let reasoning = ''
    
    // 1. ROC panic trigger
    if (signals.roc.isPanic) {
      if (signals.roc.value < 0) {
        action = GridActionEnum.CLUSTER_LONG
        reasoning = `Panic down (ROC: ${signals.roc.value.toFixed(2)}%)`
      } else {
        action = GridActionEnum.CLUSTER_SHORT
        reasoning = `Panic up (ROC: ${signals.roc.value.toFixed(2)}%)`
      }
      confidence = 90
    }
    // 2. Volume spike
    else if (signals.volume.isSpike) {
      if (signals.parabolicSAR.isUptrend) {
        action = GridActionEnum.CLUSTER_SHORT
        reasoning = `Volume spike (${signals.volume.spikeMultiplier.toFixed(1)}x) in uptrend`
      } else {
        action = GridActionEnum.CLUSTER_LONG
        reasoning = `Volume spike (${signals.volume.spikeMultiplier.toFixed(1)}x) in downtrend`
      }
      confidence = 75
    }
    // 3. Virtual level crossings
    else if (crossedLevels.length > 0) {
      const crossedShort = crossedLevels.filter(l => l.side === 'short').length
      const crossedLong = crossedLevels.filter(l => l.side === 'long').length
      
      if (crossedShort > crossedLong) {
        action = GridActionEnum.SHIFT_UP
        reasoning = `${crossedShort} short levels crossed`
      } else if (crossedLong > crossedShort) {
        action = GridActionEnum.SHIFT_DOWN
        reasoning = `${crossedLong} long levels crossed`
      }
      confidence = 65
    }
    // 4. SAR trend
    else if (signals.parabolicSAR.isUptrend && this.getPositionBias() < 40) {
      action = GridActionEnum.CLUSTER_SHORT
      reasoning = 'SAR uptrend with low short bias'
    } else if (!signals.parabolicSAR.isUptrend && this.getPositionBias() < 40) {
      action = GridActionEnum.CLUSTER_LONG
      reasoning = 'SAR downtrend with low long bias'
    }
    
    // Adjust confidence based on aggressiveness
    const aggressivenessMultiplier = {
      'low': 0.8,
      'medium': 1.0,
      'high': 1.2
    }[this.strategy.aiAggressiveness] || 1.0
    
    confidence = Math.min(Math.round(confidence * aggressivenessMultiplier), 100)
    
    return {
      action,
      confidence,
      reasoning,
      signals,
      timestamp: Date.now(),
      expectedOutcome: this.predictOutcome(action)
    }
  }

  /**
   * Execute AI decision
   */
  private async executeDecision(decision: AIDecision, candle: HistoricalData): Promise<void> {
    switch (decision.action) {
      case GridActionEnum.SHIFT_UP:
        await this.shiftUp(candle.close)
        break
      case GridActionEnum.SHIFT_DOWN:
        await this.shiftDown(candle.close)
        break
      case GridActionEnum.CLUSTER_LONG:
        await this.clusterLong(candle.close)
        break
      case GridActionEnum.CLUSTER_SHORT:
        await this.clusterShort(candle.close)
        break
      case GridActionEnum.CLOSE_ALL:
        await this.closeAllPositions()
        break
      // GridActionEnum.HOLD does nothing
    }
  }

  /**
   * Shift grid up
   */
  private async shiftUp(price: number): Promise<void> {
    const bottomPosition = this.getBottomPosition()
    if (bottomPosition) {
      await this.closePosition(bottomPosition, 'rebalance')
      await this.openPositionAbove(price)
    }
  }

  /**
   * Shift grid down
   */
  private async shiftDown(price: number): Promise<void> {
    const topPosition = this.getTopPosition()
    if (topPosition) {
      await this.closePosition(topPosition, 'rebalance')
      await this.openPositionBelow(price)
    }
  }

  /**
   * Cluster long positions
   */
  private async clusterLong(price: number): Promise<void> {
    // Close all shorts
    const shorts = this.positions.filter(p => p.side === 'short')
    for (const position of shorts) {
      await this.closePosition(position, 'rebalance')
    }
    
    // Open longs up to max positions
    while (this.positions.length < 4) {
      await this.openPositionBelow(price)
    }
  }

  /**
   * Cluster short positions
   */
  private async clusterShort(price: number): Promise<void> {
    // Close all longs
    const longs = this.positions.filter(p => p.side === 'long')
    for (const position of longs) {
      await this.closePosition(position, 'rebalance')
    }
    
    // Open shorts up to max positions
    while (this.positions.length < 4) {
      await this.openPositionAbove(price)
    }
  }

  /**
   * Open position above current price
   */
  private async openPositionAbove(price: number): Promise<void> {
    if (this.positions.length >= 4) return
    
    const spacing = this.strategy.gridSpacing / 100
    const entryPrice = price * (1 + spacing)
    const positionSize = this.config.initialCapital / this.positions.length
    const leverage = Math.min(this.strategy.leverage, this.getSymbolLeverageLimit(this.strategy.symbol))
    
    const position: BacktestPosition = {
      id: `pos_short_${Date.now()}`,
      symbol: this.strategy.symbol,
      side: 'short',
      size: (positionSize * leverage) / entryPrice,
      sizeUsd: positionSize,
      entryPrice,
      entryTime: Date.now(),
      leverage,
      stopLoss: entryPrice * (1 + this.strategy.stopLossPct / 100),
      takeProfit: entryPrice * (1 - this.strategy.takeProfitPct / 100)
    }
    
    this.positions.push(position)
  }

  /**
   * Open position below current price
   */
  private async openPositionBelow(price: number): Promise<void> {
    if (this.positions.length >= 4) return
    
    const spacing = this.strategy.gridSpacing / 100
    const entryPrice = price * (1 - spacing)
    const positionSize = this.config.initialCapital / this.positions.length
    const leverage = Math.min(this.strategy.leverage, this.getSymbolLeverageLimit(this.strategy.symbol))
    
    const position: BacktestPosition = {
      id: `pos_long_${Date.now()}`,
      symbol: this.strategy.symbol,
      side: 'long',
      size: (positionSize * leverage) / entryPrice,
      sizeUsd: positionSize,
      entryPrice,
      entryTime: Date.now(),
      leverage,
      stopLoss: entryPrice * (1 - this.strategy.stopLossPct / 100),
      takeProfit: entryPrice * (1 + this.strategy.takeProfitPct / 100)
    }
    
    this.positions.push(position)
  }

  /**
   * Close position
   */
  private async closePosition(position: BacktestPosition, reason: 'stop_loss' | 'take_profit' | 'rebalance' | 'end_of_test'): Promise<void> {
    const exitPrice = position.side === 'long' ? position.stopLoss : position.stopLoss // Simplified
    const fees = position.sizeUsd * this.config.commission
    const slippage = position.sizeUsd * this.config.slippage
    
    let pnl = 0
    if (position.side === 'long') {
      pnl = (exitPrice - position.entryPrice) * position.size - fees - slippage
    } else {
      pnl = (position.entryPrice - exitPrice) * position.size - fees - slippage
    }
    
    const trade: TradeRecord = {
      id: position.id,
      symbol: position.symbol,
      side: position.side,
      entryTime: position.entryTime,
      exitTime: Date.now(),
      entryPrice: position.entryPrice,
      exitPrice,
      size: position.size,
      sizeUsd: position.sizeUsd,
      leverage: position.leverage,
      pnl,
      pnlPct: (pnl / position.sizeUsd) * 100,
      fees,
      funding: 0,
      slippage,
      exitReason: reason
    }
    
    this.trades.push(trade)
    this.equity += pnl
    this.positions = this.positions.filter(p => p.id !== position.id)
  }

  /**
   * Close all positions
   */
  private async closeAllPositions(): Promise<void> {
    for (const position of [...this.positions]) {
      await this.closePosition(position, 'end_of_test')
    }
  }

  /**
   * Update position PnL
   */
  private updatePositionPnL(price: number): void {
    // Unrealized PnL is calculated when recording equity
  }

  /**
   * Check stop orders
   */
  private async checkStopOrders(candle: HistoricalData): Promise<void> {
    for (const position of [...this.positions]) {
      let shouldClose = false
      let reason: 'stop_loss' | 'take_profit' = 'stop_loss'
      
      if (position.side === 'long') {
        if (candle.low <= position.stopLoss) {
          shouldClose = true
          reason = 'stop_loss'
        } else if (candle.high >= position.takeProfit) {
          shouldClose = true
          reason = 'take_profit'
        }
      } else {
        if (candle.high >= position.stopLoss) {
          shouldClose = true
          reason = 'stop_loss'
        } else if (candle.low <= position.takeProfit) {
          shouldClose = true
          reason = 'take_profit'
        }
      }
      
      if (shouldClose) {
        await this.closePosition(position, reason)
      }
    }
  }

  /**
   * Check virtual level crossings
   */
  private checkVirtualCrossings(price: number): VirtualLevel[] {
    return this.virtualLevels.filter(level => {
      if (level.status !== 'pending') return false
      return (level.side === 'short' && price >= level.price) ||
             (level.side === 'long' && price <= level.price)
    })
  }

  /**
   * Record equity point
   */
  private recordEquityPoint(timestamp: number): void {
    const unrealizedPnl = this.calculateUnrealizedPnl()
    const totalEquity = this.equity + unrealizedPnl
    
    // Update peak equity for drawdown calculation
    if (totalEquity > this.peakEquity) {
      this.peakEquity = totalEquity
    }
    
    const drawdown = this.peakEquity > 0 ? ((this.peakEquity - totalEquity) / this.peakEquity) * 100 : 0
    
    this.equityCurve.push({
      timestamp,
      equity: totalEquity,
      openPositions: this.positions.length,
      unrealizedPnl,
      drawdown
    })
  }

  /**
   * Calculate unrealized PnL
   */
  private calculateUnrealizedPnl(): number {
    // Simplified - would use current price
    return 0
  }

  /**
   * Get position bias
   */
  private getPositionBias(): number {
    const longs = this.positions.filter(p => p.side === 'long').length
    const shorts = this.positions.filter(p => p.side === 'short').length
    return this.positions.length > 0 ? Math.abs(longs - shorts) / this.positions.length * 100 : 0
  }

  /**
   * Get top position
   */
  private getTopPosition(): BacktestPosition | null {
    return this.positions.reduce((top, current) => 
      !top || current.entryPrice > top.entryPrice ? current : top
    , null as BacktestPosition | null)
  }

  /**
   * Get bottom position
   */
  private getBottomPosition(): BacktestPosition | null {
    return this.positions.reduce((bottom, current) => 
      !bottom || current.entryPrice < bottom.entryPrice ? current : bottom
    , null as BacktestPosition | null)
  }

  /**
   * Get symbol leverage limit
   */
  private getSymbolLeverageLimit(symbol: string): number {
    const limits: Record<string, number> = {
      'BTC': 40, 'ETH': 40, 'SOL': 40, 'XRP': 40,
      'DOGE': 20, 'SUI': 20, 'WLD': 20, 'LTC': 20,
      'LINK': 20, 'AVAX': 20, 'HYPE': 20, 'TIA': 20,
      'APT': 20, 'NEAR': 20,
      'OP': 10, 'ARB': 10, 'LDO': 10, 'TON': 10,
      'JUP': 10, 'SEI': 10, 'BNB': 10, 'DOT': 10,
      'USDC': 3, 'USDT': 3
    }
    return limits[symbol.toUpperCase()] || 3
  }

  /**
   * Predict outcome
   */
  private predictOutcome(action: GridAction): string {
    switch (action) {
      case GridActionEnum.CLUSTER_LONG:
        return 'Expecting continued downward movement'
      case GridActionEnum.CLUSTER_SHORT:
        return 'Expecting continued upward movement'
      case GridActionEnum.SHIFT_UP:
        return 'Adjusting grid upward to follow price'
      case GridActionEnum.SHIFT_DOWN:
        return 'Adjusting grid downward to follow price'
      case GridActionEnum.HOLD:
        return 'Market conditions unclear, maintaining positions'
      case GridActionEnum.CLOSE_ALL:
        return 'Executing risk management'
      default:
        return 'Unknown action'
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformance(): PerformanceMetrics {
    const winningTrades = this.trades.filter(t => t.pnl > 0)
    const losingTrades = this.trades.filter(t => t.pnl < 0)
    
    const totalReturn = this.equity - this.config.initialCapital
    const totalReturnPct = (totalReturn / this.config.initialCapital) * 100
    
    const wins = winningTrades.reduce((sum, t) => sum + t.pnl, 0)
    const losses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0))
    const profitFactor = losses > 0 ? wins / losses : 0
    
    const dailyReturns = this.calculateDailyReturns()
    const avgDailyReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length
    const stdDev = Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length)
    const sharpeRatio = stdDev > 0 ? (avgDailyReturn / stdDev) * Math.sqrt(365) : 0
    
    const maxDrawdown = Math.max(...this.equityCurve.map(p => p.drawdown))
    
    return {
      totalReturn,
      totalReturnPct,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPct: maxDrawdown,
      winRate: this.trades.length > 0 ? (winningTrades.length / this.trades.length) * 100 : 0,
      profitFactor,
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      avgWin: winningTrades.length > 0 ? wins / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? -losses / losingTrades.length : 0,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0,
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0,
      avgHoldTime: this.trades.length > 0 ? 
        this.trades.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0) / this.trades.length : 0,
      capitalEfficiency: (this.equity / this.config.initialCapital) * 100,
      totalFees: this.trades.reduce((sum, t) => sum + t.fees, 0),
      totalFundingCosts: this.trades.reduce((sum, t) => sum + t.funding, 0),
      totalSlippage: this.trades.reduce((sum, t) => sum + t.slippage, 0)
    }
  }

  /**
   * Calculate daily returns
   */
  private calculateDailyReturns(): number[] {
    const dailyEquity: Map<string, number> = new Map()
    
    for (const point of this.equityCurve) {
      if (!point) continue
      const day = new Date(point.timestamp).toDateString()
      dailyEquity.set(day, point.equity)
    }
    
    const values = Array.from(dailyEquity.values())
    const returns: number[] = []
    
    for (let i = 1; i < values.length; i++) {
      const prevValue = values[i-1]
      const currValue = values[i]
      if (prevValue !== undefined && prevValue !== 0 && currValue !== undefined) {
        returns.push(((currValue - prevValue) / prevValue) * 100)
      }
    }
    
    return returns
  }
}

// Export for easy use
export default HamburgerBacktestEngine
