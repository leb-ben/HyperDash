/**
 * Hyperliquid Data Fetcher for Backtesting
 * Fetches real historical data from Hyperliquid API
 */

import fetch from 'node-fetch'
import { logger } from '../utils/logger.js'

export interface HyperliquidCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  fundingRate?: number
}

export interface SymbolInfo {
  name: string
  maxLeverage: number
  tradable: boolean
}

// Cache for symbol info to avoid repeated API calls
const symbolInfoCache = new Map<string, SymbolInfo>()

/**
 * Get all tradable symbols from Hyperliquid
 */
export async function getTradableSymbols(): Promise<SymbolInfo[]> {
  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta' })
    })
    
    const data = await response.json() as any
    
    if (!data.universe) {
      throw new Error('Failed to fetch universe from Hyperliquid')
    }
    
    const symbols: SymbolInfo[] = data.universe.map((asset: any) => ({
      name: asset.name,
      maxLeverage: getMaxLeverage(asset.name),
      tradable: !asset.isDelisted && !asset.isSuspended
    })).filter((s: SymbolInfo) => s.tradable)
    
    // Cache the results
    symbols.forEach(s => symbolInfoCache.set(s.name, s))
    
    return symbols
  } catch (error) {
    logger.error('Failed to fetch tradable symbols:', error)
    throw error
  }
}

/**
 * Get maximum leverage for a symbol
 */
function getMaxLeverage(symbol: string): number {
  const limits: Record<string, number> = {
    // 40x leverage
    'BTC': 40, 'ETH': 40, 'SOL': 40, 'XRP': 40,
    // 20x leverage
    'DOGE': 20, 'SUI': 20, 'WLD': 20, 'LTC': 20,
    'LINK': 20, 'AVAX': 20, 'HYPE': 20, 'TIA': 20,
    'APT': 20, 'NEAR': 20, 'SEI': 20, 'JUP': 20,
    // 10x leverage
    'OP': 10, 'ARB': 10, 'LDO': 10, 'TON': 10,
    'BNB': 10, 'DOT': 10, 'MNT': 10, 'INJ': 10,
    // 5x leverage
    'AAVE': 5, 'UNI': 5, 'SNX': 5,
    // 3x leverage (stablecoins and new listings)
    'USDC': 3, 'USDT': 3, 'PYTH': 3, 'PRIME': 3,
    'MON': 3, 'LIT': 3, 'XPL': 3, 'MOBILE': 3
  }
  return limits[symbol.toUpperCase()] || 3
}

/**
 * Fetch historical data for a symbol
 */
export async function fetchHistoricalData(
  symbol: string,
  startTime: number,
  endTime: number,
  interval: string = '1m'
): Promise<HyperliquidCandle[]> {
  try {
    // Convert to Hyperliquid's expected format
    const req = {
      type: 'candleSnapshot',
      req: {
        coin: symbol,
        interval,
        startTime: startTime.toString(),
        endTime: endTime.toString()
      }
    }
    
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    })
    
    const data = await response.json()
    
    if (!data || !Array.isArray(data)) {
      throw new Error(`Invalid response for ${symbol}`)
    }
    
    // Convert to our format
    return data.map((candle: any) => ({
      timestamp: candle.t * 1000, // Convert to milliseconds
      open: parseFloat(candle.o),
      high: parseFloat(candle.h),
      low: parseFloat(candle.l),
      close: parseFloat(candle.c),
      volume: parseFloat(candle.v),
      fundingRate: candle.f ? parseFloat(candle.f) : undefined
    }))
  } catch (error) {
    logger.error(`Failed to fetch historical data for ${symbol}:`, error)
    throw error
  }
}

/**
 * Fetch funding rate history
 */
