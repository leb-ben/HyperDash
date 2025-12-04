/**
 * Real-time Price Feed
 * 
 * Provides real-time price updates with:
 * - WebSocket connection management
 * - Automatic reconnection
 * - Price update batching
 * - Health monitoring
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { errorHandler } from './errorHandler.js';
import { signalProcessor, type PriceData } from './signalProcessor.js';

interface FeedConfig {
  symbols: string[];
  updateIntervalMs: number;
  reconnectDelayMs: number;
  maxReconnectAttempts: number;
}

interface PriceUpdate {
  symbol: string;
  price: number;
  volume24h: number;
  change24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

const DEFAULT_CONFIG: FeedConfig = {
  symbols: ['BTC', 'ETH', 'SOL', 'HYPE', 'JUP'],
  updateIntervalMs: 5000, // 5 second updates
  reconnectDelayMs: 5000,
  maxReconnectAttempts: 10
};

class RealtimeFeed extends EventEmitter {
  private config: FeedConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private updateInterval: NodeJS.Timeout | null = null;
  private lastPrices: Map<string, PriceUpdate> = new Map();
  private priceCallbacks: ((update: PriceUpdate) => void)[] = [];

  constructor(config: Partial<FeedConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setMaxListeners(50);
  }

  /**
   * Start the real-time feed
   */
  async start(): Promise<void> {
    logger.info('Starting real-time price feed...');
    
    try {
      await this.connect();
      this.startUpdateLoop();
      logger.info(`Real-time feed active for: ${this.config.symbols.join(', ')}`);
    } catch (error) {
      errorHandler.processError(error, {
        operation: 'start',
        component: 'RealtimeFeed'
      });
      throw error;
    }
  }

  /**
   * Stop the feed
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isConnected = false;
    logger.info('Real-time feed stopped');
  }

  /**
   * Connect to price source
   */
  private async connect(): Promise<void> {
    // For now, simulate connection
    // In production, this would connect to Hyperliquid WebSocket
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.emit('connected');
  }

  /**
   * Start the update loop
   */
  private startUpdateLoop(): void {
    // Initial fetch
    this.fetchPrices();
    
    // Periodic updates
    this.updateInterval = setInterval(
      () => this.fetchPrices(),
      this.config.updateIntervalMs
    );
  }

  /**
   * Fetch latest prices
   */
  private async fetchPrices(): Promise<void> {
    if (!this.isConnected) return;

    try {
      // In production, this fetches from the exchange
      // For now, simulate with mock data that has realistic movements
      for (const symbol of this.config.symbols) {
        const update = this.generatePriceUpdate(symbol);
        this.processPriceUpdate(update);
      }
    } catch (error) {
      errorHandler.processError(error, {
        operation: 'fetchPrices',
        component: 'RealtimeFeed'
      });
      
      // Attempt reconnect on failure
      this.handleDisconnect();
    }
  }

  /**
   * Generate realistic price update (mock for development)
   */
  private generatePriceUpdate(symbol: string): PriceUpdate {
    const basePrices: Record<string, number> = {
      'BTC': 95000,
      'ETH': 3400,
      'SOL': 240,
      'HYPE': 28,
      'JUP': 1.2,
      'DOGE': 0.40,
      'AVAX': 45,
      'LINK': 18
    };

    const lastPrice = this.lastPrices.get(symbol);
    const basePrice = lastPrice?.price || basePrices[symbol] || 100;
    
    // Simulate realistic price movement (random walk with mean reversion)
    const volatility = symbol === 'BTC' ? 0.001 : 0.002;
    const drift = (Math.random() - 0.5) * 2 * volatility;
    const newPrice = basePrice * (1 + drift);
    
    // Volume varies randomly
    const baseVolume = basePrice * 1000000;
    const volume = baseVolume * (0.5 + Math.random());

    return {
      symbol,
      price: Number(newPrice.toFixed(symbol === 'BTC' ? 2 : symbol === 'ETH' ? 2 : 4)),
      volume24h: volume,
      change24h: lastPrice ? ((newPrice - lastPrice.price) / lastPrice.price) * 100 : 0,
      high24h: newPrice * 1.02,
      low24h: newPrice * 0.98,
      timestamp: Date.now()
    };
  }

  /**
   * Process and emit price update
   */
  private processPriceUpdate(update: PriceUpdate): void {
    // Store last price
    this.lastPrices.set(update.symbol, update);
    
    // Emit event
    this.emit('price', update);
    
    // Notify callbacks
    for (const callback of this.priceCallbacks) {
      try {
        callback(update);
      } catch (e) {
        // Don't let callback errors break the feed
      }
    }
    
    // Feed to signal processor
    const priceData: PriceData = {
      symbol: update.symbol,
      price: update.price,
      volume: update.volume24h,
      timestamp: update.timestamp,
      high24h: update.high24h,
      low24h: update.low24h,
      change24h: update.change24h
    };
    
    signalProcessor.processPriceUpdate(priceData);
  }

  /**
   * Handle disconnect
   */
  private async handleDisconnect(): Promise<void> {
    this.isConnected = false;
    this.emit('disconnected');
    
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached');
      this.emit('error', new Error('Max reconnect attempts reached'));
      return;
    }
    
    this.reconnectAttempts++;
    logger.warn(`Reconnecting... attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`);
    
    await this.sleep(this.config.reconnectDelayMs);
    
    try {
      await this.connect();
    } catch (error) {
      this.handleDisconnect();
    }
  }

  /**
   * Subscribe to price updates
   */
  onPrice(callback: (update: PriceUpdate) => void): void {
    this.priceCallbacks.push(callback);
  }

  /**
   * Add symbol to feed
   */
  addSymbol(symbol: string): void {
    if (!this.config.symbols.includes(symbol)) {
      this.config.symbols.push(symbol);
      logger.info(`Added ${symbol} to real-time feed`);
    }
  }

  /**
   * Remove symbol from feed
   */
  removeSymbol(symbol: string): void {
    const index = this.config.symbols.indexOf(symbol);
    if (index > -1) {
      this.config.symbols.splice(index, 1);
      this.lastPrices.delete(symbol);
      logger.info(`Removed ${symbol} from real-time feed`);
    }
  }

  /**
   * Get current symbols
   */
  getSymbols(): string[] {
    return [...this.config.symbols];
  }

  /**
   * Get latest price for symbol
   */
  getLatestPrice(symbol: string): PriceUpdate | null {
    return this.lastPrices.get(symbol) || null;
  }

  /**
   * Get all latest prices
   */
  getAllPrices(): Map<string, PriceUpdate> {
    return new Map(this.lastPrices);
  }

  /**
   * Check if connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get feed health status
   */
  getHealth(): { connected: boolean; symbols: number; lastUpdate: number } {
    let lastUpdate = 0;
    for (const update of this.lastPrices.values()) {
      if (update.timestamp > lastUpdate) {
        lastUpdate = update.timestamp;
      }
    }
    
    return {
      connected: this.isConnected,
      symbols: this.config.symbols.length,
      lastUpdate
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const realtimeFeed = new RealtimeFeed();
