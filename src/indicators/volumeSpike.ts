/**
 * Volume Spike Detection Indicator
 * Detects unusual volume activity for pump/dump warnings
 */

import type { OHLCV } from '../types/index.js'

export interface VolumeSpikeResult {
  current: number
  average: number
  spikeMultiplier: number
  isSpike: boolean
  strength: number // 0-1, higher = stronger spike
}

export class VolumeSpike {
  private lookback: number
  private spikeThreshold: number

  constructor(lookback: number = 20, spikeThreshold: number = 2.0) {
    this.lookback = lookback
    this.spikeThreshold = spikeThreshold
  }

  /**
   * Calculate volume metrics for a series of candles
   */
  calculate(candles: OHLCV[]): VolumeSpikeResult[] {
    if (candles.length < this.lookback) {
      throw new Error(`Need at least ${this.lookback} candles for volume analysis`)
    }

    const results: VolumeSpikeResult[] = []

    for (let i = 0; i < candles.length; i++) {
      // Calculate average volume over lookback period
      const startIdx = Math.max(0, i - this.lookback + 1)
      const relevantCandles = candles.slice(startIdx, i + 1)
      
      const average = relevantCandles.reduce((sum, c) => sum + c.volume, 0) / relevantCandles.length
      const current = candles[i].volume
      const spikeMultiplier = current / average
      const isSpike = spikeMultiplier >= this.spikeThreshold
      
      // Strength based on how much the spike exceeds threshold
      let strength = 0
      if (isSpike) {
        strength = Math.min((spikeMultiplier - this.spikeThreshold) / this.spikeThreshold, 1)
      }

      results.push({
        current,
        average,
        spikeMultiplier,
        isSpike,
        strength
      })
    }

    return results
  }

  /**
   * Get the latest volume spike result
   */
  getLatest(candles: OHLCV[]): VolumeSpikeResult | null {
    if (candles.length < this.lookback) return null
    
    const results = this.calculate(candles)
    return results[results.length - 1]
  }

  /**
   * Check if volume is trending up or down
   */
  getVolumeTrend(candles: OHLCV[], period: number = 10): {
    direction: 'up' | 'down' | 'neutral'
    strength: number // 0-1
  } {
    if (candles.length < period) {
      return { direction: 'neutral', strength: 0 }
    }

    const recent = candles.slice(-period)
    const volumes = recent.map(c => c.volume)
    
    // Simple linear regression to determine trend
    const n = volumes.length
    const sumX = (n * (n - 1)) / 2
    const sumY = volumes.reduce((sum, v) => sum + v, 0)
    const sumXY = volumes.reduce((sum, v, i) => sum + v * i, 0)
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const avgY = sumY / n
    
    // Normalize slope to 0-1 range
    const strength = Math.min(Math.abs(slope) / avgY * 100, 1)
    const direction = slope > 0 ? 'up' : slope < 0 ? 'down' : 'neutral'
    
    return { direction, strength }
  }

  /**
   * detect volume climax (potential reversal point)
   */
  isVolumeClimax(candles: OHLCV[]): boolean {
    if (candles.length < this.lookback) return false
    
    const latest = this.getLatest(candles)
    if (!latest || !latest.isSpike) return false
    
    // Check if this is the highest volume in the lookback period
    const recent = candles.slice(-this.lookback)
    const maxVolume = Math.max(...recent.map(c => c.volume))
    
    return latest.current === maxVolume
  }

  /**
   * Get volume relative to typical range
   */
  getVolumeRelativeLevel(candles: OHLCV[]): {
    level: 'very_low' | 'low' | 'normal' | 'high' | 'very_high'
    percentile: number
  } {
    if (candles.length < 50) {
      return { level: 'normal', percentile: 50 }
    }

    const volumes = candles.map(c => c.volume)
    const current = candles[candles.length - 1].volume
    
    // Calculate percentile
    const sorted = [...volumes].sort((a, b) => a - b)
    const percentile = (sorted.indexOf(current) / sorted.length) * 100
    
    let level: 'very_low' | 'low' | 'normal' | 'high' | 'very_high'
    
    if (percentile < 10) {
      level = 'very_low'
    } else if (percentile < 30) {
      level = 'low'
    } else if (percentile < 70) {
      level = 'normal'
    } else if (percentile < 90) {
      level = 'high'
    } else {
      level = 'very_high'
    }

    return { level, percentile }
  }
}
