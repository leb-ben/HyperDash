/**
 * Parabolic SAR (Stop and Reverse) Indicator
 * Primary trend direction indicator for Hamburger Bot
 */

import type { OHLCV } from '../types/index.js'

export interface ParabolicSARResult {
  value: number
  isUptrend: boolean
  extremePoint: number
  accelerationFactor: number
}

export class ParabolicSAR {
  private acceleration: number
  private maximum: number

  constructor(acceleration: number = 0.02, maximum: number = 0.2) {
    this.acceleration = acceleration
    this.maximum = maximum
  }

  /**
   * Calculate Parabolic SAR for a series of candles
   */
  calculate(candles: OHLCV[]): ParabolicSARResult[] {
    if (candles.length < 2) {
      throw new Error('Need at least 2 candles to calculate Parabolic SAR')
    }

    const results: ParabolicSARResult[] = []
    let isUptrend = true
    let sar = candles[0].low
    let extremePoint = candles[0].high
    let af = this.acceleration

    // Initialize with first candle
    results.push({
      value: sar,
      isUptrend,
      extremePoint,
      accelerationFactor: af
    })

    for (let i = 1; i < candles.length; i++) {
      const current = candles[i]
      const prev = candles[i - 1]
      const prevResult = results[i - 1]

      // Store previous values
      isUptrend = prevResult.isUptrend
      sar = prevResult.value
      extremePoint = prevResult.extremePoint
      af = prevResult.accelerationFactor

      // Calculate new SAR
      if (isUptrend) {
        // Uptrend - SAR moves up
        sar = sar + af * (extremePoint - sar)
        
        // Ensure SAR is below the low of the last two periods
        const lowestLastTwo = Math.min(prev.low, current.low)
        if (sar > lowestLastTwo) {
          sar = lowestLastTwo
        }

        // Check for trend reversal
        if (current.low < sar) {
          // Switch to downtrend
          isUptrend = false
          sar = Math.max(extremePoint, current.high)
          extremePoint = current.low
          af = this.acceleration
        } else {
          // Continue uptrend
          if (current.high > extremePoint) {
            extremePoint = current.high
            af = Math.min(af + this.acceleration, this.maximum)
          }
        }
      } else {
        // Downtrend - SAR moves down
        sar = sar + af * (extremePoint - sar)
        
        // Ensure SAR is above the high of the last two periods
        const highestLastTwo = Math.max(prev.high, current.high)
        if (sar < highestLastTwo) {
          sar = highestLastTwo
        }

        // Check for trend reversal
        if (current.high > sar) {
          // Switch to uptrend
          isUptrend = true
          sar = Math.min(extremePoint, current.low)
          extremePoint = current.high
          af = this.acceleration
        } else {
          // Continue downtrend
          if (current.low < extremePoint) {
            extremePoint = current.low
            af = Math.min(af + this.acceleration, this.maximum)
          }
        }
      }

      results.push({
        value: sar,
        isUptrend,
        extremePoint,
        accelerationFactor: af
      })
    }

    return results
  }

  /**
   * Get the latest SAR value
   */
  getLatest(candles: OHLCV[]): ParabolicSARResult | null {
    if (candles.length < 2) return null
    
    const results = this.calculate(candles)
    return results[results.length - 1]
  }

  /**
   * Check if trend changed at the last candle
   */
  hasTrendChanged(candles: OHLCV[]): boolean {
    if (candles.length < 3) return false
    
    const results = this.calculate(candles)
    const current = results[results.length - 1]
    const previous = results[results.length - 2]
    
    return current.isUptrend !== previous.isUptrend
  }

  /**
   * Get signal strength based on distance from price
   */
  getSignalStrength(candles: OHLCV[]): {
    strength: number // 0-1, higher = stronger trend
    direction: 'bullish' | 'bearish' | 'neutral'
  } {
    const latest = this.getLatest(candles)
    if (!latest) {
      return { strength: 0, direction: 'neutral' }
    }

    const currentPrice = candles[candles.length - 1].close
    const distance = Math.abs(currentPrice - latest.value) / currentPrice
    
    // Strength based on distance and acceleration factor
    let strength = Math.min(distance * 10, 1) * (latest.accelerationFactor / this.maximum)
    
    return {
      strength,
      direction: latest.isUptrend ? 'bullish' : 'bearish'
    }
  }
}
