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
  createdAt?: number
  updatedAt?: number
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
  exitPrice?: number
  pnl?: number
  pnlPct?: number
  fees?: number
  createdAt: number
  filledAt?: number
  closedAt?: number
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

// New types for enhanced grid system

export interface FeeAnalysis {
  entryFeePerLevel: number
  exitFeePerLevel: number
  totalFeesForFullGrid: number
  minProfitableSpacingPct: number
  currentSpacingPct: number
  status: "safe" | "warning" | "danger"
  breakEvenMovementPct: number
}

export interface GridPerformance {
  gridId: string
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  avgTradeProfit: number
  avgTradeDuration: number
  bestLevel: string | null
  worstLevel: string | null
  totalFeesPaid: number
}

export interface GridSummary {
  id: string
  symbol: string
  enabled: boolean
  centerPrice: number
  currentPrice: number
  realPositions: number
  maxRealPositions: number
  totalPnl: number
  status: "active" | "inactive" | "error"
  createdAt: number
}

export interface ProfitProjection {
  estimatedDailyProfit: number
  estimatedWeeklyProfit: number
  estimatedMonthlyProfit: number
  assumedVolatilityPct: number
  assumedTradesPerDay: number
  netAfterFees: number
}

export type ToastType = "success" | "error" | "warning" | "info"

export interface Toast {
  id: string
  type: ToastType
  title: string
  message: string
  duration?: number
}

export interface GridStorageData {
  grids: VirtualGridConfig[]
  levels: Record<string, GridLevel[]>
  performance: Record<string, GridPerformance>
  lastSaved: number
}