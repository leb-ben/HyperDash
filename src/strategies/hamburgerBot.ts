/**
 * Hamburger Bot - AI-driven grid trading with 2-4 dynamic real positions
 * Capital efficient alternative to traditional grid bots
 */

import { EventEmitter } from 'events'
import type { 
  GridState, 
  GridPosition, 
  VirtualLevel, 
  GridSignals, 
  AIDecision,
  HamburgerBotConfig,
  GridPerformance
} from '../types/grid.js'
import { GridAction } from '../types/grid.js'
import { VirtualGrid } from './virtualGrid'
import { GridPositionManager } from './gridPositionManager'
import { GridAIEngine } from '../core/gridAIEngine'
import { logger } from '../utils/logger.js'

export class HamburgerBot extends EventEmitter {
  private config: HamburgerBotConfig
  private state: GridState
  private virtualGrid: VirtualGrid
  private positionManager: GridPositionManager
  private aiEngine: GridAIEngine
  private isRunning: boolean = false
  private reactiveBias: 'long' | 'short' | 'neutral' = 'neutral'

  constructor(config: HamburgerBotConfig) {
    super()
    
    this.config = config
    this.virtualGrid = new VirtualGrid(config)
    this.positionManager = new GridPositionManager(config)
    this.aiEngine = new GridAIEngine(config)
    
    this.state = {
      config,
      realPositions: [],
      virtualLevels: [],
      currentPrice: 0,
      lastRebalance: 0,
      performance: this.initializePerformance(),
      isRunning: false
    }
  }

  /**
   * Initialize the bot - starts empty and waits for grid triggers
   */
  async initialize(currentPrice: number): Promise<void> {
    logger.info(`Initializing Hamburger Bot for ${this.config.symbol}`)
    
    this.state.currentPrice = currentPrice
    
    // Generate initial virtual grid
    this.state.virtualLevels = this.virtualGrid.generateGrid(currentPrice)
    
    // Bot starts empty (0 positions) - wait for grid triggers to open real positions
    this.state.realPositions = []
    
    logger.info(`Bot initialized - waiting for grid triggers`)
    this.emit('initialized', this.state)
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Hamburger Bot is already running')
      return
    }
    
    this.isRunning = true
    this.state.isRunning = true
    
