/**
 * Grid-specific type definitions for the Hamburger Bot strategy
 */

export interface GridPosition {
  id: string
  symbol: string
  side: 'long' | 'short'
  size: number
  sizeUsd: number
  entryPrice: number
  currentPrice: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  leverage: number
  liquidationPrice: number
  marginUsed: number
  stopLoss: number
  takeProfit: number
  entryTime: number
  highestPrice?: number // For trailing stops
  lowestPrice?: number // For trailing stops
  isReal: boolean // true for real positions (2-4), false for virtual
  levelId?: string // Link back to virtual level
}

export interface VirtualLevel {
  id: string
  price: number
  side: 'long' | 'short'
  distanceFromCenter: number
  isReal: boolean
  status: 'pending' | 'filled' | 'cooldown'
  createdAt: number
  lastClosedAt?: number // Track when position was last closed
}

export interface HamburgerBotConfig {
  id: string
  symbol: string
  enabled: boolean
  // Capital configuration
  totalInvestmentUsd: number
  leverage: number
  activeCapitalPct: number // Percentage of capital available for trading (rest is reserve)
  // Position sizing
  positionType: 'percentage' | 'fixed'
  positionSize: number
  // Grid configuration
  gridSpacing: number // in percentage
  gridSpacingType: 'percentage' | 'fixed'
  // Position limits
  minPositions: number // always 2
  maxPositions: number // always 4
  maxActivePositions: number // NEW: Maximum real positions to hold at once (default 1)
  // Risk management
  stopLossPct: number
  takeProfitPct: number
  rebalanceThresholdPct: number
  maxCapitalUtilization: number // 95%
  maxPositionBiasPct: number // 60%
  // Smart Grid features
  useTrendFilter: boolean // Only open positions in trend direction
  useReversalConfirmation: boolean // Wait for price reversal before entry
  useTrailingStop: boolean // Trailing stop loss to lock in profits
  minVolumeMultiplier: number // Minimum volume multiplier (vs average) to trade
  // Adaptive Grid settings
  useAdaptiveGrid: boolean // Use ATR-based spacing
  atrMultiplier: number // Spacing = ATR * multiplier
  useDynamicSLTP: boolean // Use ATR-based SL/TP
  tpAtrMultiplier: number // TP = ATR * multiplier
  slAtrMultiplier: number // SL = ATR * multiplier
  useBreakEvenStop: boolean // Move SL to break-even after some profit
  breakEvenThresholdPct: number // 50% of TP
  exitOnTrendFlip: boolean // Immediate exit if SAR trend reverses
  // Advanced filters
  useRSIFilter: boolean // Only trade when RSI is not overbought/oversold
  rsiUpperThreshold: number // Default 70
  rsiLowerThreshold: number // Default 30
  useMACDFilter: boolean // Confirm entry with MACD histogram
  // Reactive Mode settings
  useReactiveMode: boolean // NEW: Disable signals, use price action reaction
  reactionLookback: number // Number of candles to look back for reactive bias
  reactionThreshold: number // Price change % to flip bias
  // AI configuration
  aiAggressiveness?: 'low' | 'conservative' | 'medium' | 'aggressive' | 'high' | 'ultra' // DEPRECATED - Now optional
  aiConfidenceThreshold: number
  // Additional properties for compatibility
  ai?: {
    // aggressiveness deprecated - now optional
    aggressiveness?: 'low' | 'conservative' | 'medium' | 'aggressive' | 'high' | 'ultra'
    confidenceThreshold: number
    signals: {
      parabolicSAR: {
        acceleration: number
        maximum: number
      }
      atr: {
        period: number
        multiplier: number
      }
      volume: {
        spikeThreshold: number
        lookback: number
      }
      roc: {
        period: number
        panicThreshold: number
      }
    }
  }
  grid: {
    defaultSpacing: number
  }
  targetMarginUtilization: number
}

export interface GridSignals {
  parabolicSAR: {
    value: number
    isUptrend: boolean
  }
  atr: {
    value: number
    multiplier: number
  }
  volume: {
    current: number
    average: number
    spikeMultiplier: number
    isSpike: boolean
  }
  roc: {
    value: number
    panicThreshold: number
    isPanic: boolean
  }
  rsi: number
  macd: {
    macd: number
    signal: number
    histogram: number
    isCrossover: boolean
    isCrossunder: boolean
  }
  isDivergence: boolean
}

export enum GridAction {
  HOLD = 'hold',
  CLOSE_ALL = 'close_all',
  CUT_LONG = 'cut_long',
  CUT_SHORT = 'cut_short',
  EMERGENCY_REBALANCE = 'emergency_rebalance'
}

export interface AIDecision {
  action: GridAction
  confidence: number
  reasoning: string
  signals: GridSignals
  timestamp: number
  expectedOutcome: string
}

export interface GridPerformance {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalPnl: number
  totalFees: number
  capitalEfficiency: number
  maxDrawdown: number
  sharpeRatio: number
  avgHoldTime: number
  positions: {
    long: number
    short: number
  }
}

export interface GridState {
  config: HamburgerBotConfig
  realPositions: GridPosition[]
  virtualLevels: VirtualLevel[]
  currentPrice: number
  lastRebalance: number
  performance: GridPerformance
  isRunning: boolean
}

// Leverage limits per symbol group
export const LEVERAGE_LIMITS: Record<string, string[]> = {
  '40x': ['BTC', 'ETH', 'SOL', 'XRP'],
  '20x': ['DOGE', 'SUI', 'WLD', 'LTC', 'LINK', 'AVAX', 'HYPE', 'TIA', 'APT', 'NEAR'],
  '10x': ['OP', 'ARB', 'LDO', 'TON', 'JUP', 'SEI', 'BNB', 'DOT'],
  '3x': ['USDC', 'USDT', 'STABLE', 'MON', 'LIT', 'XPL'] // Stablecoins and new listings
}

export type LeverageTier = keyof typeof LEVERAGE_LIMITS

export function getLeverageLimit(symbol: string): number {
  for (const [tier, symbols] of Object.entries(LEVERAGE_LIMITS)) {
    if (symbols.includes(symbol.toUpperCase())) {
      return parseInt(tier)
    }
  }
  return 3 // Default to lowest leverage for unknown symbols
}
