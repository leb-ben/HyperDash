import { logger } from '../utils/logger.js';
import { realisticPaperTrader, RealisticPaperTrader } from './realisticPaperTrader.js';
import { realtimeFeed } from './realtimeFeed.js';

export type TradingMode = 'simulation' | 'realistic_paper' | 'live';

export interface TradingModeConfig {
  mode: TradingMode;
  initialBalance?: number;
  aggressiveMode: boolean;
  confirmationDelayMs: number;
  marketOrderFeeMultiplier: number;
}

export class TradingModeManager {
  private currentMode: TradingMode;
  private realisticTrader: RealisticPaperTrader | undefined;
  private config: TradingModeConfig;
  private lastOrderProcessing: number = 0;
  private readonly ORDER_PROCESSING_INTERVAL_MS = 10000; // Check pending orders every 10 seconds

  constructor() {
    this.currentMode = this.determineMode();
    this.config = this.loadConfig();
    
    if (this.currentMode === 'realistic_paper') {
      this.realisticTrader = new RealisticPaperTrader(this.config.initialBalance || 100);
    }
    
    logger.info(`Trading Mode Manager initialized: ${this.currentMode}`);
    logger.info(`⚙️  Config: ${JSON.stringify(this.config)}`);
  }

  private determineMode(): TradingMode {
    // Always live trading on testnet since paper trading removed
    return 'live';
  }

  private loadConfig(): TradingModeConfig {
    return {
      mode: this.currentMode,
      initialBalance: parseFloat(process.env.INITIAL_PAPER_BALANCE || '100'),
      aggressiveMode: process.env.AGGRESSIVE_TRADING === 'true',
      confirmationDelayMs: parseInt(process.env.CONFIRMATION_DELAY_MS || '60000'), // 1 minute
      marketOrderFeeMultiplier: parseFloat(process.env.MARKET_FEE_MULTIPLIER || '2.0')
    };
  }

  /**
   * Place a buy order using the current trading mode
   */
  async placeBuyOrder(symbol: string, usdtAmount: number, orderType: 'limit' | 'market', limitPrice?: number): Promise<{ success: boolean; orderId?: string; message: string }> {
    switch (this.currentMode) {
      case 'realistic_paper':
        if (!this.realisticTrader) {
          return { success: false, message: 'Realistic paper trader not initialized' };
        }
        if (orderType === 'limit' && limitPrice) {
          return await this.realisticTrader.placeLimitOrder(symbol, 'buy', usdtAmount, limitPrice);
        } else {
          const currentPrice = this.getCurrentPrice(symbol);
          if (!currentPrice) {
            return { success: false, message: `No price data available for ${symbol}` };
          }
          return await this.realisticTrader.placeMarketOrder(symbol, 'buy', usdtAmount / currentPrice, currentPrice);
        }

      case 'simulation':
        // Use existing simulation logic
        return this.simulateBuyOrder(symbol, usdtAmount, orderType, limitPrice);

      case 'live':
        return { success: false, message: 'Live trading not implemented yet' };

      default:
        return { success: false, message: `Unknown trading mode: ${this.currentMode}` };
    }
  }

  /**
   * Place a sell order using the current trading mode
   */
  async placeSellOrder(symbol: string, cryptoAmount: number, orderType: 'limit' | 'market', limitPrice?: number): Promise<{ success: boolean; orderId?: string; message: string }> {
    switch (this.currentMode) {
      case 'realistic_paper':
        if (!this.realisticTrader) {
          return { success: false, message: 'Realistic paper trader not initialized' };
        }
        if (orderType === 'limit' && limitPrice) {
          return await this.realisticTrader.placeLimitOrder(symbol, 'sell', cryptoAmount, limitPrice);
        } else {
          const currentPrice = this.getCurrentPrice(symbol);
          if (!currentPrice) {
            return { success: false, message: `No price data available for ${symbol}` };
          }
          return await this.realisticTrader.placeMarketOrder(symbol, 'sell', cryptoAmount, currentPrice);
        }

      case 'simulation':
        return this.simulateSellOrder(symbol, cryptoAmount, orderType, limitPrice);

      case 'live':
        return { success: false, message: 'Live trading not implemented yet' };

      default:
        return { success: false, message: `Unknown trading mode: ${this.currentMode}` };
    }
  }

  /**
   * Process pending orders (called by main trading loop)
   */
  processPendingOrders(): Array<{ orderId: string; executed: boolean; message: string }> {
    if (this.currentMode !== 'realistic_paper') {
      return [];
    }
    
    if (!this.realisticTrader) {
      return [];
    }

    const now = Date.now();
    if (now - this.lastOrderProcessing < this.ORDER_PROCESSING_INTERVAL_MS) {
      return []; // Not time to process yet
    }

    this.lastOrderProcessing = now;
    const currentPrices = realtimeFeed.getAllPrices();
    
    // Convert PriceUpdate objects to numbers for realisticTrader
    const priceMap = new Map<string, number>();
    currentPrices.forEach((priceUpdate, symbol) => {
      priceMap.set(symbol, priceUpdate.price);
    });
    
    const results = this.realisticTrader.processPendingOrders(priceMap);
    
    if (results.length > 0) {
      logger.info(`Processed ${results.length} pending orders`);
    }

    return results;
  }