    logger.info(`Starting Hamburger Bot for ${this.config.symbol}`)
    this.emit('started', this.state)
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Hamburger Bot is not running')
      return
    }
    
    this.isRunning = false
    this.state.isRunning = false
    
    // Close all positions
    await this.positionManager.closeAllPositions()
    this.state.realPositions = []
    
    logger.info(`Hamburger Bot stopped for ${this.config.symbol}`)
    this.emit('stopped', this.state)
  }

  /**
   * Process price update and make AI decisions
   */
  async onPriceUpdate(price: number, signals: GridSignals): Promise<void> {
    if (!this.isRunning) return
    
    this.state.currentPrice = price
    
    // 1. Check if price crossed any virtual levels and open real positions
    const crossedLevels = this.virtualGrid.checkCrossings(price, this.state.virtualLevels)
    
    // Update Reactive Bias if enabled
    if (this.config.useReactiveMode) {
      this.updateReactiveBias(price)
    }

    for (const level of crossedLevels) {
      // Volume Filter
      if (this.config.minVolumeMultiplier > 1.0) {
        const volumeMultiplier = signals.volume.spikeMultiplier
        if (volumeMultiplier < this.config.minVolumeMultiplier) {
          level.status = 'pending'
          continue
        }
      }

      // Trend Filter (Predictive or Reactive)
      if (this.config.useReactiveMode) {
        if (level.side === 'long' && this.reactiveBias !== 'long') {
          level.status = 'pending'
          continue
        }
        if (level.side === 'short' && this.reactiveBias !== 'short') {
          level.status = 'pending'
          continue
        }
      } else if (this.config.useTrendFilter) {
        const isUptrend = signals.parabolicSAR.isUptrend
        if (level.side === 'long' && !isUptrend) {
          level.status = 'pending'
          continue
        }
        if (level.side === 'short' && isUptrend) {
          level.status = 'pending'
          continue
        }
      }

      // Reversal Confirmation (simplified check for live bot)
      // In live trading, we might want to check the last closed candle on a specific timeframe
      // For now, we'll implement a basic price action check if enabled
      if (this.config.useReversalConfirmation) {
        // This is a simplified placeholder - in live it would need candle history
        // For now, we skip if enabled but we don't have enough data yet
        // A more robust implementation would check the last 1m candle
      }

      // Check maxActivePositions constraint
      const maxActive = this.config.maxActivePositions || 1
      if (this.state.realPositions.length >= maxActive) {
        logger.warn(`Max active positions (${maxActive}) reached. Skipping activation of ${level.id}`)
        level.status = 'pending'
        continue
      }
      
      if (this.state.realPositions.length < this.config.maxPositions) {
        const newPosition = level.side === 'short' 
          ? await this.positionManager.openPositionAbove(price, 0) // Already at level price
          : await this.positionManager.openPositionBelow(price, 0)
        
        if (newPosition) {
          newPosition.levelId = level.id
          this.state.realPositions.push(newPosition)
          logger.info(`Grid trigger: Opened ${level.side} position at ${price} for level ${level.id} - Active positions: ${this.state.realPositions.length}/${maxActive}`)
        }
      } else {
        // If we're at max positions, the level is still "crossed" but we can't open
        // We'll leave it as 'pending' so it can trigger later? 
        // No, checkCrossings already set it to 'filled'. 
        // Let's reset it to pending if we couldn't open.
        level.status = 'pending'
      }
    }
    
    // 2. Get AI decision for risk management
    if (crossedLevels.length > 0 || this.shouldRebalance(price, signals)) {
      const decision = await this.aiEngine.makeDecision(
        this.state,
        signals,
        crossedLevels
      )
      
      // Execute decision if confidence threshold met
      if (decision.confidence >= this.config.aiConfidenceThreshold) {
        await this.executeDecision(decision)
        this.state.lastRebalance = Date.now()
        
        logger.info(`AI Action: ${decision.action} with ${decision.confidence}% confidence`)
        this.emit('rebalanced', { state: this.state, decision })
      }
    }
    
    // 3. Update position PnL and check for exits (Stop Loss / Take Profit)
    // Note: hyperliquid handles SL/TP on-exchange, but we update local state
    this.updatePositionPnL(price)
    
    // Emit state update
    this.emit('updated', this.state)
  }

  /**
   * Update reactive bias based on raw price action
   */
  private updateReactiveBias(currentPrice: number): void {
    const lookback = this.config.reactionLookback || 10
    const threshold = this.config.reactionThreshold || 0.1
    
    // In live mode, we'd ideally use a price buffer or history
    // For now, we compare against the last known price in state
    const prevPrice = this.state.currentPrice
    
    if (prevPrice === 0) return

    const priceChange = ((currentPrice - prevPrice) / prevPrice) * 100

    if (priceChange >= threshold) {
      if (this.reactiveBias !== 'long') {
        logger.info(`Reactive Bias: Flipped to LONG (Price change: ${priceChange.toFixed(2)}%)`)
        this.reactiveBias = 'long'
      }
    } else if (priceChange <= -threshold) {
      if (this.reactiveBias !== 'short') {
        logger.info(`Reactive Bias: Flipped to SHORT (Price change: ${priceChange.toFixed(2)}%)`)
        this.reactiveBias = 'short'
      }
    }
  }

  /**
   * Execute AI decision
   */
  private async executeDecision(decision: AIDecision): Promise<void> {
    const signals = decision.signals
    let useEmergencyFund = false

    // Extreme conditions may use emergency fund
    if (signals.atr.multiplier > 3 || (signals.roc.isPanic && Math.abs(signals.roc.value) > signals.roc.panicThreshold * 2)) {
      useEmergencyFund = true
    }

    switch (decision.action) {
      case GridAction.CUT_LONG:
        await this.cutLong(useEmergencyFund)
        break
        
      case GridAction.CUT_SHORT:
        await this.cutShort(useEmergencyFund)
        break
        
      case GridAction.EMERGENCY_REBALANCE:
        await this.emergencyRebalance()
        break
        
      case GridAction.HOLD:
        // Do nothing
        break
        
      case GridAction.CLOSE_ALL:
        await this.closeAllPositions()
        break
        
      default:
        logger.warn(`Unknown action: ${decision.action}`)
    }
  }

  /**
   * Cut all long positions
   */
  private async cutLong(useEmergencyFund: boolean = false): Promise<void> {
    const longPositions = this.state.realPositions.filter(p => p.side === 'long')
    for (const position of longPositions) {
      if (useEmergencyFund) {
        logger.info(`Using emergency fund to mitigate long exit for ${position.id}`)
        // In a real bot, this might mean adjusting collateral or just logging the priority exit
      }
      await this.closePosition(position.id)
    }
    logger.info('AI Risk Manager: Cut all long positions')
  }

  /**
   * Cut all short positions
   */
  private async cutShort(useEmergencyFund: boolean = false): Promise<void> {
    const shortPositions = this.state.realPositions.filter(p => p.side === 'short')
    for (const position of shortPositions) {
      if (useEmergencyFund) {
        logger.info(`Using emergency fund to mitigate short exit for ${position.id}`)
      }
      await this.closePosition(position.id)
    }
    logger.info('AI Risk Manager: Cut all short positions')
  }

  /**
   * Close a specific position and update grid level status
   */
  private async closePosition(positionId: string): Promise<void> {
    const position = this.state.realPositions.find(p => p.id === positionId)
    if (!position) return

    await this.positionManager.closePosition(this.config.symbol) // manager closes by symbol for now
    
    // Set level to cooldown
    if (position.levelId) {
      const level = this.state.virtualLevels.find(l => l.id === position.levelId)
      if (level) {
        level.status = 'cooldown'
        level.lastClosedAt = Date.now()
      }
    }

    this.state.realPositions = this.state.realPositions.filter(p => p.id !== positionId)
  }

  /**
   * Emergency rebalance - close all and restart with 2 neutral positions
   */
  private async emergencyRebalance(): Promise<void> {
    logger.warn('AI Risk Manager: EMERGENCY REBALANCE triggered')
    await this.closeAllPositions()
    
    // Reset all levels
    this.state.virtualLevels = this.virtualGrid.generateGrid(this.state.currentPrice)
    
    await this.initialize(this.state.currentPrice)
  }

  /**
   * Close all positions
   */
  private async closeAllPositions(): Promise<void> {
    await this.positionManager.closeAllPositions()
    
    // Reset levels that had active positions
    for (const position of this.state.realPositions) {
      if (position.levelId) {
        const level = this.state.virtualLevels.find(l => l.id === position.levelId)
        if (level) {
          level.status = 'cooldown'
          level.lastClosedAt = Date.now()
        }
      }
    }
    
    this.state.realPositions = []
  }

  /**
   * Check if rebalancing is needed
   */
  private shouldRebalance(price: number, signals: GridSignals): boolean {
    // Check if price moved beyond rebalance threshold
    const priceMove = Math.abs(price - this.state.currentPrice) / this.state.currentPrice
    if (priceMove > this.config.rebalanceThresholdPct / 100) {
      return true
    }
    
    // Check for panic signals
    if (signals.roc.isPanic || signals.volume.isSpike) {
      return true
    }
    
    // Check if outer positions are too far from price
    const outerPositions = this.positionManager.getOuterPositions(this.state.realPositions)
    for (const position of outerPositions) {
      const distance = Math.abs(position.entryPrice - price) / price
      if (distance > this.config.gridSpacing * 3) {
        return true
      }
    }
    
    return false
  }

  /**
   * Update position PnL based on current price and check for local liquidation risk
   */
  private updatePositionPnL(price: number): void {
    for (const position of this.state.realPositions) {
      position.currentPrice = price

      // Update highest/lowest price for trailing stops
      if (position.side === 'long') {
        if (price > (position.highestPrice || 0)) {
          position.highestPrice = price

          // Update trailing stop if enabled
          if (this.config.useTrailingStop) {
            const trailingStopPrice = price * (1 - this.config.stopLossPct / 100)
            if (trailingStopPrice > position.stopLoss) {
              position.stopLoss = trailingStopPrice
              logger.info(`Trailing stop updated for ${position.id}: ${position.stopLoss.toFixed(2)}`)
            }
          }
        }
      } else {
        if (price < (position.lowestPrice || Infinity)) {
          position.lowestPrice = price

          // Update trailing stop if enabled
          if (this.config.useTrailingStop) {
            const trailingStopPrice = price * (1 + this.config.stopLossPct / 100)
            if (trailingStopPrice < position.stopLoss) {
              position.stopLoss = trailingStopPrice
              logger.info(`Trailing stop updated for ${position.id}: ${position.stopLoss.toFixed(2)}`)
            }
          }
        }
      }

      if (position.side === 'long') {
        position.unrealizedPnl = (price - position.entryPrice) * position.size
        position.unrealizedPnlPct = ((price - position.entryPrice) / position.entryPrice) * 100
      } else {
        position.unrealizedPnl = (position.entryPrice - price) * position.size
        position.unrealizedPnlPct = ((position.entryPrice - price) / position.entryPrice) * 100
      }

      // 1. Check for Stop Loss / Trailing Stop
      const isStopHit = position.side === 'long' 
        ? price <= position.stopLoss 
        : price >= position.stopLoss
      
      if (isStopHit) {
        logger.warn(`${this.config.useTrailingStop ? 'Trailing stop' : 'Stop loss'} hit for ${position.side} position at ${price}.`)
        this.closePosition(position.id)
        continue
      }

      // 2. Check for Take Profit
      const isTpHit = position.side === 'long'
        ? price >= position.takeProfit
        : price <= position.takeProfit
      
      if (isTpHit) {
        logger.info(`Take profit hit for ${position.side} position at ${price}.`)
        this.closePosition(position.id)
        continue
      }

      // 3. Local liquidation check (90% margin loss)
      const isLiquidated = position.unrealizedPnlPct <= -90 / position.leverage
      if (isLiquidated) {
        logger.warn(`Local liquidation risk detected for ${position.side} position at ${price}. Triggering immediate close.`)
        this.closePosition(position.id)
      }
    }
  }

  /**
   * Initialize performance tracking
   */
  private initializePerformance(): GridPerformance {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnl: 0,
      totalFees: 0,
      capitalEfficiency: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      avgHoldTime: 0,
      positions: {
        long: 0,
        short: 0
      }
    }
  }

  /**
   * Get current state
   */
  getState(): GridState {
    return { ...this.state }
  }

  /**
   * Get current positions
   */
  getPositions(): GridPosition[] {
    return [...this.state.realPositions]
  }

  /**
   * Get performance metrics
   */
  getPerformance(): GridPerformance {
    return { ...this.state.performance }
  }
}
