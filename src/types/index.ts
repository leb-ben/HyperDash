// ============================================
// Core Types for Trade Bot
// ============================================

// Market Data
export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume24h: number;
  change24h: number;
  high24h: number;
  low24h: number;
  fundingRate?: number;
  nextFundingTime?: number;
}

export interface OrderBook {
  symbol: string;
  bids: [number, number][]; // [price, size][]
  asks: [number, number][];
  timestamp: number;
}

// Technical Indicators
export interface Indicators {
  rsi: number | null;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  } | null;
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
  } | null;
  atr: number | null;
  sma20: number | null;
  sma50: number | null;
  ema12: number | null;
  ema26: number | null;
  volumeProfile: 'high' | 'normal' | 'low';
}

// Coin Analysis
export interface CoinAnalysis {
  symbol: string;
  ticker: Ticker;
  indicators: Record<string, Indicators>; // keyed by timeframe
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
  signals: string[];
}

// Portfolio & Positions
export interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  leverage: number;
  liquidationPrice: number;
  marginUsed: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: number;
}

export interface PortfolioState {
  totalValue: number;
  availableBalance: number;
  marginUsed: number;
  unrealizedPnl: number;
  positions: Position[];
  stableBalance: number;
  lastUpdated: number;
}

// AI Decision Types
export type TradeAction = 'BUY' | 'SELL' | 'CLOSE' | 'HOLD' | 'REDUCE';

export interface TradeDecision {
  action: TradeAction;
  symbol: string;
  side?: 'long' | 'short';
  percentage: number; // % of available balance to use
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  reason: string;
  confidence: number; // 0-1
  urgency: 'low' | 'medium' | 'high';
}

export interface AIResponse {
  analysis: string;
  marketRegime: 'trending_up' | 'trending_down' | 'ranging' | 'volatile' | 'uncertain';
  riskLevel: 'low' | 'moderate' | 'high' | 'extreme';
  decisions: TradeDecision[];
  holdStablePct: number;
  reasoning: string;
  warnings: string[];
}

// Order Types
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'open' | 'filled' | 'cancelled' | 'failed';

export interface Order {
  id: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  size: number;
  price?: number;
  stopPrice?: number;
  status: OrderStatus;
  filledSize: number;
  filledPrice: number;
  createdAt: number;
  updatedAt: number;
}

// Trade History
export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  size: number;
  price: number;
  fee: number;
  realizedPnl: number;
  timestamp: number;
}

// Market Report (sent to AI)
export interface MarketReport {
  timestamp: number;
  portfolio: PortfolioState;
  coins: CoinAnalysis[];
  marketSentiment: {
    btcDominance: number;
    totalMarketCap: number;
    fearGreedIndex?: number;
    overallSentiment?: 'bullish' | 'bearish' | 'neutral';
    socialSentiment?: Record<string, number>;
    newsCount?: Record<string, number>;
  };
  recentTrades: Trade[];
  recentDecisions: AIResponse[];
  botPerformance: {
    dailyPnl: number;
    dailyPnlPct: number;
    weeklyPnl: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
  };
}

// Configuration Types
export interface CoinConfig {
  symbol: string;
  max_position_pct: number;
  leverage: number;
}

export interface RiskConfig {
  min_stable_pct: number;
  max_single_position_pct: number;
  max_total_exposure_pct: number;
  max_daily_loss_pct: number;
  max_drawdown_pct: number;
  default_leverage: number;
  max_leverage: number;
  default_stop_loss_pct: number;
  default_take_profit_pct: number;
  use_trailing_stop: boolean;
  trailing_stop_pct: number;
}

export interface AIConfig {
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  min_confidence_to_trade: number;
  high_confidence_threshold: number;
}

export interface BotConfig {
  bot: {
    name: string;
    version: string;
    cycle_interval_ms: number;
    paper_trading: boolean;
  };
  coins: {
    stable: string;
    tracked: CoinConfig[];
  };
  risk: RiskConfig;
  ai: AIConfig;
  exchange: {
    name: string;
    testnet: boolean;
  };
  analysis: {
    timeframes: string[];
    indicators: Record<string, unknown>;
  };
  logging: {
    level: string;
    file: string;
    console: boolean;
  };
}

// Event Types
export type BotEvent = 
  | { type: 'CYCLE_START'; timestamp: number }
  | { type: 'CYCLE_END'; timestamp: number; duration: number }
  | { type: 'TRADE_EXECUTED'; trade: Trade }
  | { type: 'POSITION_OPENED'; position: Position }
  | { type: 'POSITION_CLOSED'; position: Position; pnl: number }
  | { type: 'STOP_LOSS_HIT'; position: Position }
  | { type: 'TAKE_PROFIT_HIT'; position: Position }
  | { type: 'ERROR'; error: string; context: string }
  | { type: 'WARNING'; message: string }
  | { type: 'BOT_PAUSED'; reason: string }
  | { type: 'BOT_RESUMED' };
