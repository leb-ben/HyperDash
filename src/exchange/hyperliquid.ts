import { Hyperliquid } from 'hyperliquid';
import { ethers } from 'ethers';
import { logger, tradeLog } from '../utils/logger.js';
import { config, getEnvRequired } from '../config/settings.js';
import type {
  OHLCV,
  Ticker,
  OrderBook,
  Position,
  Order,
  OrderType,
  OrderSide,
  PortfolioState
} from '../types/index.js';

export class HyperliquidExchange {
  private client: Hyperliquid | null = null;
  private wallet: ethers.Wallet | null = null;
  private isTestnet: boolean;
  private isConnected: boolean = false;

  constructor() {
    this.isTestnet = config.exchange.testnet;
  }

  async connect(): Promise<void> {
    try {
      // For paper trading, we don't need wallet auth
      if (!config.bot.paper_trading) {
        const privateKey = getEnvRequired('HYPERLIQUID_PRIVATE_KEY');
        this.wallet = new ethers.Wallet(privateKey);
        
        this.client = new Hyperliquid({
          privateKey,
          testnet: this.isTestnet,
          enableWs: false // Disable WebSocket for simplicity
        });
        
        logger.info(`Connected to Hyperliquid ${this.isTestnet ? 'TESTNET' : 'MAINNET'}`);
        logger.info(`Wallet: ${this.wallet.address}`);
      } else {
        // Public API only for paper trading
        this.client = new Hyperliquid({
          testnet: this.isTestnet,
          enableWs: false
        });
        logger.info('Connected to Hyperliquid (Paper Trading Mode - Read Only)');
      }
      
      this.isConnected = true;
    } catch (error) {
      tradeLog.error('HyperliquidExchange.connect', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    logger.info('Disconnected from Hyperliquid');
  }

  // ==================== Market Data ====================

  private ensureClient(): any {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }
    return this.client;
  }

  async getTicker(symbol: string): Promise<Ticker> {
    try {
      const client = this.ensureClient();
      const perpSymbol = `${symbol}-PERP`;
      
      const allMids = await client.info.getAllMids();
      const price = parseFloat(allMids[perpSymbol] || allMids[symbol] || '0');
      
      if (price === 0) {
        throw new Error(`Symbol not found: ${symbol}`);
      }
      
      return {
        symbol,
        price,
        bid: price * 0.9999,
        ask: price * 1.0001,
        volume24h: 0, // Not available without extra API call
        change24h: 0,
        high24h: 0,
        low24h: 0,
        fundingRate: undefined,
        nextFundingTime: undefined
      };
    } catch (error) {
      tradeLog.error('getTicker', error as Error);
      throw error;
    }
  }

  async getAllTickers(symbols: string[]): Promise<Map<string, Ticker>> {
    const tickers = new Map<string, Ticker>();
    
    try {
      const client = this.ensureClient();
      const allMids = await client.info.getAllMids();

      for (const symbol of symbols) {
        const perpSymbol = `${symbol}-PERP`;
        const price = parseFloat(allMids[perpSymbol] || allMids[symbol] || '0');

        if (price > 0) {
          tickers.set(symbol, {
            symbol,
            price,
            bid: price * 0.9999,
            ask: price * 1.0001,
            volume24h: 0,
            change24h: 0,
            high24h: 0,
            low24h: 0,
            fundingRate: undefined
          });
        }
      }
    } catch (error: any) {
      logger.error('Hyperliquid getAllTickers error:', {
        message: error?.message,
        stack: error?.stack,
        response: error?.response?.data,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        code: error?.code,
        config: error?.config
      });
      tradeLog.error('getAllTickers', error as Error);
    }

    return tickers;
  }

  async getOHLCV(symbol: string, timeframe: string, limit: number = 100): Promise<OHLCV[]> {
    try {
      const client = this.ensureClient();
      const perpSymbol = `${symbol}-PERP`;
      
      // Convert timeframe to interval (e.g., '5m' -> 300)
      const intervalMap: Record<string, number> = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '1h': 3600,
        '4h': 14400,
        '1d': 86400
      };

      const interval = intervalMap[timeframe] || 300;
      const endTime = Date.now();
      const startTime = endTime - (interval * limit * 1000);

      const candles = await client.info.getCandleSnapshot(
        perpSymbol,
        timeframe,
        startTime,
        endTime
      );

      return candles.map((c: any) => ({
        timestamp: c.t,
        open: parseFloat(c.o),
        high: parseFloat(c.h),
        low: parseFloat(c.l),
        close: parseFloat(c.c),
        volume: parseFloat(c.v)
      }));
    } catch (error) {
      tradeLog.error('getOHLCV', error as Error);
      return [];
    }
  }

