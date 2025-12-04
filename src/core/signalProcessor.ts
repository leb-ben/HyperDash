/**
 * Fast Signal Processor
 * 
 * Real-time signal processing for reactive trading:
 * - Price movement detection
 * - Volume spike detection
 * - Indicator crossover signals
 * - Multi-timeframe signal aggregation
 * - Signal strength scoring
 * - Instant trade triggers
 */

import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

export enum SignalType {
  PRICE_BREAKOUT = 'PRICE_BREAKOUT',
  PRICE_BREAKDOWN = 'PRICE_BREAKDOWN',
  VOLUME_SPIKE = 'VOLUME_SPIKE',
  RSI_OVERSOLD = 'RSI_OVERSOLD',
  RSI_OVERBOUGHT = 'RSI_OVERBOUGHT',
  MACD_BULLISH_CROSS = 'MACD_BULLISH_CROSS',
  MACD_BEARISH_CROSS = 'MACD_BEARISH_CROSS',
  BB_LOWER_TOUCH = 'BB_LOWER_TOUCH',
  BB_UPPER_TOUCH = 'BB_UPPER_TOUCH',
  TREND_REVERSAL = 'TREND_REVERSAL',
  MOMENTUM_SURGE = 'MOMENTUM_SURGE',
  STOP_LOSS_HIT = 'STOP_LOSS_HIT',
  TAKE_PROFIT_HIT = 'TAKE_PROFIT_HIT',
  LIQUIDATION_RISK = 'LIQUIDATION_RISK'
}

export enum SignalDirection {
  LONG = 'LONG',
  SHORT = 'SHORT',
  NEUTRAL = 'NEUTRAL',
  EXIT = 'EXIT'
}

export enum SignalUrgency {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

export interface TradingSignal {
  id: string;
  symbol: string;
  type: SignalType;
  direction: SignalDirection;
  urgency: SignalUrgency;
  strength: number; // 0-100
  price: number;
  timestamp: number;
  metadata: {
    indicator?: string;
    value?: number;
    threshold?: number;
    timeframe?: string;
    confidence?: number;
  };
  expiry: number; // Signal expires after this timestamp
}

export interface PriceData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  high24h?: number;
  low24h?: number;
  change24h?: number;
}

export interface IndicatorData {
  symbol: string;
  rsi?: number;
  macd?: { value: number; signal: number; histogram: number };
  bbands?: { upper: number; middle: number; lower: number };
  atr?: number;
  ema20?: number;
  ema50?: number;
  volume?: number;
  avgVolume?: number;
}

interface PriceHistory {
  prices: number[];
  volumes: number[];
  timestamps: number[];
  maxSize: number;
}

const SIGNAL_EXPIRY_MS = 60000; // 1 minute
const PRICE_HISTORY_SIZE = 100;
const VOLUME_SPIKE_MULTIPLIER = 2.5;
const PRICE_BREAKOUT_PCT = 1.5;

class SignalProcessor extends EventEmitter {
  private priceHistory: Map<string, PriceHistory> = new Map();
  private lastIndicators: Map<string, IndicatorData> = new Map();
  private activeSignals: Map<string, TradingSignal[]> = new Map();
  private signalHistory: TradingSignal[] = [];
  private isProcessing: boolean = false;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Process new price data and generate signals
   */
  processPriceUpdate(data: PriceData): TradingSignal[] {
    const signals: TradingSignal[] = [];
    
    // Update price history
    this.updatePriceHistory(data);
    
    const history = this.priceHistory.get(data.symbol);
    if (!history || history.prices.length < 10) return signals;

    // Check for price breakout/breakdown
    const priceSignals = this.checkPriceSignals(data, history);
    signals.push(...priceSignals);

    // Check for volume spikes
    const volumeSignals = this.checkVolumeSignals(data, history);
    signals.push(...volumeSignals);

    // Store and emit signals
    this.storeSignals(data.symbol, signals);
    
    return signals;
  }

  /**
   * Process indicator data and generate signals
   */
  processIndicatorUpdate(data: IndicatorData): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const prev = this.lastIndicators.get(data.symbol);
    
    // RSI signals
    if (data.rsi !== undefined) {
      const rsiSignals = this.checkRSISignals(data.symbol, data.rsi, prev?.rsi);
      signals.push(...rsiSignals);
    }

    // MACD signals
    if (data.macd && prev?.macd) {
      const macdSignals = this.checkMACDSignals(data.symbol, data.macd, prev.macd);
      signals.push(...macdSignals);
    }

