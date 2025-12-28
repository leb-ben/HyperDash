/**
 * Grid Backtesting Interface for Blackbox
 * Provides clean separation of strategy logic for backtesting validation
 */

import type { 
  HamburgerBotConfig, 
  GridPosition, 
  VirtualLevel, 
  GridSignals, 
  AIDecision, 
  GridAction 
} from '../types/grid.js'
import type { OHLCV } from '../types/index.js'
import { logger } from '../utils/logger.js'

// Historical data interface for backtesting
export interface HistoricalData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  funding_rate?: number
}

// Market snapshot for backtesting
export interface MarketSnapshot {
  timestamp: number
  price: number
  volume_24h: number
  volatility: number
  trend_strength: number
}

// Backtest configuration
export interface BacktestConfig {
  symbol: string
  startDate: string
  endDate: string
  initialCapital: number
  commission: number // Always assume taker fees (0.05%)
  slippage: number // 0.01-0.05% based on volatility
  fundingRate: number
}

// Backtest result
export interface BacktestResult {
  config: BacktestConfig
  strategy: HamburgerBotConfig
  performance: PerformanceMetrics
  trades: BacktestTrade[]
  positions: GridPosition[]
  decisions: AIDecision[]
  equityCurve: EquityPoint[]
  dailyReturns: number[]
}

// Performance metrics
export interface PerformanceMetrics {
  totalReturn: number
  totalReturnPct: number
  sharpeRatio: number
  sortinoRatio: number
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

// Individual trade
export interface BacktestTrade {
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
  exitReason: 'stop_loss' | 'take_profit' | 'rebalance' | 'manual'
}

// Equity curve point
export interface EquityPoint {
  timestamp: number
  equity: number
  openPositions: number
  unrealizedPnl: number
  drawdown: number
}

// Grid state for backtesting
export interface BacktestGridState {
  config: HamburgerBotConfig
  realPositions: GridPosition[]
  virtualLevels: VirtualLevel[]
  currentPrice: number
  lastRebalance: number
  signals: GridSignals
  lastDecision: AIDecision | null
}

/**
 * Main backtesting interface
 */
export class GridBacktestInterface {
  private config: BacktestConfig
  private strategy: HamburgerBotConfig
  private data: HistoricalData[] = []
  private state: BacktestGridState
  private equity: number
  private trades: BacktestTrade[] = []
  private decisions: AIDecision[] = []
  private equityCurve: EquityPoint[] = []

  constructor(config: BacktestConfig, strategy: HamburgerBotConfig) {
    this.config = config
    this.strategy = strategy
    this.equity = config.initialCapital
    
    // Initialize state
    this.state = {
      config: strategy,
      realPositions: [],
      virtualLevels: [],
      currentPrice: 0,
      lastRebalance: 0,
      signals: this.getEmptySignals(),
      lastDecision: null
    }
  }

  /**
   * Load historical data
   */
  async loadData(symbol: string, startDate: string, endDate: string): Promise<void> {
    // This would fetch from Hyperliquid API or data provider
    // For Blackbox, this interface allows data injection
    throw new Error('Data loading to be implemented by Blackbox')
  }