  async getOrderBook(symbol: string): Promise<OrderBook> {
    try {
      const client = this.ensureClient();
      const perpSymbol = `${symbol}-PERP`;
      const book = await client.info.getL2Book(perpSymbol);
      
      return {
        symbol,
        bids: book.levels[0].map((l: any) => [parseFloat(l.px), parseFloat(l.sz)]),
        asks: book.levels[1].map((l: any) => [parseFloat(l.px), parseFloat(l.sz)]),
        timestamp: Date.now()
      };
    } catch (error) {
      tradeLog.error('getOrderBook', error as Error);
      return { symbol, bids: [], asks: [], timestamp: Date.now() };
    }
  }

  // ==================== Account & Positions ====================

  async getPortfolioState(): Promise<PortfolioState> {
    if (config.bot.paper_trading) {
      // Return mock portfolio for paper trading
      return this.getMockPortfolio();
    }

    try {
      const client = this.ensureClient();
      const address = getEnvRequired('HYPERLIQUID_WALLET_ADDRESS');
      const state = await client.info.getClearinghouseState(address);
      
      const positions: Position[] = state.assetPositions
        .filter((p: any) => parseFloat(p.position.szi) !== 0)
        .map((p: any) => ({
          symbol: p.position.coin,
          side: parseFloat(p.position.szi) > 0 ? 'long' : 'short',
          size: Math.abs(parseFloat(p.position.szi)),
          entryPrice: parseFloat(p.position.entryPx),
          currentPrice: parseFloat(p.position.positionValue) / Math.abs(parseFloat(p.position.szi)),
          unrealizedPnl: parseFloat(p.position.unrealizedPnl),
          unrealizedPnlPct: (parseFloat(p.position.unrealizedPnl) / parseFloat(p.position.marginUsed)) * 100,
          leverage: parseFloat(p.position.leverage.value),
          liquidationPrice: parseFloat(p.position.liquidationPx || '0'),
          marginUsed: parseFloat(p.position.marginUsed),
          openedAt: Date.now() // Not available from API directly
        }));

      const marginSummary = state.marginSummary;
      
      return {
        totalValue: parseFloat(marginSummary.accountValue),
        availableBalance: parseFloat(marginSummary.totalRawUsd),
        marginUsed: parseFloat(marginSummary.totalMarginUsed),
        unrealizedPnl: positions.reduce((sum, p) => sum + p.unrealizedPnl, 0),
        positions,
        stableBalance: parseFloat(marginSummary.totalRawUsd),
        lastUpdated: Date.now()
      };
    } catch (error) {
      tradeLog.error('getPortfolioState', error as Error);
      throw error;
    }
  }

  private getMockPortfolio(): PortfolioState {
    // This will be managed by the paper trading engine
    return {
      totalValue: 500,
      availableBalance: 500,
      marginUsed: 0,
      unrealizedPnl: 0,
      positions: [],
      stableBalance: 500,
      lastUpdated: Date.now()
    };
  }

  // ==================== Trading ====================

