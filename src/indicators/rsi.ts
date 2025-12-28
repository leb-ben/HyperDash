import { OHLCV } from '../types/index.js'

export class RSI {
  private period: number

  constructor(period: number = 14) {
    this.period = period
  }

  calculate(data: OHLCV[]): number[] {
    if (data.length <= this.period) return []

    const results: number[] = []
    let gains = 0
    let losses = 0

    // Initial average gain/loss
    for (let i = 1; i <= this.period; i++) {
      const current = data[i];
      const prev = data[i - 1];
      if (!current || !prev) continue;
      
      const difference = current.close - prev.close
      if (difference >= 0) {
        gains += difference
      } else {
        losses -= difference
      }
    }

    let avgGain = gains / this.period
    let avgLoss = losses / this.period

    const firstRSI = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss))
    results.push(firstRSI)

    // Wilder's smoothing
    for (let i = this.period + 1; i < data.length; i++) {
      const current = data[i];
      const prev = data[i - 1];
      if (!current || !prev) continue;

      const difference = current.close - prev.close
      const gain = difference >= 0 ? difference : 0
      const loss = difference < 0 ? -difference : 0

      avgGain = (avgGain * (this.period - 1) + gain) / this.period
      avgLoss = (avgLoss * (this.period - 1) + loss) / this.period

      const rs = avgLoss === 0 ? (avgGain === 0 ? 0 : 100) : avgGain / avgLoss
      const rsi = 100 - (100 / (1 + rs))
      results.push(rsi)
    }

    return results
  }

  getLatest(data: OHLCV[]): number | null {
    const results = this.calculate(data)
    if (results.length === 0) return null
    const latest = results[results.length - 1]
    return latest !== undefined ? latest : null
  }
}
