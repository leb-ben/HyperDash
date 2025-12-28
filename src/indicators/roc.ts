/**
 * Rate of Change (ROC) Indicator
 * Measures price velocity for panic trigger detection
 */

import type { OHLCV } from '../types/index.js'

export interface ROCResult {
  value: number
  percentage: number
  isPanic: boolean
  momentum: 'strong_up' | 'up' | 'neutral' | 'down' | 'strong_down'
}

export class ROC {
  private period: number
  private panicThreshold: number

  constructor(period: number = 10, panicThreshold: number = 5.0) {
    this.period = period
    this.panicThreshold = panicThreshold
  }

  /**
   * Calculate ROC for a series of candles
   */
  calculate(candles: OHLCV[]): ROCResult[] {
    if (candles.length < this.period + 1) {
      throw new Error(`Need at least ${this.period + 1} candles to calculate ROC`)
    }

    const results: ROCResult[] = []

    for (let i = this.period; i < candles.length; i++) {
      const current = candles[i].close
      const previous = candles[i - this.period].close
      
      const change = current - previous
      const percentage = (change / previous) * 100
      const isPanic = Math.abs(percentage) >= this.panicThreshold
      
      let momentum: ROCResult['momentum']
      
      if (percentage > 5) {
        momentum = 'strong_up'
      } else if (percentage > 1) {
        momentum = 'up'
      } else if (percentage > -1) {
        momentum = 'neutral'
      } else if (percentage > -5) {
        momentum = 'down'
      } else {
        momentum = 'strong_down'
      }

      results.push({
        value: change,
        percentage,
        isPanic,
        momentum
      })
    }

    return results
  }

  /**
   * Get the latest ROC value
   */
  getLatest(candles: OHLCV[]): ROCResult | null {
    if (candles.length < this.period + 1) return null
    
    const results = this.calculate(candles)
    return results[results.length - 1]
  }

  /**
   * Check if ROC is accelerating (increasing momentum)
   */
  isAccelerating(candles: OHLCV[]): {
    direction: 'up' | 'down' | 'neutral'
    strength: number // 0-1
  } {
    const minCandles = this.period * 2
    if (candles.length < minCandles) {
      return { direction: 'neutral', strength: 0 }
    }

    const results = this.calculate(candles)
    if (results.length < 5) {
      return { direction: 'neutral', strength: 0 }
    }

    // Get last 5 ROC values
    const recent = results.slice(-5)
    const percentages = recent.map(r => r.percentage)
    
    // Check if ROC values are increasing in magnitude
    const first = Math.abs(percentages[0])
    const last = Math.abs(percentages[percentages.length - 1])
    
    const change = last - first
    const strength = Math.min(Math.abs(change) / this.panicThreshold, 1)
    
    let direction: 'up' | 'down' | 'neutral'
    if (change > 0.5) {
      direction = 'up'
    } else if (change < -0.5) {
      direction = 'down'
    } else {
      direction = 'neutral'
    }

    return { direction, strength }
  }

  /**
   * Get ROC divergence from price (potential reversal signal)
   */
  getPriceDivergence(candles: OHLCV[]): {
    type: 'bullish' | 'bearish' | 'none'
    strength: number // 0-1
  } | null {
    const minCandles = this.period * 3
    if (candles.length < minCandles) return null

    const results = this.calculate(candles)
    if (results.length < 10) return null

    // Get recent price highs and ROC values
    const recentCandles = candles.slice(-20)
    const recentROC = results.slice(-20)
    
    // Find price highs
    const priceHighs: number[] = []
    const rocAtHighs: number[] = []
    
    for (let i = 1; i < recentCandles.length - 1; i++) {
      if (recentCandles[i].high > recentCandles[i-1].high && 
          recentCandles[i].high > recentCandles[i+1].high) {
        priceHighs.push(recentCandles[i].high)
        rocAtHighs.push(recentROC[i]?.percentage || 0)
      }
    }

    // Check for bearish divergence (higher highs but lower ROC)
    if (priceHighs.length >= 2) {
      const priceIncreasing = priceHighs[priceHighs.length - 1] > priceHighs[0]
      const rocDecreasing = rocAtHighs[rocAtHighs.length - 1] < rocAtHighs[0]
      
      if (priceIncreasing && rocDecreasing) {
        const strength = Math.min(
          Math.abs(rocAtHighs[0] - rocAtHighs[rocAtHighs.length - 1]) / 5,
          1
        )
        return { type: 'bearish', strength }
      }
    }

    // Similar logic for bullish divergence with lows
    const priceLows: number[] = []
    const rocAtLows: number[] = []
    
    for (let i = 1; i < recentCandles.length - 1; i++) {
      if (recentCandles[i].low < recentCandles[i-1].low && 
          recentCandles[i].low < recentCandles[i+1].low) {
        priceLows.push(recentCandles[i].low)
        rocAtLows.push(recentROC[i]?.percentage || 0)
      }
    }

    if (priceLows.length >= 2) {
      const priceDecreasing = priceLows[priceLows.length - 1] < priceLows[0]
      const rocIncreasing = rocAtLows[rocAtLows.length - 1] > rocAtLows[0]
      
      if (priceDecreasing && rocIncreasing) {
        const strength = Math.min(
          Math.abs(rocAtLows[rocAtLows.length - 1] - rocAtLows[0]) / 5,
          1
        )
        return { type: 'bullish', strength }
      }
    }

    return { type: 'none', strength: 0 }
  }

  /**
   * Get velocity bands (like Bollinger Bands for ROC)
   */
  getVelocityBands(candles: OHLCV[]): {
    upper: number
    middle: number
    lower: number
    current: number
    position: 'above_upper' | 'upper' | 'middle' | 'lower' | 'below_lower'
  } | null {
    const results = this.calculate(candles)
    if (results.length < 20) return null

    const recent = results.slice(-20)
    const percentages = recent.map(r => r.percentage)
    
    const middle = percentages.reduce((sum, p) => sum + p, 0) / percentages.length
    const stdDev = Math.sqrt(
      percentages.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / percentages.length
    )
    
    const upper = middle + stdDev * 2
    const lower = middle - stdDev * 2
    const current = percentages[percentages.length - 1]
    
    let position: ReturnType<typeof this.getVelocityBands>['position']
    
    if (current > upper) {
      position = 'above_upper'
    } else if (current > middle + stdDev) {
      position = 'upper'
    } else if (current > middle - stdDev) {
      position = 'middle'
    } else if (current > lower) {
      position = 'lower'
    } else {
      position = 'below_lower'
    }

    return { upper, middle, lower, current, position }
  }
}