    // Bollinger Bands signals
    if (data.bbands) {
      const price = this.getLatestPrice(data.symbol);
      if (price) {
        const bbSignals = this.checkBBandSignals(data.symbol, price, data.bbands);
        signals.push(...bbSignals);
      }
    }

    // EMA crossover signals
    if (data.ema20 && data.ema50 && prev?.ema20 && prev?.ema50) {
      const emaSignals = this.checkEMASignals(data.symbol, data, prev);
      signals.push(...emaSignals);
    }

    // Update last indicators
    this.lastIndicators.set(data.symbol, data);
    
    // Store and emit signals
    this.storeSignals(data.symbol, signals);
    
    return signals;
  }

  /**
   * Check price-based signals
   */
  private checkPriceSignals(data: PriceData, history: PriceHistory): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const prices = history.prices;
    
    // Calculate recent high/low
    const recentPrices = prices.slice(-20);
    const recentHigh = Math.max(...recentPrices);
    const recentLow = Math.min(...recentPrices);
    const range = recentHigh - recentLow;
    
    // Breakout above recent high
    if (data.price > recentHigh && range > 0) {
      const breakoutPct = ((data.price - recentHigh) / recentHigh) * 100;
      if (breakoutPct >= 0.5) {
        signals.push(this.createSignal(
          data.symbol,
          SignalType.PRICE_BREAKOUT,
          SignalDirection.LONG,
          Math.min(breakoutPct * 20, 100),
          data.price,
          breakoutPct >= PRICE_BREAKOUT_PCT ? SignalUrgency.HIGH : SignalUrgency.MEDIUM,
          { indicator: 'price', value: breakoutPct, threshold: PRICE_BREAKOUT_PCT }
        ));
      }
    }
    
    // Breakdown below recent low
    if (data.price < recentLow && range > 0) {
      const breakdownPct = ((recentLow - data.price) / recentLow) * 100;
      if (breakdownPct >= 0.5) {
        signals.push(this.createSignal(
          data.symbol,
          SignalType.PRICE_BREAKDOWN,
          SignalDirection.SHORT,
          Math.min(breakdownPct * 20, 100),
          data.price,
          breakdownPct >= PRICE_BREAKOUT_PCT ? SignalUrgency.HIGH : SignalUrgency.MEDIUM,
          { indicator: 'price', value: breakdownPct, threshold: PRICE_BREAKOUT_PCT }
        ));
      }
    }

    // Momentum surge detection
    if (prices.length >= 5) {
      const price5Ago = prices[prices.length - 5];
      if (price5Ago === undefined) return signals;
      const priceChange5 = ((data.price - price5Ago) / price5Ago) * 100;
      if (Math.abs(priceChange5) >= 2) {
        signals.push(this.createSignal(
          data.symbol,
          SignalType.MOMENTUM_SURGE,
          priceChange5 > 0 ? SignalDirection.LONG : SignalDirection.SHORT,
          Math.min(Math.abs(priceChange5) * 15, 100),
          data.price,
          SignalUrgency.HIGH,
          { indicator: 'momentum', value: priceChange5 }
        ));
      }
    }
    
    return signals;
  }

  /**
   * Check volume-based signals
   */
  private checkVolumeSignals(data: PriceData, history: PriceHistory): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const volumes = history.volumes;
    
    if (volumes.length < 20) return signals;
    
    // Calculate average volume
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    
    // Volume spike detection
    if (data.volume > avgVolume * VOLUME_SPIKE_MULTIPLIER) {
      const spikeMultiplier = data.volume / avgVolume;
      const latestPrices = history.prices.slice(-3);
      const lastPrice = latestPrices[latestPrices.length - 1];
      const firstPrice = latestPrices[0];
      const priceDirection = (lastPrice !== undefined && firstPrice !== undefined && lastPrice > firstPrice)
        ? SignalDirection.LONG 
        : SignalDirection.SHORT;
      
      signals.push(this.createSignal(
        data.symbol,
        SignalType.VOLUME_SPIKE,
        priceDirection,
        Math.min(spikeMultiplier * 20, 100),
        data.price,
        spikeMultiplier > 4 ? SignalUrgency.HIGH : SignalUrgency.MEDIUM,
        { indicator: 'volume', value: spikeMultiplier, threshold: VOLUME_SPIKE_MULTIPLIER }
      ));
    }
    
    return signals;
  }

  /**
   * Check RSI signals
   */
  private checkRSISignals(symbol: string, rsi: number, prevRsi?: number): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const price = this.getLatestPrice(symbol) || 0;
    
    // Oversold
    if (rsi < 30) {
      const strength = Math.min((30 - rsi) * 5, 100);
      signals.push(this.createSignal(
        symbol,
        SignalType.RSI_OVERSOLD,
        SignalDirection.LONG,
        strength,
        price,
        rsi < 20 ? SignalUrgency.HIGH : SignalUrgency.MEDIUM,
        { indicator: 'RSI', value: rsi, threshold: 30 }
      ));
    }
    
    // Overbought
    if (rsi > 70) {
      const strength = Math.min((rsi - 70) * 5, 100);
      signals.push(this.createSignal(
        symbol,
        SignalType.RSI_OVERBOUGHT,
        SignalDirection.SHORT,
        strength,
        price,
        rsi > 80 ? SignalUrgency.HIGH : SignalUrgency.MEDIUM,
        { indicator: 'RSI', value: rsi, threshold: 70 }
      ));
    }
    
    return signals;
  }

  /**
   * Check MACD signals
   */
  private checkMACDSignals(
    symbol: string, 
    macd: { value: number; signal: number; histogram: number },
    prevMacd: { value: number; signal: number; histogram: number }
  ): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const price = this.getLatestPrice(symbol) || 0;
    
    // Bullish crossover (MACD crosses above signal)
    if (prevMacd.value <= prevMacd.signal && macd.value > macd.signal) {
      signals.push(this.createSignal(
        symbol,
        SignalType.MACD_BULLISH_CROSS,
        SignalDirection.LONG,
        70,
        price,
        SignalUrgency.HIGH,
        { indicator: 'MACD', value: macd.histogram }
      ));
    }
    
    // Bearish crossover (MACD crosses below signal)
    if (prevMacd.value >= prevMacd.signal && macd.value < macd.signal) {
      signals.push(this.createSignal(
        symbol,
        SignalType.MACD_BEARISH_CROSS,
        SignalDirection.SHORT,
        70,
        price,
        SignalUrgency.HIGH,
        { indicator: 'MACD', value: macd.histogram }
      ));
    }
    
    return signals;
  }

  /**
   * Check Bollinger Band signals
   */
  private checkBBandSignals(
    symbol: string,
    price: number,
    bbands: { upper: number; middle: number; lower: number }
  ): TradingSignal[] {
    const signals: TradingSignal[] = [];
    
    // Price touches lower band (potential bounce)
    if (price <= bbands.lower * 1.005) {
      const distancePct = ((bbands.lower - price) / bbands.lower) * 100;
      signals.push(this.createSignal(
        symbol,
        SignalType.BB_LOWER_TOUCH,
        SignalDirection.LONG,
        Math.min(60 + distancePct * 10, 100),
        price,
        SignalUrgency.MEDIUM,
        { indicator: 'BBands', value: price, threshold: bbands.lower }
      ));
    }
    
    // Price touches upper band (potential reversal)
    if (price >= bbands.upper * 0.995) {
      const distancePct = ((price - bbands.upper) / bbands.upper) * 100;
      signals.push(this.createSignal(
        symbol,
        SignalType.BB_UPPER_TOUCH,
        SignalDirection.SHORT,
        Math.min(60 + distancePct * 10, 100),
        price,
        SignalUrgency.MEDIUM,
        { indicator: 'BBands', value: price, threshold: bbands.upper }
      ));
    }
    
    return signals;
  }

  /**
   * Check EMA crossover signals
   */
  private checkEMASignals(symbol: string, current: IndicatorData, prev: IndicatorData): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const price = this.getLatestPrice(symbol) || 0;
    
    if (!current.ema20 || !current.ema50 || !prev.ema20 || !prev.ema50) return signals;
    
    // Golden cross (EMA20 crosses above EMA50)
    if (prev.ema20 <= prev.ema50 && current.ema20 > current.ema50) {
      signals.push(this.createSignal(
        symbol,
        SignalType.TREND_REVERSAL,
        SignalDirection.LONG,
        75,
        price,
        SignalUrgency.HIGH,
        { indicator: 'EMA', value: current.ema20 - current.ema50 }
      ));
    }
    
    // Death cross (EMA20 crosses below EMA50)
    if (prev.ema20 >= prev.ema50 && current.ema20 < current.ema50) {
      signals.push(this.createSignal(
        symbol,
        SignalType.TREND_REVERSAL,
        SignalDirection.SHORT,
        75,
        price,
        SignalUrgency.HIGH,
        { indicator: 'EMA', value: current.ema20 - current.ema50 }
      ));
    }
    
    return signals;
  }

  /**
   * Create a trading signal
   */
  private createSignal(
    symbol: string,
    type: SignalType,
    direction: SignalDirection,
    strength: number,
    price: number,
    urgency: SignalUrgency,
    metadata: TradingSignal['metadata']
  ): TradingSignal {
    return {
      id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      type,
      direction,
      urgency,
      strength: Math.round(strength),
      price,
      timestamp: Date.now(),
      metadata,
      expiry: Date.now() + SIGNAL_EXPIRY_MS
    };
  }

  /**
   * Update price history
   */
  private updatePriceHistory(data: PriceData): void {
    let history = this.priceHistory.get(data.symbol);
    
    if (!history) {
      history = { prices: [], volumes: [], timestamps: [], maxSize: PRICE_HISTORY_SIZE };
      this.priceHistory.set(data.symbol, history);
    }
    
    history.prices.push(data.price);
    history.volumes.push(data.volume);
    history.timestamps.push(data.timestamp);
    
    // Trim to max size
    if (history.prices.length > history.maxSize) {
      history.prices.shift();
      history.volumes.shift();
      history.timestamps.shift();
    }
  }

  /**
   * Get latest price for symbol
   */
  private getLatestPrice(symbol: string): number | null {
    const history = this.priceHistory.get(symbol);
    if (!history || history.prices.length === 0) return null;
    const price = history.prices[history.prices.length - 1];
    return price !== undefined ? price : null;
  }

  /**
   * Store signals and emit events
   */
  private storeSignals(symbol: string, signals: TradingSignal[]): void {
    if (signals.length === 0) return;
    
    // Store active signals
    let active = this.activeSignals.get(symbol) || [];
    active = active.filter(s => s.expiry > Date.now()); // Remove expired
    active.push(...signals);
    this.activeSignals.set(symbol, active);
    
    // Store to history
    this.signalHistory.push(...signals);
    if (this.signalHistory.length > 1000) {
      this.signalHistory = this.signalHistory.slice(-500);
    }
    
    // Emit signals
    for (const signal of signals) {
      this.emit('signal', signal);
      
      if (signal.urgency >= SignalUrgency.HIGH) {
        this.emit('urgent-signal', signal);
        logger.info(`HIGH URGENCY SIGNAL: ${signal.symbol} ${signal.type} ${signal.direction} (${signal.strength}%)`);
      }
    }
  }

  /**
   * Get active signals for a symbol
   */
  getActiveSignals(symbol?: string): TradingSignal[] {
    const now = Date.now();
    
    if (symbol) {
      return (this.activeSignals.get(symbol) || []).filter(s => s.expiry > now);
    }
    
    const allSignals: TradingSignal[] = [];
    for (const signals of this.activeSignals.values()) {
      allSignals.push(...signals.filter(s => s.expiry > now));
    }
    return allSignals;
  }

  /**
   * Get aggregated signal direction for a symbol
   */
  getAggregatedDirection(symbol: string): { direction: SignalDirection; confidence: number } {
    const signals = this.getActiveSignals(symbol);
    if (signals.length === 0) {
      return { direction: SignalDirection.NEUTRAL, confidence: 0 };
    }
    
    let longScore = 0;
    let shortScore = 0;
    
    for (const signal of signals) {
      const weight = signal.strength * signal.urgency;
      if (signal.direction === SignalDirection.LONG) {
        longScore += weight;
      } else if (signal.direction === SignalDirection.SHORT) {
        shortScore += weight;
      }
    }
    
    const total = longScore + shortScore;
    if (total === 0) return { direction: SignalDirection.NEUTRAL, confidence: 0 };
    
    if (longScore > shortScore) {
      return { direction: SignalDirection.LONG, confidence: (longScore / total) * 100 };
    } else if (shortScore > longScore) {
      return { direction: SignalDirection.SHORT, confidence: (shortScore / total) * 100 };
    }
    
    return { direction: SignalDirection.NEUTRAL, confidence: 50 };
  }

  /**
   * Get signal statistics
   */
  getStats(): {
    totalSignals: number;
    activeSignals: number;
    byType: Record<string, number>;
    byDirection: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const byDirection: Record<string, number> = {};
    
    for (const signal of this.signalHistory.slice(-100)) {
      byType[signal.type] = (byType[signal.type] || 0) + 1;
      byDirection[signal.direction] = (byDirection[signal.direction] || 0) + 1;
    }
    
    return {
      totalSignals: this.signalHistory.length,
      activeSignals: this.getActiveSignals().length,
      byType,
      byDirection
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.priceHistory.clear();
    this.lastIndicators.clear();
    this.activeSignals.clear();
    this.signalHistory = [];
  }
}

export const signalProcessor = new SignalProcessor();