  /**
   * Get current portfolio state based on trading mode
   */
  getPortfolioState(): any {
    switch (this.currentMode) {
      case 'realistic_paper':
        if (!this.realisticTrader) {
          return { error: 'Realistic paper trader not initialized' };
        }
        return this.realisticTrader.getPortfolioState();
      case 'simulation':
        return { error: 'Simulation mode not available - using live trading only' };
      case 'live':
        return { error: 'Live trading not implemented yet' };
      default:
        return { error: `Unknown trading mode: ${this.currentMode}` };
    }
  }

  /**
   * Get 24-hour performance report
   */
  get24HourPerformance(): any {
    switch (this.currentMode) {
      case 'realistic_paper':
        if (!this.realisticTrader) {
          return { error: 'Realistic paper trader not initialized' };
        }
        return this.realisticTrader.get24HourPerformance();
      case 'simulation':
        return this.getSimulationPerformance();
      case 'live':
        return { error: 'Live trading not implemented yet' };
      default:
        return { error: `Unknown trading mode: ${this.currentMode}` };
    }
  }

  /**
   * Cancel a pending order
   */
  cancelOrder(orderId: string): { success: boolean; message: string } {
    if (this.currentMode !== 'realistic_paper') {
      return { success: false, message: 'Order cancellation only available in realistic paper trading mode' };
    }

    if (!this.realisticTrader) {
      return { success: false, message: 'Realistic paper trader not initialized' };
    }

    return this.realisticTrader.cancelOrder(orderId);
  }

  /**
   * Reset portfolio for new testing
   */
  resetPortfolio(initialBalance?: number): void {
    if (this.currentMode === 'realistic_paper') {
      if (!this.realisticTrader) {
        logger.error('Realistic paper trader not initialized');
        return;
      }
      this.realisticTrader.resetPortfolio(initialBalance || this.config.initialBalance);
    } else if (this.currentMode === 'simulation') {
      // Reset simulation portfolio
      logger.info('Simulation portfolio reset');
    }
  }

  private getCurrentPrice(symbol: string): number | null {
    const priceData = realtimeFeed.getAllPrices().get(symbol);
    return priceData ? priceData.price : null;
  }

  private simulateBuyOrder(symbol: string, usdtAmount: number, orderType: 'limit' | 'market', limitPrice?: number): { success: boolean; orderId?: string; message: string } {
    // Existing simulation logic from paperPortfolio
    const currentPrice = this.getCurrentPrice(symbol);
    if (!currentPrice) {
      return { success: false, message: `No price data for ${symbol}` };
    }

    const cryptoAmount = usdtAmount / currentPrice;
    const orderId = `sim_${Date.now()}`;
    
    // Simulate immediate execution for simulation mode
    logger.info(`Simulation: Buy ${cryptoAmount.toFixed(6)} ${symbol} at $${currentPrice}`);
    
    return { 
      success: true, 
      orderId, 
      message: `Simulation buy order executed immediately at $${currentPrice}` 
    };
  }

  private simulateSellOrder(symbol: string, cryptoAmount: number, orderType: 'limit' | 'market', limitPrice?: number): { success: boolean; orderId?: string; message: string } {
    const currentPrice = this.getCurrentPrice(symbol);
    if (!currentPrice) {
      return { success: false, message: `No price data for ${symbol}` };
    }

    const orderId = `sim_${Date.now()}`;
    
    // Simulate immediate execution for simulation mode
    logger.info(`Simulation: Sell ${cryptoAmount.toFixed(6)} ${symbol} at $${currentPrice}`);
    
    return { 
      success: true, 
      orderId, 
      message: `Simulation sell order executed immediately at $${currentPrice}` 
    };
  }

  private getSimulationPerformance(): any {
    return {
      error: 'Simulation performance not available - using live trading only',
      mode: 'live'
    };
  }

  /**
   * Get current trading mode
   */
  getCurrentMode(): TradingMode {
    return this.currentMode;
  }

  /**
   * Get trading configuration
   */
  getConfig(): TradingModeConfig {
    return { ...this.config };
  }

  /**
   * Check if aggressive trading is enabled
   */
  isAggressiveMode(): boolean {
    return this.config.aggressiveMode;
  }

  /**
   * Get confirmation delay for current mode
   */
  getConfirmationDelay(): number {
    return this.config.confirmationDelayMs;
  }
}

export const tradingModeManager = new TradingModeManager();
