import { OHLCV } from '../types/index.js'

export class MACD {
  private fastPeriod: number
  private slowPeriod: number
  private signalPeriod: number

  constructor(fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
    this.fastPeriod = fastPeriod
    this.slowPeriod = slowPeriod
    this.signalPeriod = signalPeriod
  }

  private calculateEMA(data: (number | undefined)[], period: number): number[] {
    if (data.length === 0) return []
    const k = 2 / (period + 1)
    const firstVal = data[0]
    if (typeof firstVal !== 'number') return []
    
    const ema: number[] = [firstVal]
    for (let i = 1; i < data.length; i++) {
      const val = data[i]
      const prevEma = ema[i - 1]
      if (typeof val !== 'number' || typeof prevEma !== 'number') continue
      ema.push(val * k + prevEma * (1 - k))
    }
    return ema
  }

  calculate(data: OHLCV[]): { macd: number; signal: number; histogram: number; isCrossover: boolean; isCrossunder: boolean }[] {
    if (data.length < this.slowPeriod + this.signalPeriod) return []

    const closes = data.map(d => d.close)
    const fastEMA = this.calculateEMA(closes, this.fastPeriod)
    const slowEMA = this.calculateEMA(closes, this.slowPeriod)

    const macdLine = fastEMA.map((f, i) => f - (slowEMA[i] || 0))
    const signalLine = this.calculateEMA(macdLine.slice(this.slowPeriod - 1), this.signalPeriod)

    const results = []
    for (let i = 0; i < signalLine.length; i++) {
      const macdIdx = i + this.slowPeriod - 1
      const macdVal = macdLine[macdIdx] || 0
      const signalVal = signalLine[i] || 0
      const histogram = macdVal - signalVal

      // Check for crossover (macd crossing above signal)
      let isCrossover = false
      let isCrossunder = false
      
      if (i > 0) {
        const prevMacd = macdLine[macdIdx - 1] || 0
        const prevSignal = signalLine[i - 1] || 0
        const prevHistogram = prevMacd - prevSignal
        
        if (prevHistogram <= 0 && histogram > 0) isCrossover = true
        if (prevHistogram >= 0 && histogram < 0) isCrossunder = true
      }

      results.push({
        macd: macdVal,
        signal: signalVal,
        histogram,
        isCrossover,
        isCrossunder
      })
    }

    return results
  }

  getLatest(data: OHLCV[]): { macd: number; signal: number; histogram: number; isCrossover: boolean; isCrossunder: boolean } | null {
    const results = this.calculate(data)
    if (results.length === 0) return null
    const latest = results[results.length - 1]
    return latest !== undefined ? latest : null
  }
}
