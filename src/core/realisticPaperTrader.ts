import { logger } from '../utils/logger.js';
import { feesCalculator } from './tradingFees.js';

export interface PendingOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  amount: number; // USDT amount for buys, crypto amount for sells
  price?: number; // For limit orders
  timestamp: number;
  executeAfter: number; // 1 minute delay for confirmations
  feeMultiplier: number; // 1x for limit, 2x for market
  status: 'pending' | 'executed' | 'cancelled';
}

export interface RealisticPortfolio {
  usdtBalance: number;
  positions: Map<string, number>; // symbol -> amount
  pendingOrders: Map<string, PendingOrder>;
  totalFeesPaid: number;
  tradeHistory: Array<{
    timestamp: number;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'limit' | 'market';
    amount: number;
    price: number;
    fee: number;
    executionDelay: number;
  }>;
}

export class RealisticPaperTrader {
  private portfolio: RealisticPortfolio;
  private readonly CONFIRMATION_DELAY_MS = 60000; // 1 minute
  private readonly INITIAL_USDT = 100; // Starting balance

  constructor(initialUsdt: number = 100) {
    this.portfolio = {
      usdtBalance: initialUsdt,
      positions: new Map(),
      pendingOrders: new Map(),
      totalFeesPaid: 0,
      tradeHistory: []
    };
    
    logger.info(`Realistic Paper Trader initialized with $${initialUsdt} USDT`);
  }

  /**
   * Place a limit order (1 minute confirmation delay)
   */
  async placeLimitOrder(symbol: string, side: 'buy' | 'sell', amount: number, price: number): Promise<{ success: boolean; orderId?: string; message: string }> {
    const orderId = `limit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    // Calculate fees
    const orderValue = side === 'buy' ? amount : amount * price;
    const fees = feesCalculator.calculateTradeCosts(orderValue, side === 'buy' ? 'long' : 'short', false, price || 0).tradingFee;
    
    // Check balance for buy orders
    if (side === 'buy') {
      const totalCost = amount + fees;
      if (this.portfolio.usdtBalance < totalCost) {
        return { success: false, message: `Insufficient USDT balance. Need $${totalCost.toFixed(2)}, have $${this.portfolio.usdtBalance.toFixed(2)}` };
      }
    }
    
    // Check position for sell orders
    if (side === 'sell') {
      const currentPosition = this.portfolio.positions.get(symbol) || 0;
      if (currentPosition < amount) {
        return { success: false, message: `Insufficient ${symbol} position. Have ${currentPosition}, trying to sell ${amount}` };
      }
    }

    const pendingOrder: PendingOrder = {
      id: orderId,
      symbol,
      side,
      type: 'limit',
      amount,
      price,
      timestamp: now,
      executeAfter: now + this.CONFIRMATION_DELAY_MS,
      feeMultiplier: 1.0, // Normal fees for limit orders
      status: 'pending'
    };

    this.portfolio.pendingOrders.set(orderId, pendingOrder);
    
    logger.info(`Limit order placed: ${side} ${amount} ${symbol} at $${price} (executes in 1 minute)`);
    
    return { 
      success: true, 
      orderId, 
      message: `Limit order placed. Will execute in 1 minute if conditions are met. Fees: $${fees.toFixed(2)}` 
    };
  }

  /**
   * Place a market order (doubled fees, 1 minute confirmation delay)
   */
  async placeMarketOrder(symbol: string, side: 'buy' | 'sell', amount: number, currentPrice: number): Promise<{ success: boolean; orderId?: string; message: string }> {
    const orderId = `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    // Calculate fees with 2x multiplier for market orders
    const orderValue = side === 'buy' ? amount * currentPrice : amount * currentPrice;
    const baseFees = feesCalculator.calculateTradeCosts(orderValue, side === 'buy' ? 'long' : 'short', true, currentPrice).tradingFee;
    const fees = baseFees * 2; // Double fees for market orders
    
    // Check balance for buy orders
    if (side === 'buy') {
      const totalCost = (amount * currentPrice) + fees;
      if (this.portfolio.usdtBalance < totalCost) {
        return { success: false, message: `Insufficient USDT balance. Need $${totalCost.toFixed(2)}, have $${this.portfolio.usdtBalance.toFixed(2)}` };
      }
    }
    
    // Check position for sell orders
    if (side === 'sell') {
      const currentPosition = this.portfolio.positions.get(symbol) || 0;
      if (currentPosition < amount) {
        return { success: false, message: `Insufficient ${symbol} position. Have ${currentPosition}, trying to sell ${amount}` };
      }
    }

    const pendingOrder: PendingOrder = {
      id: orderId,
      symbol,
      side,
      type: 'market',
      amount,
      timestamp: now,
      executeAfter: now + this.CONFIRMATION_DELAY_MS,
      feeMultiplier: 2.0, // Double fees for market orders
      status: 'pending'
    };

    this.portfolio.pendingOrders.set(orderId, pendingOrder);
    
    logger.info(`Market order placed: ${side} ${amount} ${symbol} at ~$${currentPrice} (executes in 1 minute, 2x fees: $${fees.toFixed(2)})`);
    
    return { 
      success: true, 
      orderId, 
      message: `Market order placed. Will execute in 1 minute. Fees: $${fees.toFixed(2)} (2x market penalty)` 
    };
  }