  /**
   * Run backtest
   */
  async runBacktest(): Promise<BacktestResult> {
    if (this.data.length === 0) {
      throw new Error('No data loaded')
    }

    // Initialize
    await this.initialize()
    
    // Run through each candle
    for (let i = 0; i < this.data.length; i++) {
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

    return {
      config: this.config,
      strategy: this.strategy,
      performance,
      trades: this.trades,
      positions: this.state.realPositions,
      decisions: this.decisions,
      equityCurve: this.equityCurve,
      dailyReturns: this.calculateDailyReturns()
    }
  }

  /**
   * Initialize the backtest
   */
  private async initialize(): Promise<void> {
    if (this.data.length === 0) {
      throw new Error('No data available for initialization')
    }
    
    const firstCandle = this.data[0]
    if (!firstCandle) {
      throw new Error('First candle is undefined')
    }
    
    this.state.currentPrice = firstCandle.close
    
    // Generate virtual grid
    this.state.virtualLevels = this.generateVirtualGrid(firstCandle.close)
    
    // Create initial 2 positions
    await this.createInitialPositions(firstCandle.close)
    
    // Record initial equity point
    this.equityCurve.push({
      timestamp: firstCandle.timestamp,
      equity: this.equity,
      openPositions: this.state.realPositions.length,
      unrealizedPnl: this.calculateUnrealizedPnl(),
      drawdown: 0
    })
  }

  /**
   * Process a single candle
   */
  private async processCandle(candle: HistoricalData, index: number): Promise<void> {
    if (!candle) {
      throw new Error('Candle is undefined')
    }
    
    const previousPrice = this.state.currentPrice
    this.state.currentPrice = candle.close

    // Update signals
    this.state.signals = this.calculateSignals(index)

    // Check for virtual level crossings
    const crossedLevels = this.checkVirtualCrossings(candle.close)

    // Make AI decision
    const decision = await this.makeAIDecision(crossedLevels)
    this.state.lastDecision = decision
    this.decisions.push(decision)

    // Execute decision if confident enough
    if (decision.confidence >= this.strategy.aiConfidenceThreshold) {
      await this.executeDecision(decision, candle)
    }

    // Update position PnL
    this.updatePositionPnL(candle.close)

    // Check stop losses and take profits
    await this.checkStopOrders(candle)

    // Record equity curve
    if (index % 10 === 0) { // Record every 10 candles
      this.recordEquityPoint(candle.timestamp)
    }
  }

  /**
   * Generate virtual grid levels
   */
  private generateVirtualGrid(centerPrice: number): VirtualLevel[] {
    const levels: VirtualLevel[] = []
    const spacing = this.strategy.gridSpacing / 100

    // Generate 25 levels each side (infinite grid simulation)
    for (let i = 1; i <= 25; i++) {
      // Short positions above
      levels.push({
        id: `virtual_short_${i}`,
        price: centerPrice * Math.pow(1 + spacing, i),
        side: 'short',
        distanceFromCenter: i,
        isReal: false,
        status: 'pending',
        createdAt: Date.now()
      })

      // Long positions below
      levels.push({
        id: `virtual_long_${i}`,
        price: centerPrice * Math.pow(1 - spacing, i),
        side: 'long',
        distanceFromCenter: -i,
        isReal: false,
        status: 'pending',
        createdAt: Date.now()
      })
    }

    return levels.sort((a, b) => b.price - a.price)
  }

  /**
   * Create initial 2 positions
   */
  private async createInitialPositions(price: number): Promise<void> {
    const positionSize = this.config.initialCapital / 2
    const leverage = Math.min(this.strategy.leverage, this.getSymbolLeverageLimit(this.strategy.symbol))

    // Short position above
    const shortPrice = price * (1 + this.strategy.gridSpacing / 100)
    const shortPosition: GridPosition = {
      id: `pos_short_${Date.now()}`,
      symbol: this.strategy.symbol,
      side: 'short',
      size: (positionSize * leverage) / shortPrice,
      sizeUsd: positionSize,
      entryPrice: shortPrice,
      currentPrice: shortPrice,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      leverage,
      liquidationPrice: this.calculateLiquidationPrice(shortPrice, leverage, 'short'),
      marginUsed: positionSize,
      stopLoss: shortPrice * (1 + this.strategy.stopLossPct / 100),
      takeProfit: shortPrice * (1 - this.strategy.takeProfitPct / 100),
      entryTime: Date.now(),
      isReal: true
    }

    // Long position below
    const longPrice = price * (1 - this.strategy.gridSpacing / 100)
    const longPosition: GridPosition = {
      id: `pos_long_${Date.now()}`,
      symbol: this.strategy.symbol,
      side: 'long',
      size: (positionSize * leverage) / longPrice,
      sizeUsd: positionSize,
      entryPrice: longPrice,
      currentPrice: longPrice,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      leverage,
      liquidationPrice: this.calculateLiquidationPrice(longPrice, leverage, 'long'),
      marginUsed: positionSize,
      stopLoss: longPrice * (1 - this.strategy.stopLossPct / 100),
      takeProfit: longPrice * (1 + this.strategy.takeProfitPct / 100),
      entryTime: Date.now(),
      isReal: true
    }

    this.state.realPositions = [shortPosition, longPosition]
  }

  /**
   * Calculate signals (to be implemented by Blackbox with actual indicators)
   */
  private calculateSignals(index: number): GridSignals {
    // Placeholder - Blackbox will implement with actual Parabolic SAR, ATR, Volume, ROC
    return this.getEmptySignals()
  }

  /**
   * Make AI decision (to be implemented by Blackbox)
   */
  private async makeAIDecision(crossedLevels: VirtualLevel[]): Promise<AIDecision> {
    // Placeholder - Blackbox will implement actual AI decision logic
    return {
      action: 'hold' as GridAction,
      confidence: 50,
      reasoning: 'Backtest mode',
      signals: this.state.signals,
      timestamp: Date.now(),
      expectedOutcome: 'Holding position'
    }
  }

  /**
   * Execute decision
   */
  private async executeDecision(decision: AIDecision, candle: HistoricalData): Promise<void> {
    switch (decision.action) {
      case 'shift_up':
        await this.shiftUp(candle.close)
        break
      case 'shift_down':
        await this.shiftDown(candle.close)
        break
      case 'cluster_long':
        await this.clusterLong(candle.close)
        break
      case 'cluster_short':
        await this.clusterShort(candle.close)
        break
      case 'close_all':
        await this.closeAllPositions()
        break
      // 'hold' does nothing
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
    const shorts = this.state.realPositions.filter(p => p.side === 'short')
    for (const position of shorts) {
      await this.closePosition(position, 'rebalance')
    }

    // Open longs up to max positions
    while (this.state.realPositions.length < 4) {
      await this.openPositionBelow(price)
    }
  }

  /**
   * Cluster short positions
   */
  private async clusterShort(price: number): Promise<void> {
    // Close all longs
    const longs = this.state.realPositions.filter(p => p.side === 'long')
    for (const position of longs) {
      await this.closePosition(position, 'rebalance')
    }

    // Open shorts up to max positions
    while (this.state.realPositions.length < 4) {
      await this.openPositionAbove(price)
    }
  }

  /**
   * Helper methods
   */
  private getEmptySignals(): GridSignals {
    return {
      parabolicSAR: { value: 0, isUptrend: false },
      atr: { value: 0, multiplier: 0 },
      volume: { current: 0, average: 0, spikeMultiplier: 0, isSpike: false },
      roc: { value: 0, panicThreshold: 5, isPanic: false }
    }
  }

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

  private calculateLiquidationPrice(entryPrice: number, leverage: number, side: 'long' | 'short'): number {
    // Simplified liquidation price calculation
    const maintenanceMargin = 0.05 // 5%
    if (side === 'long') {
      return entryPrice * (1 - (1 / leverage) + maintenanceMargin)
    } else {
      return entryPrice * (1 + (1 / leverage) - maintenanceMargin)
    }
  }

  private checkVirtualCrossings(price: number): VirtualLevel[] {
    return this.state.virtualLevels.filter(level => {
      if (level.status !== 'pending') return false
      return (level.side === 'short' && price >= level.price) ||
             (level.side === 'long' && price <= level.price)
    })
  }

  private updatePositionPnL(price: number): void {
    for (const position of this.state.realPositions) {
      position.currentPrice = price
      
      if (position.side === 'long') {
        position.unrealizedPnl = (price - position.entryPrice) * position.size
        position.unrealizedPnlPct = ((price - position.entryPrice) / position.entryPrice) * 100
      } else {
        position.unrealizedPnl = (position.entryPrice - price) * position.size
        position.unrealizedPnlPct = ((position.entryPrice - price) / position.entryPrice) * 100
      }
    }
  }

  private async checkStopOrders(candle: HistoricalData): Promise<void> {
    for (const position of [...this.state.realPositions]) {
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

  private async closePosition(position: GridPosition, reason: 'stop_loss' | 'take_profit' | 'rebalance' | 'manual'): Promise<void> {
    const exitPrice = position.currentPrice
    const fees = position.sizeUsd * this.config.commission
    const slippage = position.sizeUsd * this.config.slippage
    
    let pnl = 0
    if (position.side === 'long') {
      pnl = (exitPrice - position.entryPrice) * position.size - fees - slippage
    } else {
      pnl = (position.entryPrice - exitPrice) * position.size - fees - slippage
    }

    // Record trade
    const trade: BacktestTrade = {
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
      funding: 0, // Would calculate based on hold time
      slippage,
      exitReason: reason
    }

    this.trades.push(trade)
    this.equity += pnl
    this.state.realPositions = this.state.realPositions.filter(p => p.id !== position.id)
  }

  private async openPositionAbove(price: number): Promise<void> {
    if (this.state.realPositions.length >= 4) return

    const spacing = this.strategy.gridSpacing / 100
    const entryPrice = price * (1 + spacing)
    const positionSize = this.config.initialCapital / this.state.realPositions.length
    const leverage = Math.min(this.strategy.leverage, this.getSymbolLeverageLimit(this.strategy.symbol))

    const position: GridPosition = {
      id: `pos_short_${Date.now()}`,
      symbol: this.strategy.symbol,
      side: 'short',
      size: (positionSize * leverage) / entryPrice,
      sizeUsd: positionSize,
      entryPrice,
      currentPrice: entryPrice,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      leverage,
      liquidationPrice: this.calculateLiquidationPrice(entryPrice, leverage, 'short'),
      marginUsed: positionSize,
      stopLoss: entryPrice * (1 + this.strategy.stopLossPct / 100),
      takeProfit: entryPrice * (1 - this.strategy.takeProfitPct / 100),
      entryTime: Date.now(),
      isReal: true
    }

    this.state.realPositions.push(position)
  }

  private async openPositionBelow(price: number): Promise<void> {
    if (this.state.realPositions.length >= 4) return

    const spacing = this.strategy.gridSpacing / 100
    const entryPrice = price * (1 - spacing)
    const positionSize = this.config.initialCapital / this.state.realPositions.length
    const leverage = Math.min(this.strategy.leverage, this.getSymbolLeverageLimit(this.strategy.symbol))

    const position: GridPosition = {
      id: `pos_long_${Date.now()}`,
      symbol: this.strategy.symbol,
      side: 'long',
      size: (positionSize * leverage) / entryPrice,
      sizeUsd: positionSize,
      entryPrice,
      currentPrice: entryPrice,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      leverage,
      liquidationPrice: this.calculateLiquidationPrice(entryPrice, leverage, 'long'),
      marginUsed: positionSize,
      stopLoss: entryPrice * (1 - this.strategy.stopLossPct / 100),
      takeProfit: entryPrice * (1 + this.strategy.takeProfitPct / 100),
      entryTime: Date.now(),
      isReal: true
    }

    this.state.realPositions.push(position)
  }

  private getTopPosition(): GridPosition | null {
    return this.state.realPositions.reduce((top, current) => 
      !top || current.entryPrice > top.entryPrice ? current : top
    , null as GridPosition | null)
  }

  private getBottomPosition(): GridPosition | null {
    return this.state.realPositions.reduce((bottom, current) => 
      !bottom || current.entryPrice < bottom.entryPrice ? current : bottom
    , null as GridPosition | null)
  }

  private calculateUnrealizedPnl(): number {
    return this.state.realPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0)
  }

  private recordEquityPoint(timestamp: number): void {
    const unrealizedPnl = this.calculateUnrealizedPnl()
    const drawdown = this.calculateDrawdown()
    
    this.equityCurve.push({
      timestamp,
      equity: this.equity,
      openPositions: this.state.realPositions.length,
      unrealizedPnl,
      drawdown
    })
  }

  private calculateDrawdown(): number {
    if (this.equityCurve.length === 0) return 0
    
    const peak = Math.max(...this.equityCurve.map(p => p.equity))
    return ((peak - this.equity) / peak) * 100
  }

  private async closeAllPositions(): Promise<void> {
    for (const position of [...this.state.realPositions]) {
      await this.closePosition(position, 'manual')
    }
  }

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

    return {
      totalReturn,
      totalReturnPct,
      sharpeRatio,
      sortinoRatio: 0, // Would calculate with downside deviation
      maxDrawdown: Math.max(...this.equityCurve.map(p => p.drawdown)),
      maxDrawdownPct: Math.max(...this.equityCurve.map(p => p.drawdown)),
      winRate: (winningTrades.length / this.trades.length) * 100,
      profitFactor,
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      avgWin: winningTrades.length > 0 ? wins / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? -losses / losingTrades.length : 0,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0,
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0,
      avgHoldTime: this.trades.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0) / this.trades.length,
      capitalEfficiency: (this.equity / this.config.initialCapital) * 100,
      totalFees: this.trades.reduce((sum, t) => sum + t.fees, 0),
      totalFundingCosts: this.trades.reduce((sum, t) => sum + t.funding, 0),
      totalSlippage: this.trades.reduce((sum, t) => sum + t.slippage, 0)
    }
  }

  private calculateDailyReturns(): number[] {
    // Group equity points by day and calculate daily returns
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

// Export for Blackbox
export { GridBacktestInterface as default }
