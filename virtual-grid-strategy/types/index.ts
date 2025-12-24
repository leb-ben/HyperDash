/**
 * Type definitions for the trading dashboard
 * Matches the existing API structure from the backend
 */

export interface Position {
  symbol: string
  side: "long" | "short"
  size: number
  entryPrice: number
  currentPrice: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  leverage: number
  liquidationPrice: number
  marginUsed: number
  stopLoss?: number
  takeProfit?: number
  entryTime?: number
}

export interface PortfolioState {
  totalValue: number
  availableBalance: number
  marginUsed: number
  unrealizedPnl: number
  positions: Position[]
  stableBalance: number
  lastUpdated: number
}

export interface BotState {
  running: boolean
  cycleCount: number
  lastCycleTime: number
  mode: string
}

export interface Signal {
  id: string
  symbol: string
  type: "long" | "short"
  strength: number
  price: number
  timestamp: number
}

export interface SystemState {
  bot: BotState
  portfolio: PortfolioState
  signals: {
    active: Signal[]
    stats: {
      totalSignals: number
      activeSignals: number
    }
  }
  prices: Record<
    string,
    {
      price: number
      change24h: number
      volume24h: number
    }
  >
}

export interface VirtualGridConfig {
  id: string
  symbol: string
  enabled: boolean
  centerPrice: number
  gridCount: number
  gridSpacingPct: number
  totalInvestmentUsd: number
  leverage: number
  typicalRealPositions: number
  maxRealPositions: number
  rebalanceThresholdPct: number
  minProfitAfterFeesPct: number
}

export interface GridLevel {
  id: string
  price: number
  side: "long" | "short"
  size: number
  sizeUsd: number
  isReal: boolean
  status: "pending" | "filled" | "closed"
  entryPrice?: number
  pnl?: number
  fees?: number
  createdAt: number
}

export interface Alert {
  id: string
  type: "price" | "pnl"
  symbol: string
  condition: "above" | "below"
  threshold: number
  enabled: boolean
  triggered: boolean
  lastTriggered?: number
}
