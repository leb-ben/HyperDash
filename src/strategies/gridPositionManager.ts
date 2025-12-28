/**
 * Grid Position Manager - Manages 2-4 real positions dynamically
 * Handles position creation, sizing, and risk management
 */

import type { GridPosition, HamburgerBotConfig } from '../types/grid.js'
import { exchange } from '../exchange/hyperliquid.js'
import { riskManager } from '../core/riskManager.js'
import { logger } from '../utils/logger.js'

export class GridPositionManager {
  private config: HamburgerBotConfig
  private positionCounter: number = 0

  constructor(config: HamburgerBotConfig) {
    this.config = config
  }

  /**
   * Create initial 2 positions (1 short above, 1 long below)
   */
  async createInitialPositions(currentPrice: number): Promise<GridPosition[]> {
    const positions: GridPosition[] = []
    
    // Calculate position size with 50% reserve
    const activeCapital = this.config.totalInvestmentUsd * 0.5
    const positionSizeUsd = Math.max(activeCapital / 2, 10) // Initial split into 2, min $10
    const leverage = Math.min(this.config.leverage, this.getSymbolLeverageLimit(this.config.symbol))
    
    // Create short position above price
    const shortPrice = currentPrice * (1 + this.config.gridSpacing / 100)
    const shortPosition = await this.createPosition('short', shortPrice, positionSizeUsd, leverage)
    if (shortPosition) {
      positions.push(shortPosition)
    }
    
    // Create long position below price
    const longPrice = currentPrice * (1 - this.config.gridSpacing / 100)
    const longPosition = await this.createPosition('long', longPrice, positionSizeUsd, leverage)
    if (longPosition) {
      positions.push(longPosition)
    }
    
    logger.info(`Created ${positions.length} initial positions with $${positionSizeUsd.toFixed(2)} each`)
    return positions
  }

  /**
   * Open a new position above current price
   */
  async openPositionAbove(currentPrice: number, spacing: number): Promise<GridPosition | null> {
    if (this.getCurrentPositionCount() >= this.config.maxPositions) {
      logger.warn('Maximum positions reached')
      return null
    }

    const price = currentPrice * (1 + spacing / 100)
    const positionSizeUsd = this.calculatePositionSize()
    const leverage = Math.min(this.config.leverage, this.getSymbolLeverageLimit(this.config.symbol))
    
    return await this.createPosition('short', price, positionSizeUsd, leverage)
  }

  /**
   * Open a new position below current price
   */
  async openPositionBelow(currentPrice: number, spacing: number): Promise<GridPosition | null> {
    if (this.getCurrentPositionCount() >= this.config.maxPositions) {
      logger.warn('Maximum positions reached')
      return null
    }

    const price = currentPrice * (1 - spacing / 100)
    const positionSizeUsd = this.calculatePositionSize()
    const leverage = Math.min(this.config.leverage, this.getSymbolLeverageLimit(this.config.symbol))
    
    return await this.createPosition('long', price, positionSizeUsd, leverage)
  }

  /**
   * Create a single position
   */
  private async createPosition(
    side: 'long' | 'short',
    price: number,
    sizeUsd: number,
    leverage: number
  ): Promise<GridPosition | null> {
    try {
      // Check risk limits
      // Using a simplified check for now, could be integrated with RiskManager.validateTrade
      if (sizeUsd < 10) {
        logger.warn(`Position size $${sizeUsd.toFixed(2)} below minimum $10`)
        return null
      }

      // Calculate position size
      const size = (sizeUsd * leverage) / price
      
      // Execute market order
      const order = await exchange.placeOrder(
        this.config.symbol,
        side === 'long' ? 'buy' : 'sell',
        size,
        'market',
        undefined,
        leverage
      )

      if (!order) {
        logger.error(`Failed to place ${side} order`)
        return null
      }

      // Calculate stop loss and take profit
      const stopLoss = side === 'long' 
        ? price * (1 - this.config.stopLossPct / 100)
        : price * (1 + this.config.stopLossPct / 100)
      
      const takeProfit = side === 'long'
        ? price * (1 + this.config.takeProfitPct / 100)
        : price * (1 - this.config.takeProfitPct / 100)

      // Place stop loss and take profit orders
      await exchange.setStopLoss(this.config.symbol, stopLoss)
      await exchange.setTakeProfit(this.config.symbol, takeProfit)

      // Create position object
      const position: GridPosition = {
        id: `pos_${++this.positionCounter}_${Date.now()}`,
        symbol: this.config.symbol,
        side,
        size,
        sizeUsd,
        entryPrice: order.filledPrice || price,
        currentPrice: order.filledPrice || price,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        leverage,
        liquidationPrice: 0, // Will be updated by exchange state
        marginUsed: sizeUsd,
        stopLoss,
        takeProfit,
        entryTime: Date.now(),
        isReal: true
      }

      logger.info(`Created ${side} position at ${position.entryPrice}`)
      return position

    } catch (error) {
      logger.error(`Error creating position: ${error}`)
      return null
    }
  }