  /**
   * Process pending orders that are ready to execute
   */
  processPendingOrders(currentMarketPrices: Map<string, number>): Array<{ orderId: string; executed: boolean; message: string }> {
    const results: Array<{ orderId: string; executed: boolean; message: string }> = [];
    const now = Date.now();
    
    for (const [orderId, order] of this.portfolio.pendingOrders.entries()) {
      if (order.status !== 'pending' || now < order.executeAfter) {
        continue;
      }

      const currentPrice = currentMarketPrices.get(order.symbol);
      if (!currentPrice) {
        results.push({ orderId, executed: false, message: `No price data for ${order.symbol}` });
        continue;
      }

      // Execute order based on type
      if (order.type === 'limit') {
        const shouldExecute = order.side === 'buy' ? currentPrice <= (order.price || 0) : currentPrice >= (order.price || 0);
        
        if (shouldExecute) {
          const result = this.executeOrder(order, currentPrice);
          results.push({ orderId, executed: result.success, message: result.message });
        } else {
          results.push({ orderId, executed: false, message: `Limit order conditions not met. Current: $${currentPrice}, Limit: $${order.price}` });
        }
      } else {
        // Market orders always execute at current price
        const result = this.executeOrder(order, currentPrice);
        results.push({ orderId, executed: result.success, message: result.message });
      }
    }

    return results;
  }

  private executeOrder(order: PendingOrder, executionPrice: number): { success: boolean; message: string } {
    try {
      const orderValue = order.side === 'buy' ? order.amount * executionPrice : order.amount * executionPrice;
      const fees = feesCalculator.calculateTradeCosts(orderValue, order.side === 'buy' ? 'long' : 'short', order.type === 'market', executionPrice).tradingFee * order.feeMultiplier;
      const executionDelay = Date.now() - order.timestamp;

      if (order.side === 'buy') {
        // Buy: deduct USDT, add crypto
        const totalCost = (order.amount * executionPrice) + fees;
        this.portfolio.usdtBalance -= totalCost;
        
        const currentCryptoAmount = this.portfolio.positions.get(order.symbol) || 0;
        this.portfolio.positions.set(order.symbol, currentCryptoAmount + order.amount);
        
      } else {
        // Sell: deduct crypto, add USDT
        const currentCryptoAmount = this.portfolio.positions.get(order.symbol) || 0;
        this.portfolio.positions.set(order.symbol, currentCryptoAmount - order.amount);
        
        const usdtReceived = (order.amount * executionPrice) - fees;
        this.portfolio.usdtBalance += usdtReceived;
      }

      // Update order status
      order.status = 'executed';
      
      // Record trade
      this.portfolio.tradeHistory.push({
        timestamp: Date.now(),
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        amount: order.amount,
        price: executionPrice,
        fee: fees,
        executionDelay
      });

      this.portfolio.totalFeesPaid += fees;

      logger.info(`Order executed: ${order.side} ${order.amount} ${order.symbol} at $${executionPrice}, fees: $${fees.toFixed(2)}`);
      
      // Immediately save state after trade execution to prevent data loss
      import('./statePersistence.js').then(({ statePersistence }) => {
        statePersistence.saveState();
      });
      
      return { success: true, message: `Order executed at $${executionPrice}, fees: $${fees.toFixed(2)}` };
      
    } catch (error: any) {
      logger.error('Order execution failed:', error);
      return { success: false, message: `Execution failed: ${error.message}` };
    }
  }

  /**
   * Cancel a pending order
   */
  cancelOrder(orderId: string): { success: boolean; message: string } {
    const order = this.portfolio.pendingOrders.get(orderId);
    
    if (!order) {
      return { success: false, message: `Order ${orderId} not found` };
    }

    if (order.status !== 'pending') {
      return { success: false, message: `Order ${orderId} is ${order.status} and cannot be cancelled` };
    }

    order.status = 'cancelled';
    logger.info(`❌ Order cancelled: ${orderId}`);
    
    return { success: true, message: `Order ${orderId} cancelled successfully` };
  }

