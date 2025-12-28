/**
 * Virtual Grid - Infinite grid monitoring without capital lockup
 * Manages virtual levels for trigger detection
 */

import type { VirtualLevel, HamburgerBotConfig } from '../types/grid.js'
import { logger } from '../utils/logger.js'

export class VirtualGrid {
  private config: HamburgerBotConfig
  private baseLevels: number = 50 // Number of virtual levels to track each side

  constructor(config: HamburgerBotConfig) {
    this.config = config
  }

  /**
   * Generate virtual grid levels around a center price
   */
  generateGrid(centerPrice: number): VirtualLevel[] {
    const levels: VirtualLevel[] = []
    const spacing = this.config.gridSpacing / 100 // Convert percentage to decimal

    // Generate levels above center (short positions)
    for (let i = 1; i <= this.baseLevels; i++) {
      const price = centerPrice * Math.pow(1 + spacing, i)
      levels.push({
        id: `virtual_short_${i}`,
        price,
        side: 'short',
        distanceFromCenter: i,
        isReal: false,
        status: 'pending',
        createdAt: Date.now()
      })
    }

    // Generate levels below center (long positions)
    for (let i = 1; i <= this.baseLevels; i++) {
      const price = centerPrice * Math.pow(1 - spacing, i)
      levels.push({
        id: `virtual_long_${i}`,
        price,
        side: 'long',
        distanceFromCenter: -i,
        isReal: false,
        status: 'pending',
        createdAt: Date.now()
      })
    }

    // Sort by price
    levels.sort((a, b) => b.price - a.price)

    logger.debug(`Generated ${levels.length} virtual levels around ${centerPrice}`)
    return levels
  }

  /**
   * Check if price crossed any virtual levels
   */
  checkCrossings(currentPrice: number, virtualLevels: VirtualLevel[]): VirtualLevel[] {
    const crossed: VirtualLevel[] = []

    for (const level of virtualLevels) {
      if (level.status !== 'pending') {
        // Handle cooldown reset
        if (level.status === 'cooldown' && level.lastClosedAt) {
          const fiveMinutes = 5 * 60 * 1000
          if (Date.now() - level.lastClosedAt > fiveMinutes) {
            level.status = 'pending'
          } else {
            continue
          }
        } else {
          continue
        }
      }

      // Check if price crossed the level
      if (level.side === 'short' && currentPrice >= level.price) {
        crossed.push(level)
        level.status = 'filled'
      } else if (level.side === 'long' && currentPrice <= level.price) {
        crossed.push(level)
        level.status = 'filled'
      }
    }

    if (crossed.length > 0) {
      logger.debug(`Price ${currentPrice} crossed ${crossed.length} virtual levels`)
    }

    return crossed
  }

  /**
   * Add new virtual levels as price moves
   */
  extendGrid(currentPrice: number, virtualLevels: VirtualLevel[]): VirtualLevel[] {
    const levels = [...virtualLevels]
    const spacing = this.config.gridSpacing / 100
    const highestPrice = Math.max(...levels.map(l => l.price))
    const lowestPrice = Math.min(...levels.map(l => l.price))

    // Add levels above if needed
    while (highestPrice < currentPrice * 1.5) {
      const newHighPrice = highestPrice * Math.pow(1 + spacing, 1)
      levels.push({
        id: `virtual_short_${Date.now()}_${levels.length}`,
        price: newHighPrice,
        side: 'short',
        distanceFromCenter: levels.length,
        isReal: false,
        status: 'pending',
        createdAt: Date.now()
      })
    }

    // Add levels below if needed
    while (lowestPrice > currentPrice * 0.5) {
      const newLowPrice = lowestPrice * Math.pow(1 - spacing, 1)
      levels.push({
        id: `virtual_long_${Date.now()}_${levels.length}`,
        price: newLowPrice,
        side: 'long',
        distanceFromCenter: -levels.length,
        isReal: false,
        status: 'pending',
        createdAt: Date.now()
      })
    }

    return levels
  }

  /**
   * Get nearest virtual levels to current price
   */
  getNearestLevels(currentPrice: number, virtualLevels: VirtualLevel[]): {
    above: VirtualLevel[]
    below: VirtualLevel[]
  } {
    const above = virtualLevels
      .filter(l => l.price > currentPrice && l.status === 'pending')
      .sort((a, b) => a.price - b.price)
      .slice(0, 5)

    const below = virtualLevels
      .filter(l => l.price < currentPrice && l.status === 'pending')
      .sort((a, b) => b.price - a.price)
      .slice(0, 5)

    return { above, below }
  }

  /**
   * Calculate grid density around price
   */
  calculateGridDensity(currentPrice: number, virtualLevels: VirtualLevel[]): number {
    const range = this.config.gridSpacing / 100 * currentPrice
    const nearbyLevels = virtualLevels.filter(
      l => Math.abs(l.price - currentPrice) <= range
    )
    
    return nearbyLevels.length / (range * 2) // Levels per price unit
  }

  /**
   * Update grid spacing based on volatility
   */
  updateGridSpacing(volatility: number): number {
    // Dynamic spacing based on ATR or volatility
    const baseSpacing = this.config.gridSpacing
    const volatilityMultiplier = Math.max(0.5, Math.min(2, volatility))
    
    return baseSpacing * volatilityMultiplier
  }

  /**
   * Reset filled virtual levels
   */
  resetFilledLevels(virtualLevels: VirtualLevel[]): VirtualLevel[] {
    return virtualLevels.map(level => ({
      ...level,
      status: 'pending' as const
    }))
  }

  /**
   * Get grid statistics
   */
  getGridStats(virtualLevels: VirtualLevel[]): {
    total: number
    pending: number
    filled: number
    cooldown: number
    closed: number
  } {
    const stats = {
      total: virtualLevels.length,
      pending: 0,
      filled: 0,
      cooldown: 0,
      closed: 0
    }

    for (const level of virtualLevels) {
      if (level.status in stats) {
        stats[level.status]++
      }
    }

    return stats
  }
}
