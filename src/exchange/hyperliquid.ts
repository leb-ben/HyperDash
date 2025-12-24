import { Hyperliquid } from 'hyperliquid';
import { ethers } from 'ethers';
import { config, getEnvRequired } from '../config/settings.js';
import { logger, tradeLog } from '../utils/logger.js';
import { hyperliquidProxy } from '../utils/hyperliquidProxy.js';
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
  
  // Cache to reduce proxy bandwidth usage (critical for bandwidth limits)
  private portfolioCache: PortfolioState | null = null;
  private portfolioCacheTime: number = 0;
  private readonly PORTFOLIO_CACHE_TTL = 30000; // 30 second cache to save bandwidth

  constructor() {
    this.isTestnet = config.exchange.testnet;
  }

  async connect(): Promise<void> {
    try {
      // Always use wallet auth for testnet trading
      const privateKey = getEnvRequired('HYPERLIQUID_PRIVATE_KEY');
      this.wallet = new ethers.Wallet(privateKey);
      
      this.client = new Hyperliquid({
        privateKey,
        testnet: this.isTestnet,
        enableWs: false // Disable WebSocket for simplicity
      });
      
      logger.info(`Connected to Hyperliquid ${this.isTestnet ? 'TESTNET' : 'MAINNET'}`);
      logger.info(`Wallet: ${this.wallet.address}`);
      
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
    // Always use real wallet balance
    return this.getRealWalletBalance();
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

  /**
   * Get mainnet Hyperliquid wallet balance (real money)
   */
  async getMainnetBalance(): Promise<PortfolioState> {
    try {
      const walletAddress = process.env.HYPERLIQUID_WALLET_ADDRESS;
      
      if (!walletAddress) {
        throw new Error('HYPERLIQUID_WALLET_ADDRESS required');
      }

      const state = await hyperliquidProxy.makeRequest('https://api.hyperliquid.xyz/info', {
        type: 'clearinghouseState',
        user: walletAddress
      });

      if (!state) {
        throw new Error('Failed to fetch mainnet balance');
      }
      const marginSummary = state.marginSummary || {};
      
      const positions: Position[] = (state.assetPositions || [])
        .filter((p: any) => parseFloat(p.position.szi) !== 0)
        .map((p: any) => ({
          symbol: p.position.coin,
          side: parseFloat(p.position.szi) > 0 ? 'long' : 'short',
          size: Math.abs(parseFloat(p.position.szi)),
          entryPrice: parseFloat(p.position.entryPx),
          currentPrice: parseFloat(p.position.positionValue) / Math.abs(parseFloat(p.position.szi)),
          unrealizedPnl: parseFloat(p.position.unrealizedPnl),
          unrealizedPnlPct: (parseFloat(p.position.unrealizedPnl) / parseFloat(p.position.marginUsed)) * 100,
          leverage: parseFloat(p.position.leverage?.value || '1'),
          liquidationPrice: parseFloat(p.position.liquidationPx || '0'),
          marginUsed: parseFloat(p.position.marginUsed),
          openedAt: Date.now()
        }));

      return {
        totalValue: parseFloat(marginSummary.accountValue || '0'),
        availableBalance: parseFloat(marginSummary.totalRawUsd || '0'),
        marginUsed: parseFloat(marginSummary.totalMarginUsed || '0'),
        unrealizedPnl: positions.reduce((sum, p) => sum + p.unrealizedPnl, 0),
        positions,
        stableBalance: parseFloat(marginSummary.totalRawUsd || '0'),
        lastUpdated: Date.now()
      };
    } catch (error) {
      tradeLog.error('getMainnetBalance', error as Error);
      throw error;
    }
  }

  async getRealWalletBalance(): Promise<PortfolioState> {
    try {
      // Return cached value if still fresh (reduces proxy bandwidth)
      const now = Date.now();
      if (this.portfolioCache && (now - this.portfolioCacheTime) < this.PORTFOLIO_CACHE_TTL) {
        return this.portfolioCache;
      }
      
      const walletAddress = process.env.HYPERLIQUID_WALLET_ADDRESS;
      
      if (!walletAddress) {
        throw new Error('HYPERLIQUID_WALLET_ADDRESS required');
      }

      // Use direct HTTP API call
      const baseUrl = this.isTestnet 
        ? 'https://api.hyperliquid-testnet.xyz' 
        : 'https://api.hyperliquid.xyz';
      
      const state = await hyperliquidProxy.makeRequest(`${baseUrl}/info`, {
        type: 'clearinghouseState',
        user: walletAddress
      });

      if (!state) {
        throw new Error('Failed to fetch real wallet balance');
      }

      logger.info(`[Portfolio] Fetched ${state.assetPositions?.length || 0} asset positions`);
      logger.info(`[Portfolio] Account value: $${state.marginSummary?.accountValue || 0}`);
      
      const positions: Position[] = (state.assetPositions || [])
        .filter((p: any) => parseFloat(p.position.szi) !== 0)
        .map((p: any) => {
          // Extract base symbol from PERP format (e.g., "BTC-PERP" -> "BTC")
          const symbol = p.position.coin.replace('-PERP', '');
          
          return {
            symbol,
            side: parseFloat(p.position.szi) > 0 ? 'long' : 'short',
            size: Math.abs(parseFloat(p.position.szi)),
            entryPrice: parseFloat(p.position.entryPx),
            currentPrice: parseFloat(p.position.positionValue) / Math.abs(parseFloat(p.position.szi)),
            unrealizedPnl: parseFloat(p.position.unrealizedPnl),
            unrealizedPnlPct: (parseFloat(p.position.unrealizedPnl) / parseFloat(p.position.marginUsed)) * 100,
            leverage: parseFloat(p.position.leverage?.value || '1'),
            liquidationPrice: parseFloat(p.position.liquidationPx || '0'),
            marginUsed: parseFloat(p.position.marginUsed),
            openedAt: Date.now()
          };
        });

      const marginSummary = state.marginSummary || {};
      
      // Calculate correct values:
      // accountValue = total portfolio value (equity)
      // totalMarginUsed = margin locked in positions
      // availableBalance = accountValue - totalMarginUsed (what you can use for new trades)
      const accountValue = parseFloat(marginSummary.accountValue || '0');
      const marginUsed = parseFloat(marginSummary.totalMarginUsed || '0');
      const availableBalance = accountValue - marginUsed;
      
      const portfolio: PortfolioState = {
        totalValue: accountValue,
        availableBalance: Math.max(0, availableBalance), // Can't be negative
        marginUsed: marginUsed,
        unrealizedPnl: positions.reduce((sum, p) => sum + p.unrealizedPnl, 0),
        positions,
        stableBalance: parseFloat(marginSummary.totalRawUsd || '0'), // Raw USD deposited
        lastUpdated: Date.now()
      };
      
      // Update cache to reduce bandwidth on subsequent calls
      this.portfolioCache = portfolio;
      this.portfolioCacheTime = Date.now();
      
      return portfolio;
    } catch (error) {
      tradeLog.error('getRealWalletBalance', error as Error);
      throw error;
    }
  }

  // ==================== Trading ====================

  // Round price to valid tick size for Hyperliquid
  private roundToTickSize(price: number, symbol: string): number {
    // Hyperliquid tick sizes (price must be divisible by these)
    const tickSizes: Record<string, number> = {
      'BTC': 1,      // $1 increments
      'ETH': 0.1,    // $0.10 increments  
      'SOL': 0.01,   // $0.01 increments
      'HYPE': 0.001, // $0.001 increments
      'JUP': 0.0001, // $0.0001 increments
    };
    const tickSize = tickSizes[symbol] || 0.01;
    return Math.round(price / tickSize) * tickSize;
  }

  async placeOrder(
    symbol: string,
    side: OrderSide,
    size: number,
    type: OrderType = 'market',
    price?: number,
    leverage?: number,
    reduceOnly: boolean = false
  ): Promise<Order | null> {
    try {
      const client = this.ensureClient();
      const perpSymbol = `${symbol}-PERP`;
      const isBuy = side === 'buy';
      
      // Round size to avoid SDK floatToWire precision errors
      // Different assets have different precision requirements
      const sizeDecimals = symbol === 'BTC' ? 5 : symbol === 'ETH' ? 4 : 2;
      const roundedSize = Math.floor(size * Math.pow(10, sizeDecimals)) / Math.pow(10, sizeDecimals);
      
      if (roundedSize === 0) {
        logger.warn(`Order size too small after rounding: ${size} -> ${roundedSize}`);
        return null;
      }
      
      // Set leverage if specified
      if (leverage) {
        await client.exchange.updateLeverage(perpSymbol, 'cross', leverage);
      }

      // Log the order type being processed
      logger.info(`[placeOrder] Processing order: ${type} ${side} ${roundedSize} ${perpSymbol}`);

      let orderTypeObj: any;
      let limitPx: number;
      
      switch (type) {
        case 'market':
          // Hyperliquid doesn't have 'market' type - use limit with Ioc (Immediate or Cancel)
          orderTypeObj = { limit: { tif: 'Ioc' } };
          // For market orders, use current price with slippage buffer
          // Get current price if not provided
          if (!price) {
            const ticker = await this.getTicker(symbol);
            price = ticker.price;
          }
          // Add 2% slippage buffer for buys, subtract for sells, then round to tick size
          const rawLimitPx = isBuy ? (price || 0) * 1.02 : (price || 0) * 0.98;
          limitPx = this.roundToTickSize(rawLimitPx, symbol);
          break;
        case 'limit':
          orderTypeObj = { limit: { tif: 'Gtc' } };
          limitPx = this.roundToTickSize(price || 0, symbol);
          break;
        case 'stop':
          // For stop orders, use trigger order type
          if (!price) {
            throw new Error('Stop orders require a trigger price');
          }
          orderTypeObj = { 
            trigger: { 
              triggerPx: price.toString(), 
              isMarket: true, 
              tpsl: 'sl' 
            } 
          };
          limitPx = 0;
          break;
        case 'stop_limit':
          // For stop-limit orders
          if (!price) {
            throw new Error('Stop-limit orders require a trigger price');
          }
          orderTypeObj = { 
            trigger: { 
              triggerPx: price.toString(), 
              isMarket: false, 
              tpsl: 'sl' 
            } 
          };
          limitPx = price;
          break;
        default:
          throw new Error(`Unsupported order type: ${type}`);
      }

      const orderPayload = {
        coin: perpSymbol,
        is_buy: isBuy,
        sz: roundedSize,
        limit_px: limitPx,
        order_type: orderTypeObj,
        reduce_only: reduceOnly
      };

      // Log the exact payload being sent
      logger.info(`[placeOrder] Sending payload: ${JSON.stringify(orderPayload)}`);

      const orderResult = await client.exchange.placeOrder(orderPayload as any);

      logger.info(`[placeOrder] Order response: ${JSON.stringify(orderResult.response?.data?.statuses?.[0] || {})}`);

      const status = orderResult.response?.data?.statuses?.[0];
      const orderId = status?.resting?.oid || status?.filled?.oid || 'unknown';
      
      // Parse actual fill price from response
      const fillData = status?.filled;
      const actualFillPrice = fillData?.avgPx ? parseFloat(fillData.avgPx) : (price || 0);
      const actualFillSize = fillData?.totalSz ? parseFloat(fillData.totalSz) : size;

      tradeLog.executed(symbol, side, actualFillSize, actualFillPrice);

      return {
        id: orderId.toString(),
        symbol,
        type,
        side,
        size: actualFillSize,
        price: actualFillPrice,
        status: fillData ? 'filled' : 'open',
        filledSize: actualFillSize,
        filledPrice: actualFillPrice,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    } catch (error) {
      tradeLog.error('placeOrder', error as Error);
      return null;
    }
  }

  async openPosition(symbol: string, side: 'long' | 'short', sizeUsd: number, leverage: number): Promise<boolean> {
    try {
      const ticker = await this.getTicker(symbol);
      const currentPrice = ticker.price;
      const sizeInCoin = sizeUsd / currentPrice;
      
      const orderSide: OrderSide = side === 'long' ? 'buy' : 'sell';
      const order = await this.placeOrder(symbol, orderSide, sizeInCoin, 'market', undefined, leverage);
      
      if (!order) {
        logger.error(`Failed to open ${side} position for ${symbol}`);
        return false;
      }

      logger.info(`Opened ${side} position: ${symbol} ${sizeInCoin.toFixed(4)} @ $${currentPrice.toFixed(2)} with ${leverage}x leverage`);
      return true;
    } catch (error) {
      tradeLog.error('openPosition', error as Error);
      return false;
    }
  }

  async closePosition(symbol: string): Promise<boolean> {
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