  async placeOrder(
    symbol: string,
    side: OrderSide,
    size: number,
    type: OrderType = 'market',
    price?: number,
    leverage?: number,
    reduceOnly: boolean = false
  ): Promise<Order | null> {
    if (config.bot.paper_trading) {
      logger.info(`[PAPER] Would place ${type} ${side} ${size} ${symbol} @ ${price || 'market'}`);
      return null;
    }

    try {
      const client = this.ensureClient();
      const perpSymbol = `${symbol}-PERP`;
      const isBuy = side === 'buy';
      
      // Set leverage if specified
      if (leverage) {
        await client.exchange.updateLeverage(perpSymbol, 'cross', leverage);
      }

      const orderResult = await client.exchange.placeOrder({
        coin: perpSymbol,
        is_buy: isBuy,
        sz: size,
        limit_px: type === 'market' ? 0 : (price || 0),
        order_type: type === 'market' ? { market: {} } : { limit: { tif: 'Gtc' } },
        reduce_only: reduceOnly
      } as any);

      const orderId = orderResult.response?.data?.statuses?.[0]?.resting?.oid || 
                      orderResult.response?.data?.statuses?.[0]?.filled?.oid ||
                      'unknown';

      tradeLog.executed(symbol, side, size, price || 0);

      return {
        id: orderId.toString(),
        symbol,
        type,
        side,
        size,
        price,
        status: 'filled',
        filledSize: size,
        filledPrice: price || 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    } catch (error) {
      tradeLog.error('placeOrder', error as Error);
      return null;
    }
  }

  async closePosition(symbol: string): Promise<boolean> {
    if (config.bot.paper_trading) {
      logger.info(`[PAPER] Would close position for ${symbol}`);
      return true;
    }

    try {
      const portfolio = await this.getPortfolioState();
      const position = portfolio.positions.find(p => p.symbol === symbol);
      
      if (!position) {
        logger.warn(`No position found for ${symbol}`);
        return false;
      }

      const side: OrderSide = position.side === 'long' ? 'sell' : 'buy';
      await this.placeOrder(symbol, side, position.size, 'market', undefined, undefined, true);
      
      return true;
    } catch (error) {
      tradeLog.error('closePosition', error as Error);
      return false;
    }
  }

  async setStopLoss(symbol: string, stopPrice: number): Promise<boolean> {
    if (config.bot.paper_trading) {
      logger.info(`[PAPER] Would set stop loss for ${symbol} @ ${stopPrice}`);
      return true;
    }

    try {
      const portfolio = await this.getPortfolioState();
      const position = portfolio.positions.find(p => p.symbol === symbol);
      
      if (!position) {
        return false;
      }

      const side: OrderSide = position.side === 'long' ? 'sell' : 'buy';
      const triggerPx = stopPrice.toString();

      const client = this.ensureClient();
      const perpSymbol = `${symbol}-PERP`;
      
      await client.exchange.placeOrder({
        coin: perpSymbol,
        is_buy: side === 'buy',
        sz: position.size,
        limit_px: 0,
        order_type: { 
          trigger: { 
            triggerPx, 
            isMarket: true, 
            tpsl: 'sl' 
          } 
        },
        reduce_only: true
      });

      return true;
    } catch (error) {
      tradeLog.error('setStopLoss', error as Error);
      return false;
    }
  }

  async setTakeProfit(symbol: string, takeProfitPrice: number): Promise<boolean> {
    if (config.bot.paper_trading) {
      logger.info(`[PAPER] Would set take profit for ${symbol} @ ${takeProfitPrice}`);
      return true;
    }

    try {
      const portfolio = await this.getPortfolioState();
      const position = portfolio.positions.find(p => p.symbol === symbol);
      
      if (!position) {
        return false;
      }

      const side: OrderSide = position.side === 'long' ? 'sell' : 'buy';
      const triggerPx = takeProfitPrice.toString();

      const client = this.ensureClient();
      const perpSymbol = `${symbol}-PERP`;
      
      await client.exchange.placeOrder({
        coin: perpSymbol,
        is_buy: side === 'buy',
        sz: position.size,
        limit_px: 0,
        order_type: { 
          trigger: { 
            triggerPx, 
            isMarket: true, 
            tpsl: 'tp' 
          } 
        },
        reduce_only: true
      });

      return true;
    } catch (error) {
      tradeLog.error('setTakeProfit', error as Error);
      return false;
    }
  }

  // ==================== Utility ====================

  async getAvailableSymbols(): Promise<string[]> {
    try {
      const client = this.ensureClient();
      const meta = await client.info.getMeta();
      return meta.universe.map((a: any) => a.name);
    } catch (error) {
      tradeLog.error('getAvailableSymbols', error as Error);
      return [];
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

export const exchange = new HyperliquidExchange();
export default exchange;
