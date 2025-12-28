/**
 * Average True Range (ATR) Indicator
 * Measures volatility for dynamic grid spacing
 */

import type { OHLCV } from '../types/index.js'

export interface ATRResult {
  value: number
  trueRanges: number[]
  average: number
}

export class ATR {
  private period: number

  constructor(period: number = 14) {
    this.period = period
  }

  /**
   * Calculate True Range for a single candle
   */
  private calculateTrueRange(current: OHLCV, previous: OHLCV): number {
    const tr1 = current.high - current.low
    const tr2 = Math.abs(current.high - previous.close)
    const tr3 = Math.abs(current.low - previous.close)
    
    return Math.max(tr1, tr2, tr3)
  }

  /**
   * Calculate ATR for a series of candles
   */
  calculate(candles: OHLCV[]): ATRResult[] {
    if (candles.length < this.period + 1) {
      throw new Error(`Need at least ${this.period + 1} candles to calculate ATR`)
    }

    const results: ATRResult[] = []
    const trueRanges: number[] = []

    // Calculate True Ranges
    for (let i = 1; i < candles.length; i++) {
      const tr = this.calculateTrueRange(candles[i], candles[i - 1])
      trueRanges.push(tr)
    }

    // Initialize with simple average of first period
    let atr = 0
    for (let i = 0; i < this.period; i++) {
      atr += trueRanges[i]
    }
    atr /= this.period

    // Store first ATR value
    results.push({
      value: atr,
      trueRanges: trueRanges.slice(0, this.period),
      average: atr
    })

    // Calculate subsequent ATR values using Wilder's smoothing
    for (let i = this.period; i < trueRanges.length; i++) {
      atr = (atr * (this.period - 1) + trueRanges[i]) / this.period
      
      results.push({
        value: atr,
        trueRanges: trueRanges.slice(i - this.period + 1, i + 1),
        average: atr
      })
    }

    return results
  }

  /**
   * Get the latest ATR value
   */
  getLatest(candles: OHLCV[]): number | null {
    if (candles.length < this.period + 1) return null
    
    const results = this.calculate(candles)
    return results[results.length - 1].value
  }

  /**
   * Get ATR as percentage of price
   */
  getATRPercentage(candles: OHLCV[]): number | null {
    const atr = this.getLatest(candles)
    if (!atr) return null
    
    const currentPrice = candles[candles.length - 1].close
    return (atr / currentPrice) * 100
  }

  /**
   * Get volatility level (low, medium, high)
   */
  getVolatilityLevel(candles: OHLCV[]): {
    level: 'low' | 'medium' | 'high' | 'extreme'
    percentage: number
  } {
    const atrPct = this.getATRPercentage(candles)
    if (!atrPct) {
      return { level: 'low', percentage: 0 }
    }

    let level: 'low' | 'medium' | 'high' | 'extreme'
    
    if (atrPct < 1) {
      level = 'low'
    } else if (atrPct < 2.5) {
      level = 'medium'
    } else if (atrPct < 5) {
      level = 'high'
    } else {
      level = 'extreme'
    }

    return { level, percentage: atrPct }
  }

  /**
   * Get recommended grid spacing based on ATR
   */
  getRecommendedGridSpacing(candles: OHLCV[], multiplier: number = 2): number {
    const atrPct = this.getATRPercentage(candles)
    if (!atrPct) return 1.0 // Default 1%
    
    // Grid spacing should be a multiple of ATR
    const spacing = atrPct * multiplier
    
    // Clamp between reasonable values
    return Math.max(0.5, Math.min(spacing, 5.0))
  }

  /**
   * Check if volatility is increasing
   */
  isVolatilityIncreasing(candles: OHLCV[], lookback: number = 5): boolean {
    if (candles.length < this.period + lookback) return false
    
    const results = this.calculate(candles)
    if (results.length < lookback) return false
    
    const recent = results.slice(-lookback)
    const avgRecent = recent.reduce((sum, r) => sum + r.value, 0) / lookback
    const previous = results.slice(-lookback - 5, -lookback)
    
    if (previous.length === 0) return false
    
    const avgPrevious = previous.reduce((sum, r) => sum + r.value, 0) / previous.length
    
    return avgRecent > avgPrevious * 1.1 // 10% increase
  }
}