  /**
   * Get current portfolio state
   */
  getPortfolioState(): RealisticPortfolio & { 
    totalValueUsdt: number; 
    pendingOrdersCount: number; 
    tradesExecuted: number;
    profitLoss: number;
  } {
    const totalValueUsdt = this.portfolio.usdtBalance + this.calculatePositionsValue();
    const profitLoss = totalValueUsdt - this.INITIAL_USDT;
    
    return {
      ...this.portfolio,
      totalValueUsdt,
      pendingOrdersCount: Array.from(this.portfolio.pendingOrders.values()).filter(o => o.status === 'pending').length,
      tradesExecuted: this.portfolio.tradeHistory.length,
      profitLoss
    };
  }

  private calculatePositionsValue(): number {
    // This would use current market prices - for now, estimate based on last trade prices
    let totalValue = 0;
    
    for (const [symbol, amount] of this.portfolio.positions.entries()) {
      if (amount > 0) {
        // Get last trade price for this symbol or use a mock price
        const lastTrade = this.portfolio.tradeHistory
          .filter(t => t.symbol === symbol)
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        
        if (lastTrade) {
          totalValue += amount * lastTrade.price;
        } else {
          // Mock price if no trades yet
          totalValue += amount * 50000; // Default BTC price estimate
        }
      }
    }
    
    return totalValue;
  }

  /**
   * Get 24-hour performance summary
   */
  get24HourPerformance(): {
    startTime: number;
    endTime: number;
    startingBalance: number;
    endingBalance: number;
    profitLoss: number;
    profitLossPercent: number;
    totalFees: number;
    tradesExecuted: number;
    feeToProfitRatio: number;
  } {
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    
    const recentTrades = this.portfolio.tradeHistory.filter(t => t.timestamp >= twentyFourHoursAgo);
    const recentFees = recentTrades.reduce((sum, t) => sum + t.fee, 0);
    
    const currentPortfolio = this.getPortfolioState();
    const profitLoss = currentPortfolio.profitLoss;
    const profitLossPercent = (profitLoss / this.INITIAL_USDT) * 100;
    
    return {
      startTime: twentyFourHoursAgo,
      endTime: now,
      startingBalance: this.INITIAL_USDT,
      endingBalance: currentPortfolio.totalValueUsdt,
      profitLoss,
      profitLossPercent,
      totalFees: recentFees,
      tradesExecuted: recentTrades.length,
      feeToProfitRatio: profitLoss > 0 ? recentFees / profitLoss : 0
    };
  }

  /**
   * Reset portfolio for new test
   */
  resetPortfolio(initialUsdt: number = 100): void {
    this.portfolio = {
      usdtBalance: initialUsdt,
      positions: new Map(),
      pendingOrders: new Map(),
      totalFeesPaid: 0,
      tradeHistory: []
    };
    
    logger.info(`Portfolio reset with $${initialUsdt} USDT`);
  }

  /**
   * Restore a position (for state recovery)
   */
  restorePosition(symbol: string, amount: number): void {
    this.portfolio.positions.set(symbol, amount);
    logger.info(`Restored position: ${symbol} = ${amount}`);
  }

  /**
   * Restore a pending order (for state recovery)
   */
  restorePendingOrder(order: PendingOrder): void {
    this.portfolio.pendingOrders.set(order.id, order);
    logger.info(`Restored pending order: ${order.id} (${order.type} ${order.side} ${order.symbol})`);
  }

  /**
   * Get complete portfolio state for persistence
   */
  getCompleteState(): RealisticPortfolio {
    return {
      ...this.portfolio,
      positions: new Map(this.portfolio.positions),
      pendingOrders: new Map(this.portfolio.pendingOrders),
      tradeHistory: [...this.portfolio.tradeHistory]
    };
  }

  /**
   * Restore complete portfolio state from persistence
   */
  restoreCompleteState(state: RealisticPortfolio): void {
    this.portfolio = {
      usdtBalance: state.usdtBalance,
      positions: new Map(state.positions),
      pendingOrders: new Map(state.pendingOrders),
      totalFeesPaid: state.totalFeesPaid,
      tradeHistory: [...state.tradeHistory]
    };
    
    logger.info(`Restored complete state: $${state.usdtBalance.toFixed(2)} USDT, ${state.positions.size} positions, ${state.pendingOrders.size} pending orders`);
  }
}

export const realisticPaperTrader = new RealisticPaperTrader();
