import { exchange } from '../exchange/hyperliquid.js';
import { riskManager } from './riskManager.js';
import { dataCollector } from './dataCollector.js';
import { config } from '../config/settings.js';
import { logger, tradeLog } from '../utils/logger.js';
import type { 
  TradeDecision, 
  AIResponse, 
  PortfolioState, 
  Order,
  Trade
} from '../types/index.js';

export class TradeExecutor {
  private pendingOrders: Order[] = [];
  private executedTrades: Trade[] = [];

  async executeDecisions(
    decisions: AIResponse,
    portfolio: PortfolioState
  ): Promise<Trade[]> {
    const trades: Trade[] = [];

    if (decisions.decisions.length === 0) {
      logger.debug('No trading decisions to execute');
      return trades;
    }

    // Sort by urgency and confidence
    const sortedDecisions = [...decisions.decisions].sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return b.confidence - a.confidence;
    });

    for (const decision of sortedDecisions) {
      try {
        const trade = await this.executeDecision(decision, portfolio);
        if (trade) {
          trades.push(trade);
          riskManager.recordTrade(trade);
          
          // Update portfolio for next decision
          portfolio = await exchange.getPortfolioState();
        }
      } catch (error) {
        tradeLog.error(`Execute ${decision.symbol}`, error as Error);
      }
    }

    this.executedTrades.push(...trades);
    return trades;
  }

  private async executeDecision(
    decision: TradeDecision,
    portfolio: PortfolioState
  ): Promise<Trade | null> {
    const currentPrice = await dataCollector.getLatestPrice(decision.symbol);
    
    if (currentPrice <= 0) {
      tradeLog.error(decision.symbol, 'Could not get current price');
      return null;
    }

    // Validate with risk manager
    const riskCheck = riskManager.validateTrade(decision, portfolio, currentPrice);
    
    if (!riskCheck.allowed) {
      logger.warn(`Trade rejected: ${riskCheck.reason}`);
      return null;
    }

    switch (decision.action) {
      case 'BUY':
        return this.executeBuy(decision, portfolio, currentPrice, riskCheck);
      
      case 'SELL':
        return this.executeSell(decision, portfolio, currentPrice);
      
      case 'CLOSE':
        return this.executeClose(decision, currentPrice);
      
      case 'REDUCE':
        return this.executeReduce(decision, portfolio, currentPrice);
      
      case 'HOLD':
        return null;
      
      default:
        logger.warn(`Unknown action: ${decision.action}`);
        return null;
    }
  }

  private async executeBuy(
    decision: TradeDecision,
    portfolio: PortfolioState,
    currentPrice: number,
    riskCheck: { adjustedSize?: number; adjustedLeverage?: number }
  ): Promise<Trade | null> {
    const side = decision.side || 'long';
    const leverage = riskCheck.adjustedLeverage || decision.leverage || config.risk.default_leverage;
    
    // Calculate position size
    const size = riskManager.calculatePositionSize(decision, portfolio, currentPrice);
    
    if (size <= 0) {
      logger.warn(`Position size too small for ${decision.symbol}`);
      return null;
    }

    // Calculate stop loss if not provided
    const stopLoss = decision.stopLoss || riskManager.calculateStopLoss(
      currentPrice,
      side,
      undefined // Would pass ATR here if available
    );

    // Calculate take profit if not provided
    const takeProfit = decision.takeProfit || riskManager.calculateTakeProfit(
      currentPrice,
      side,
      2 // 2:1 risk/reward
    );

    logger.info(
      `Opening ${side} ${decision.symbol}: size=${size.toFixed(6)} @ $${currentPrice} ` +
      `(${leverage}x) SL:$${stopLoss.toFixed(2)} TP:$${takeProfit.toFixed(2)}`
    );

    // Place main order
    const orderSide = side === 'long' ? 'buy' : 'sell';
    const order = await exchange.placeOrder(
      decision.symbol,
      orderSide,
      size,
      'market',
      undefined,
      leverage
    );

    if (!order) {
      return null;
    }

    // Set stop loss
    await exchange.setStopLoss(decision.symbol, stopLoss);
    
    // Set take profit
    if (takeProfit) {
      await exchange.setTakeProfit(decision.symbol, takeProfit);
    }

    return {
      id: order.id,
      orderId: order.id,
      symbol: decision.symbol,
      side: orderSide,
      size,
      price: currentPrice,
      fee: size * currentPrice * 0.0005, // Approximate fee
      realizedPnl: 0,
      timestamp: Date.now()
    };
  }

  private async executeSell(
    decision: TradeDecision,
    portfolio: PortfolioState,
    currentPrice: number
  ): Promise<Trade | null> {
    // SELL means open a short position
    return this.executeBuy(
      { ...decision, side: 'short' },
      portfolio,
      currentPrice,
      {}
    );
  }

  private async executeClose(
    decision: TradeDecision,
    currentPrice: number
  ): Promise<Trade | null> {
    const portfolio = await exchange.getPortfolioState();
    const position = portfolio.positions.find(p => p.symbol === decision.symbol);

    if (!position) {
      logger.warn(`No position to close for ${decision.symbol}`);
      return null;
    }

    logger.info(
      `Closing ${position.side} ${decision.symbol}: size=${position.size} ` +
      `P&L: $${position.unrealizedPnl.toFixed(2)}`
    );

    const success = await exchange.closePosition(decision.symbol);
    
    if (!success) {
      return null;
    }

    return {
      id: `close-${Date.now()}`,
      orderId: `close-${Date.now()}`,
      symbol: decision.symbol,
      side: position.side === 'long' ? 'sell' : 'buy',
      size: position.size,
      price: currentPrice,
      fee: position.size * currentPrice * 0.0005,
      realizedPnl: position.unrealizedPnl,
      timestamp: Date.now()
    };
  }

  private async executeReduce(
    decision: TradeDecision,
    portfolio: PortfolioState,
    currentPrice: number
  ): Promise<Trade | null> {
    const position = portfolio.positions.find(p => p.symbol === decision.symbol);

    if (!position) {
      logger.warn(`No position to reduce for ${decision.symbol}`);
      return null;
    }

    // Reduce by the specified percentage
    const reduceSize = position.size * (decision.percentage / 100);
    const side = position.side === 'long' ? 'sell' : 'buy';

    logger.info(
      `Reducing ${position.side} ${decision.symbol} by ${decision.percentage}%: ` +
      `size=${reduceSize.toFixed(6)}`
    );

    const order = await exchange.placeOrder(
      decision.symbol,
      side,
      reduceSize,
      'market',
      undefined,
      undefined,
      true // reduceOnly
    );

    if (!order) {
      return null;
    }

    const pnlPortion = position.unrealizedPnl * (decision.percentage / 100);

    return {
      id: order.id,
      orderId: order.id,
      symbol: decision.symbol,
      side,
      size: reduceSize,
      price: currentPrice,
      fee: reduceSize * currentPrice * 0.0005,
      realizedPnl: pnlPortion,
      timestamp: Date.now()
    };
  }

  // ==================== Paper Trading Simulation ====================

  async simulateTrade(
    decision: TradeDecision,
    portfolio: PortfolioState,
    currentPrice: number
  ): Promise<Trade | null> {
    const riskCheck = riskManager.validateTrade(decision, portfolio, currentPrice);
    
    if (!riskCheck.allowed) {
      logger.info(`[PAPER] Trade rejected: ${riskCheck.reason}`);
      return null;
    }

    const size = riskManager.calculatePositionSize(decision, portfolio, currentPrice);
    
    if (size <= 0) {
      return null;
    }

    const side = decision.action === 'BUY' 
      ? (decision.side === 'short' ? 'sell' : 'buy')
      : 'sell';

    logger.info(
      `[PAPER] ${decision.action} ${decision.symbol}: ` +
      `size=${size.toFixed(6)} @ $${currentPrice.toFixed(2)}`
    );

    return {
      id: `paper-${Date.now()}`,
      orderId: `paper-${Date.now()}`,
      symbol: decision.symbol,
      side,
      size,
      price: currentPrice,
      fee: size * currentPrice * 0.0005,
      realizedPnl: 0,
      timestamp: Date.now()
    };
  }

  getExecutedTrades(): Trade[] {
    return this.executedTrades;
  }

  clearTradeHistory(): void {
    this.executedTrades = [];
    this.pendingOrders = [];
  }
}

export const executor = new TradeExecutor();
export default executor;
