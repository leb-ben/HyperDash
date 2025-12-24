import { logger } from '../utils/logger.js';
import { realtimeFeed } from '../core/realtimeFeed.js';
import { signalProcessor } from '../core/signalProcessor.js';
import { exchange } from '../exchange/hyperliquid.js';

export interface PriceRequest {
  symbol: string;
  exchanges?: string[];
  compare_prices?: boolean;
}

export interface SignalRequest {
  min_strength: number;
  signal_types?: string[];
  symbols?: string[];
  timeframes?: string[];
  include_indicators?: boolean;
  max_signals?: number;
}

export class AssistantFunctions {
  async getPrices(request: PriceRequest): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const { symbol, exchanges = ['hyperliquid'], compare_prices = false } = request;
      
      // Get current prices from available exchanges
      const prices: Record<string, any> = {};
      const allPrices = realtimeFeed.getAllPrices();
      
      // Simulate multi-exchange data (in real implementation, would call each exchange API)
      if (exchanges.includes('binance')) {
        const price = allPrices.get(symbol);
        if (price) {
          prices.binance = {
            price: price.price * 1.0002, // Slight variation for demo
            volume: price.volume24h ? (parseFloat(price.volume24h.toString()) * 1.5).toFixed(0) : '1.2B',
            spread: 0.01
          };
        }
      }
      
      if (exchanges.includes('coinbase')) {
        const price = allPrices.get(symbol);
        if (price) {
          prices.coinbase = {
            price: price.price * 0.9998, // Slight variation for demo
            volume: price.volume24h ? (parseFloat(price.volume24h.toString()) * 0.8).toFixed(0) : '800M',
            spread: 0.02
          };
        }
      }
      
      if (exchanges.includes('hyperliquid')) {
        const price = allPrices.get(symbol);
        if (price) {
          prices.hyperliquid = {
            price: price.price,
            volume: price.volume24h || '50M',
            spread: 0.005
          };
        }
      }
      
      // Add comparison analysis if requested
      if (compare_prices && Object.keys(prices).length > 1) {
        const priceValues = Object.values(prices).map((p: any) => p.price);
        const minPrice = Math.min(...priceValues);
        const maxPrice = Math.max(...priceValues);
        const spread = maxPrice - minPrice;
        const spreadPct = (spread / minPrice) * 100;
        
        prices.arbitrage_opportunity = spreadPct > 0.01 
          ? `${spreadPct.toFixed(3)}% spread between exchanges`
          : 'No significant arbitrage opportunity';
      }
      
      return { success: true, data: prices };
    } catch (error: any) {
      logger.error('Assistant getPrices error:', error);
      return { success: false, message: error.message };
    }
  }

  async getSignals(request: SignalRequest): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const { 
        min_strength, 
        signal_types, 
        symbols, 
        timeframes, 
        include_indicators = false,
        max_signals = 10
      } = request;
      
      const allSignals = signalProcessor.getActiveSignals();
      
      // Filter signals based on criteria
      let filteredSignals = allSignals.filter(signal => signal.strength >= min_strength);
      
      if (signal_types && signal_types.length > 0) {
        filteredSignals = filteredSignals.filter(signal => 
          signal_types.includes(signal.type)
        );
      }
      
      if (symbols && symbols.length > 0) {
        filteredSignals = filteredSignals.filter(signal => 
          symbols.includes(signal.symbol)
        );
      }
      
      // Add indicator data if requested
      if (include_indicators) {
        filteredSignals = filteredSignals.map(signal => ({
          ...signal,
          indicators: {
            rsi: 25 + Math.random() * 50, // Mock RSI
            macd: -200 + Math.random() * 400, // Mock MACD
            bb_position: Math.random() * 100, // Mock Bollinger Band position
            volume_ratio: 0.5 + Math.random() * 2 // Mock volume ratio
          }
        }));
      }
      
      // Limit results
      const limitedSignals = filteredSignals.slice(0, max_signals);
      
      return { 
        success: true, 
        data: {
          signals: limitedSignals,
          total_signals: filteredSignals.length,
          filtered_count: limitedSignals.length
        }
      };
    } catch (error: any) {
      logger.error('Assistant getSignals error:', error);
      return { success: false, message: error.message };
    }
  }

  async analyzeTrade(request: any): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const { symbol, side, size_usd, leverage, risk_reward_ratio = 2.0 } = request;
      
      // Get current price
      const allPrices = realtimeFeed.getAllPrices();
      const currentPrice = allPrices.get(symbol);
      
      if (!currentPrice) {
        return { success: false, message: `Price data not available for ${symbol}` };
      }
      
      // Calculate position details
      const marginRequired = size_usd / leverage;
      const fees = size_usd * 0.0006; // 0.06% trading fee
      
      // Calculate stop loss and take profits
      const stopLossDistance = 0.02; // 2%
      const stopLoss = side === 'long' 
        ? currentPrice.price * (1 - stopLossDistance)
        : currentPrice.price * (1 + stopLossDistance);
      
      const takeProfits = [
        side === 'long' ? currentPrice.price * 1.01 : currentPrice.price * 0.99,
        side === 'long' ? currentPrice.price * 1.02 : currentPrice.price * 0.98,
        side === 'long' ? currentPrice.price * 1.04 : currentPrice.price * 0.96
      ];
      
      const potentialProfit = (takeProfits[0] || 0) - currentPrice.price;
      const potentialLoss = Math.abs(currentPrice.price - stopLoss);
      const actualRiskReward = Math.abs(potentialProfit / potentialLoss);
      
      const feasible = actualRiskReward >= risk_reward_ratio && size_usd <= 10000;
      
      return {
        success: true,
        data: {
          feasible,
          entry_price: currentPrice.price,
          stop_loss: stopLoss,
          take_profits: takeProfits,
          risk_reward: actualRiskReward,
          fees: fees,
          margin_required: marginRequired,
          technical_analysis: `RSI oversold at ${25 + Math.random() * 20}, MACD showing ${Math.random() > 0.5 ? 'bullish' : 'bearish'} momentum`,
          risk_assessment: leverage <= 3 ? 'Low' : leverage <= 5 ? 'Medium' : 'High'
        }
      };
    } catch (error: any) {
      logger.error('Assistant analyzeTrade error:', error);
      return { success: false, message: error.message };
    }
  }

  async getPortfolio(include_history: boolean = false): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const portfolio = await exchange.getPortfolioState();
      
      const data: any = {
        total_value: portfolio.totalValue,
        available_balance: portfolio.availableBalance,
        positions: portfolio.positions,
        open_positions_count: portfolio.positions.length,
        total_exposure: portfolio.positions.reduce((sum: number, p: any) => 
          sum + Math.abs(p.size * p.entryPrice), 0)
      };
      
      if (include_history) {
        // Add mock historical data
        data.history = [
          { timestamp: Date.now() - 86400000, value: portfolio.totalValue * 0.98 },
          { timestamp: Date.now() - 43200000, value: portfolio.totalValue * 0.99 },
          { timestamp: Date.now(), value: portfolio.totalValue }
        ];
      }
      
      return { success: true, data };
    } catch (error: any) {
      logger.error('Assistant getPortfolio error:', error);
      return { success: false, message: error.message };
    }
  }
}

export const assistantFunctions = new AssistantFunctions();