  /**
   * Close a position
   */
  async closePosition(symbol: string): Promise<void> {
    try {
      await exchange.closePosition(symbol)
      logger.info(`Closed position for ${symbol}`)
    } catch (error) {
      logger.error(`Error closing position: ${error}`)
    }
  }

  /**
   * Close all positions
   */
  async closeAllPositions(): Promise<void> {
    const portfolio = await exchange.getRealWalletBalance()
    for (const position of portfolio.positions) {
      if (position.symbol === this.config.symbol) {
        await this.closePosition(position.symbol)
      }
    }
  }

  /**
   * Get the top position (highest price)
   */
  getTopPosition(positions: GridPosition[]): GridPosition | null {
    return positions.reduce((top, current) => 
      !top || current.entryPrice > top.entryPrice ? current : top
    , null as GridPosition | null)
  }

  /**
   * Get the bottom position (lowest price)
   */
  getBottomPosition(positions: GridPosition[]): GridPosition | null {
    return positions.reduce((bottom, current) => 
      !bottom || current.entryPrice < bottom.entryPrice ? current : bottom
    , null as GridPosition | null)
  }

  /**
   * Get outer positions (highest and lowest)
   */
  getOuterPositions(positions: GridPosition[]): GridPosition[] {
    if (positions.length === 0) return []
    const sorted = [...positions].sort((a, b) => a.entryPrice - b.entryPrice)
    const outer: GridPosition[] = []
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    if (first) outer.push(first)
    if (last && last !== first) outer.push(last)
    return outer
  }

  /**
   * Calculate position size based on config and active capital (50% reserve)
   */
  private calculatePositionSize(): number {
    const activeCapital = this.config.totalInvestmentUsd * 0.5
    let sizeUsd: number

    if (this.config.positionType === 'fixed') {
      sizeUsd = this.config.positionSize
    } else {
      // Default to dividing active capital by max positions if not specified
      const pct = this.config.positionSize || (100 / this.config.maxPositions)
      sizeUsd = (pct / 100) * activeCapital
    }

    return Math.max(sizeUsd, 10) // Enforce $10 Hyperliquid minimum
  }

  /**
   * Get current position count
   */
  private getCurrentPositionCount(): number {
    // This would typically fetch from exchange
    // For now, return a placeholder
    return 2
  }

  /**
   * Get leverage limit for symbol
   */
  private getSymbolLeverageLimit(symbol: string): number {
    // Import from types or implement here
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
   * Check position bias (long vs short exposure)
   */
  checkPositionBias(positions: GridPosition[]): {
    longExposure: number
    shortExposure: number
    biasPct: number
  } {
    const longExposure = positions
      .filter(p => p.side === 'long')
      .reduce((sum, p) => sum + p.sizeUsd, 0)
    
    const shortExposure = positions
      .filter(p => p.side === 'short')
      .reduce((sum, p) => sum + p.sizeUsd, 0)
    
    const totalExposure = longExposure + shortExposure
    const biasPct = totalExposure > 0 
      ? Math.abs(longExposure - shortExposure) / totalExposure * 100
      : 0

    return { longExposure, shortExposure, biasPct }
  }
}