export async function fetchFundingRates(
  symbol: string,
  startTime: number,
  endTime: number
): Promise<{ timestamp: number; rate: number }[]> {
  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'fundingHistory',
        coin: symbol,
        startTime: startTime.toString(),
        endTime: endTime.toString()
      })
    })
    
    const data = await response.json() as any
    
    if (!Array.isArray(data)) {
      return []
    }
    
    return data.map((entry: any) => ({
      timestamp: entry.time * 1000,
      rate: parseFloat(entry.fundingRate)
    }))
  } catch (error) {
    logger.warn(`Failed to fetch funding rates for ${symbol}:`, error)
    return []
  }
}

/**
 * Get symbol info (with caching)
 */
export async function getSymbolInfo(symbol: string): Promise<SymbolInfo | null> {
  if (symbolInfoCache.has(symbol)) {
    return symbolInfoCache.get(symbol)!
  }
  
  // Fetch all symbols if cache is empty
  const symbols = await getTradableSymbols()
  return symbols.find(s => s.name === symbol) || null
}

/**
 * Validate symbol is supported
 */
export async function validateSymbol(symbol: string): Promise<boolean> {
  const info = await getSymbolInfo(symbol)
  return info !== null && info.tradable
}

/**
 * Get available timeframes
 */
export const AVAILABLE_TIMEFRAMES = [
  { value: '1m', label: '1 minute', candlesPerDay: 1440 },
  { value: '5m', label: '5 minutes', candlesPerDay: 288 },
  { value: '15m', label: '15 minutes', candlesPerDay: 96 },
  { value: '1h', label: '1 hour', candlesPerDay: 24 },
  { value: '4h', label: '4 hours', candlesPerDay: 6 },
  { value: '1d', label: '1 day', candlesPerDay: 1 }
]

/**
 * Fetch data with automatic chunking for large date ranges
 */
export async function fetchHistoricalDataChunked(
  symbol: string,
  startTime: number,
  endTime: number,
  interval: string = '1m'
): Promise<HyperliquidCandle[]> {
  // Hyperliquid limits to ~1000 candles per request
  const maxChunkMs = getChunkSizeMs(interval)
  const chunks: HyperliquidCandle[] = []
  
  let currentStart = startTime
  
  while (currentStart < endTime) {
    const currentEnd = Math.min(currentStart + maxChunkMs, endTime)
    
    logger.info(`Fetching data for ${symbol} from ${new Date(currentStart).toISOString()} to ${new Date(currentEnd).toISOString()}`)
    
    // Retry each chunk individually
    const chunk = await fetchWithRetry(
      () => fetchHistoricalData(symbol, currentStart, currentEnd, interval),
      3,
      `Failed to fetch data chunk for ${symbol}`
    )
    chunks.push(...chunk)
    
    currentStart = currentEnd
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // Sort by timestamp
  chunks.sort((a, b) => a.timestamp - b.timestamp)
  
  return chunks
}

/**
 * Helper function to retry async operations
 */
async function fetchWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  errorMessage: string
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.warn(`${errorMessage} (attempt ${attempt}/${maxRetries}): ${errorMsg}`)
      
      if (attempt === maxRetries) {
        throw error
      }
      
      // Exponential backoff
      const delay = 1000 * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw new Error(`${errorMessage} after ${maxRetries} attempts`)
}

/**
 * Get chunk size based on interval
 */
function getChunkSizeMs(interval: string): number {
  const chunkSizes: Record<string, number> = {
    '1m': 1000 * 60 * 60 * 12, // 12 hours
    '5m': 1000 * 60 * 60 * 24, // 24 hours
    '15m': 1000 * 60 * 60 * 48, // 48 hours
    '1h': 1000 * 60 * 60 * 168, // 7 days
    '4h': 1000 * 60 * 60 * 720, // 30 days
    '1d': 1000 * 60 * 60 * 2160 // 30 days
  }
  // Ensure we always return a valid number
  const defaultChunkSize = chunkSizes['1m']
  return chunkSizes[interval] || defaultChunkSize
}
