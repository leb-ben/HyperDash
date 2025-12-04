import { exchange } from '../exchange/hyperliquid.js';
import { calculateIndicators, analyzeTrend } from '../indicators/index.js';
import { config } from '../config/settings.js';
import { logger, tradeLog } from '../utils/logger.js';
import type { CoinAnalysis, Ticker, OHLCV, Indicators } from '../types/index.js';

interface SentimentData {
  fearGreedIndex: number;
  socialSentiment: Record<string, number>; // symbol -> sentiment score
  newsCount: Record<string, number>; // symbol -> recent news count
  overallMarketSentiment: 'bullish' | 'bearish' | 'neutral';
}

export class DataCollector {
  private cachedData: Map<string, {
    ticker: Ticker;
    candles: Map<string, OHLCV[]>;
    indicators: Map<string, Indicators>;
    timestamp: number;
  }> = new Map();

  private cacheTimeout = 30000; // 30 seconds

  /**
   * Collect sentiment data from various sources
   * TODO: Replace with real API calls
   */
  private async collectSentimentData(): Promise<SentimentData> {
    try {
      // Mock Fear & Greed Index (0-100, higher = greed)
      const fearGreedIndex = Math.floor(Math.random() * 40) + 40; // 40-80 range
      
      // Mock social sentiment for each tracked symbol (-1 to 1, higher = bullish)
      const symbols = config.coins.tracked.map(c => c.symbol);
      const socialSentiment: Record<string, number> = {};
      const newsCount: Record<string, number> = {};
      
      symbols.forEach(symbol => {
        // Generate random sentiment with slight bullish bias
        socialSentiment[symbol] = (Math.random() * 1.2) - 0.2; // -0.2 to 1.0
        newsCount[symbol] = Math.floor(Math.random() * 10) + 1; // 1-10 news items
      });
      
      // Determine overall market sentiment
      const avgSentiment = Object.values(socialSentiment).reduce((a, b) => a + b, 0) / symbols.length;
      let overallMarketSentiment: 'bullish' | 'bearish' | 'neutral';
      if (avgSentiment > 0.3) {
        overallMarketSentiment = 'bullish';
      } else if (avgSentiment < -0.3) {
        overallMarketSentiment = 'bearish';
      } else {
        overallMarketSentiment = 'neutral';
      }
      
      logger.debug(`Sentiment data collected: Fear/Greed ${fearGreedIndex}, Market ${overallMarketSentiment}`);
      
      return {
        fearGreedIndex,
        socialSentiment,
        newsCount,
        overallMarketSentiment
      };
      
    } catch (error) {
      logger.warn('Failed to collect sentiment data, using defaults:', error);
      return {
        fearGreedIndex: 50,
        socialSentiment: {},
        newsCount: {},
        overallMarketSentiment: 'neutral'
      };
    }
  }

  async collectMarketData(): Promise<{ analyses: CoinAnalysis[]; sentiment: SentimentData }> {
    const symbols = config.coins.tracked.map(c => c.symbol);
    const timeframes = config.analysis.timeframes;
    const analyses: CoinAnalysis[] = [];

    logger.debug(`Collecting data for ${symbols.length} coins across ${timeframes.length} timeframes`);

    // Collect sentiment data first
    const sentiment = await this.collectSentimentData();

    // Fetch all tickers at once
    const tickers = await exchange.getAllTickers(symbols);

    // Process each coin
    for (const symbol of symbols) {
      try {
        const ticker = tickers.get(symbol);
        if (!ticker) {
          logger.warn(`No ticker data for ${symbol}`);
          continue;
        }

        const indicatorsByTimeframe: Record<string, Indicators> = {};
        let primaryIndicators: Indicators | null = null;

        // Fetch candles for each timeframe
        for (const tf of timeframes) {
          const candles = await exchange.getOHLCV(symbol, tf, 100);
          
          if (candles.length > 0) {
            const indicators = calculateIndicators(candles, config.analysis.indicators);
            indicatorsByTimeframe[tf] = indicators;

            // Use 15m or first available as primary
            if (tf === '15m' || !primaryIndicators) {
              primaryIndicators = indicators;
            }
          }
        }

        if (!primaryIndicators) {
          logger.warn(`No indicator data for ${symbol}`);
          continue;
        }

        const { trend, strength, signals } = analyzeTrend(primaryIndicators, ticker.price);

        analyses.push({
          symbol,
          ticker,
          indicators: indicatorsByTimeframe,
          trend,
          strength,
          signals
        });

        // Update cache
        this.cachedData.set(symbol, {
          ticker,
          candles: new Map(),
          indicators: new Map(Object.entries(indicatorsByTimeframe)),
          timestamp: Date.now()
        });

      } catch (error) {
        tradeLog.error(`collectMarketData:${symbol}`, error as Error);
      }
    }

    logger.info(`Collected data for ${analyses.length}/${symbols.length} coins`);
    return { analyses, sentiment };
  }

  async getTickerQuick(symbol: string): Promise<Ticker | null> {
    const cached = this.cachedData.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.ticker;
    }

    try {
      return await exchange.getTicker(symbol);
    } catch {
      return null;
    }
  }

  async getLatestPrice(symbol: string): Promise<number> {
    const ticker = await this.getTickerQuick(symbol);
    return ticker?.price || 0;
  }

  getCachedAnalysis(symbol: string): CoinAnalysis | null {
    const cached = this.cachedData.get(symbol);
    if (!cached) return null;

    // Would need to reconstruct analysis from cache
    // For now, return null to force fresh fetch
    return null;
  }

  clearCache(): void {
    this.cachedData.clear();
    logger.debug('Data cache cleared');
  }
}

export const dataCollector = new DataCollector();
export default dataCollector;
