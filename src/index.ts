import { config, validateConfig } from './config/settings.js';
import { exchange } from './exchange/hyperliquid.js';
import { dataCollector } from './core/dataCollector.js';
import { aiEngine } from './core/aiEngine.js';
import { aiOrchestrator } from './core/aiOrchestrator.js';
import { executor } from './core/executor.js';
import { riskManager } from './core/riskManager.js';
import { paperPortfolio } from './core/portfolio.js';
import { learningEngine } from './core/learningEngine.js';
import { maintenanceSystem } from './core/maintenance.js';
import { startApiServer, setBotController, logActivity } from './api/server.js';
import { errorHandler, ErrorSeverity } from './core/errorHandler.js';
import { safetyManager } from './core/safetyManager.js';
import { signalProcessor } from './core/signalProcessor.js';
import { realtimeFeed } from './core/realtimeFeed.js';
import { reactiveExecutor } from './core/reactiveExecutor.js';
import { logger, tradeLog } from './utils/logger.js';
import type { MarketReport, PortfolioState, AIResponse, CoinAnalysis } from './types/index.js';

class TradingBot {
  private cycleCount: number = 0;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastCoinAnalyses: CoinAnalysis[] = [];
  private activeTradeIds: Map<string, string> = new Map(); // symbol -> tradeId
  private lastCycleTime: number = 0;

  // Public methods for API control
  getIsRunning(): boolean { return this.isRunning; }
  getCycleCount(): number { return this.cycleCount; }
  getLastCycleTime(): number { return this.lastCycleTime; }

  async stopBot(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Bot stopped via API');
  }

  async startBot(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.runCycle();
    this.intervalId = setInterval(
      () => this.runCycle(),
      config.bot.cycle_interval_ms
    );
    logger.info('Bot started via API');
  }

  async start(): Promise<void> {
    logger.info('═══════════════════════════════════════════');
    logger.info(`  ${config.bot.name} v${config.bot.version}`);
    logger.info(`  Mode: ${config.bot.paper_trading ? 'PAPER TRADING' : 'LIVE TRADING'}`);
    logger.info(`  Exchange: ${config.exchange.name} (${config.exchange.testnet ? 'testnet' : 'mainnet'})`);
    logger.info('═══════════════════════════════════════════');

    // Validate configuration
    if (!validateConfig()) {
      logger.error('Configuration validation failed. Exiting.');
      process.exit(1);
    }

    // Connect to exchange
    try {
      await exchange.connect();
    } catch (error) {
      logger.error(`Failed to connect to exchange: ${error}`);
      process.exit(1);
    }

    // Get initial portfolio state
    const portfolio = await this.getPortfolioState();
    riskManager.setDailyStartValue(portfolio.totalValue);

    // Initialize safety manager with default withdrawal address
    safetyManager.setWithdrawalAddress(
      '0x5e4A9E5B1539136374B1b5F4fCc380b9832A78F2',
      'Faucet-Sipper1'
    );
    safetyManager.recordValue(portfolio.totalValue);

    // Set up error handler callbacks
    errorHandler.onError((error) => {
      if (error.severity === ErrorSeverity.CRITICAL) {
        logger.error('Critical error detected - initiating safety shutdown');
        safetyManager.emergencyStop(error.message);
        this.stopBot();
      }
    });

    logger.info(`Starting portfolio value: $${portfolio.totalValue.toFixed(2)}`);
    logger.info(`Tracked coins: ${config.coins.tracked.map(c => c.symbol).join(', ')}`);
    logger.info(`Cycle interval: ${config.bot.cycle_interval_ms / 1000}s`);
    logger.info('───────────────────────────────────────────');

    // Start real-time price feed
    logger.info('Starting real-time price feed...');
    await realtimeFeed.start();

    // Start reactive executor
    logger.info('Starting reactive executor...');
    reactiveExecutor.start();

    // Log signal processor status
    signalProcessor.on('urgent-signal', (signal) => {
      logger.info(`URGENT SIGNAL: ${signal.symbol} ${signal.type} ${signal.direction} (${signal.strength}%)`);
    });

    logger.info('───────────────────────────────────────────');

    this.isRunning = true;

    // Run first cycle immediately
    await this.runCycle();

    // Schedule recurring cycles
    this.intervalId = setInterval(
      () => this.runCycle(),
      config.bot.cycle_interval_ms
    );

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    // Start API server for dashboard control
    setBotController({
      start: () => this.startBot(),
      stop: () => this.stopBot(),
      isRunning: () => this.getIsRunning(),
      getCycleCount: () => this.getCycleCount(),
      getLastCycleTime: () => this.getLastCycleTime()
    });
    startApiServer(3001);

    logger.info('Bot started. Press Ctrl+C to stop.');
  }

  private async runCycle(): Promise<void> {
    if (!this.isRunning) return;

    // Check safety first
    const portfolioValue = (await this.getPortfolioState()).totalValue;
    safetyManager.recordValue(portfolioValue);
    
    const safetyCheck = safetyManager.checkSafety(portfolioValue);
    if (!safetyCheck.safe) {
      logger.error(`SAFETY STOP: ${safetyCheck.reason}`);
      if (safetyCheck.action === 'kill_bot') {
        this.stopBot();
        return;
      }
    }

    const pauseState = riskManager.isPausedState();
    if (pauseState.paused) {
      logger.warn(`Bot paused: ${pauseState.reason}`);
      return;
    }

    this.cycleCount++;
    this.lastCycleTime = Date.now();
    const startTime = Date.now();

    try {
      tradeLog.cycle(
        this.cycleCount,
        portfolioValue,
        riskManager.getPerformanceMetrics().dailyPnlPct
      );

      // Check if weekly maintenance should run
      if (maintenanceSystem.shouldRunMaintenance()) {
        logger.info('Running weekly self-maintenance...');
        await maintenanceSystem.runMaintenance();
      }

      // Step 1: Collect market data
      logger.debug('Collecting market data...');
      const marketData = await dataCollector.collectMarketData();
      const coinAnalyses = marketData.analyses;
      const sentimentData = marketData.sentiment;
      this.lastCoinAnalyses = coinAnalyses;

      if (coinAnalyses.length === 0) {
        logger.warn('No market data collected, skipping cycle');
        return;
      }

      // Step 2: Get portfolio state
      const portfolio = await this.getPortfolioState();

      // Update prices in paper portfolio if paper trading
      if (config.bot.paper_trading) {
        const prices = new Map(coinAnalyses.map(c => [c.symbol, c.ticker.price]));
        paperPortfolio.updatePrices(prices);
      }

      // Step 3: Build market report
      const report = this.buildMarketReport(coinAnalyses, portfolio, sentimentData);

      // Step 4: Get AI analysis
      logger.debug('Requesting AI analysis...');
      logActivity('info', 'AI', `Analyzing ${coinAnalyses.length} coins...`);
      const aiResponse = await aiEngine.analyzeMarket(report);

      // Save AI decision
      if (config.bot.paper_trading) {
        paperPortfolio.saveAIDecision(aiResponse);
      }

      // Log AI analysis
      logger.info(`Market: ${aiResponse.marketRegime} | Risk: ${aiResponse.riskLevel}`);
      logActivity('ai_decision', 'AI', `Market: ${aiResponse.marketRegime} | Risk: ${aiResponse.riskLevel}`, { 
        decisions: aiResponse.decisions.length 
      });
      
      if (aiResponse.warnings.length > 0) {
        aiResponse.warnings.forEach(w => {
          tradeLog.warning(w);
          logActivity('warning', 'AI', w);
        });
      }

      // Log each AI decision
      for (const decision of aiResponse.decisions) {
        logActivity('ai_decision', 'AI', 
          `${decision.action} ${decision.symbol} (${decision.confidence}% confidence): ${decision.reason?.substring(0, 80) || 'No reason'}...`
        );
      }

      // Step 5: Process pending orders (realistic paper trading)
      if (config.bot.paper_trading) {
        const pendingResults = reactiveExecutor.processPendingOrders();
        if (pendingResults.length > 0) {
          logger.info(`Processed ${pendingResults.length} pending orders`);
          pendingResults.forEach(result => {
            logActivity('trade', 'Executor', result.message);
          });
        }
      }

      // Step 6: Execute decisions
      if (aiResponse.decisions.length > 0) {
        logger.info(`Executing ${aiResponse.decisions.length} trading decisions...`);
        logActivity('trade', 'Executor', `Executing ${aiResponse.decisions.length} trade decisions`);
        
        if (config.bot.paper_trading) {
          await this.executePaperTrades(aiResponse, portfolio);
        } else {
          await executor.executeDecisions(aiResponse, portfolio);
        }
      }

      // Step 6: Update risk manager
      const updatedPortfolio = await this.getPortfolioState();
      riskManager.updateHighWaterMark(updatedPortfolio.totalValue);

      const duration = Date.now() - startTime;
      logger.debug(`Cycle ${this.cycleCount} completed in ${duration}ms`);

    } catch (error) {
      tradeLog.error(`Cycle ${this.cycleCount}`, error as Error);
    }
  }

  private async getPortfolioState(): Promise<PortfolioState> {
    if (config.bot.paper_trading) {
      return paperPortfolio.getState();
    }
    return exchange.getPortfolioState();
  }

  private buildMarketReport(
    coinAnalyses: any[],
    portfolio: PortfolioState,
    sentimentData?: any
  ): MarketReport {
    return {
      timestamp: Date.now(),
      portfolio,
      coins: coinAnalyses,
      marketSentiment: {
        btcDominance: 0, // Would need external API
        totalMarketCap: 0,
        fearGreedIndex: sentimentData?.fearGreedIndex || 50,
        overallSentiment: sentimentData?.overallMarketSentiment || 'neutral',
        socialSentiment: sentimentData?.socialSentiment || {},
        newsCount: sentimentData?.newsCount || {}
      },
      recentTrades: config.bot.paper_trading 
        ? paperPortfolio.getTrades(10)
        : executor.getExecutedTrades().slice(-10),
      recentDecisions: config.bot.paper_trading
        ? paperPortfolio.getRecentDecisions(3)
        : [aiEngine.getLastDecision()].filter(Boolean) as AIResponse[],
      botPerformance: riskManager.getPerformanceMetrics()
    };
  }

  private async executePaperTrades(
    aiResponse: AIResponse,
    portfolio: PortfolioState
  ): Promise<void> {
    for (const decision of aiResponse.decisions) {
      if (decision.action === 'HOLD') continue;

      const prices = new Map<string, number>();
      const marketData = await dataCollector.collectMarketData();
      marketData.analyses.forEach(c => prices.set(c.symbol, c.ticker.price));

      const currentPrice = prices.get(decision.symbol);
      if (!currentPrice) continue;

      switch (decision.action) {
        case 'BUY': {
          const riskCheck = riskManager.validateTrade(decision, portfolio, currentPrice);
          if (!riskCheck.allowed) {
            logger.warn(`[PAPER] Trade rejected: ${riskCheck.reason}`);
            continue;
          }

          const size = riskManager.calculatePositionSize(decision, portfolio, currentPrice);
          const leverage = decision.leverage || config.risk.default_leverage;
          const stopLoss = decision.stopLoss || 
            riskManager.calculateStopLoss(currentPrice, decision.side || 'long');
          const takeProfit = decision.takeProfit ||
            riskManager.calculateTakeProfit(currentPrice, decision.side || 'long');

          paperPortfolio.openPosition(
            decision.symbol,
            decision.side || 'long',
            size,
            currentPrice,
            leverage,
            stopLoss,
            takeProfit
          );

          // Record trade for learning
          const analysis = this.lastCoinAnalyses.find(c => c.symbol === decision.symbol);
          if (analysis) {
            const tradeId = learningEngine.recordTrade(decision, analysis, currentPrice, size);
            this.activeTradeIds.set(decision.symbol, tradeId);
          }
          break;
        }

        case 'SELL': {
          // Open short position
          const riskCheck = riskManager.validateTrade(decision, portfolio, currentPrice);
          if (!riskCheck.allowed) continue;

          const size = riskManager.calculatePositionSize(decision, portfolio, currentPrice);
          const leverage = decision.leverage || config.risk.default_leverage;
          const stopLoss = decision.stopLoss ||
            riskManager.calculateStopLoss(currentPrice, 'short');

          paperPortfolio.openPosition(
            decision.symbol,
            'short',
            size,
            currentPrice,
            leverage,
            stopLoss
          );
          break;
        }

        case 'CLOSE': {
          // Record trade outcome before closing
          const tradeId = this.activeTradeIds.get(decision.symbol);
          const position = portfolio.positions.find(p => p.symbol === decision.symbol);
          if (tradeId && position) {
            learningEngine.closeTrade(tradeId, currentPrice, position.unrealizedPnl);
            this.activeTradeIds.delete(decision.symbol);
          }
          
          paperPortfolio.closePosition(decision.symbol, currentPrice, 'ai_decision');
          break;
        }

        case 'REDUCE': {
          paperPortfolio.reducePosition(decision.symbol, decision.percentage, currentPrice);
          break;
        }
      }
    }
  }

  async shutdown(): Promise<void> {
    logger.info('\nShutting down...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Stop real-time components
    logger.info('Stopping real-time feed...');
    realtimeFeed.stop();
    
    logger.info('Stopping reactive executor...');
    reactiveExecutor.stop();

    await exchange.disconnect();

    const finalPortfolio = await this.getPortfolioState();
    const metrics = riskManager.getPerformanceMetrics();
    const errorStats = errorHandler.getStats();
    const signalStats = signalProcessor.getStats();
    const executorStats = reactiveExecutor.getStats();

    logger.info('═══════════════════════════════════════════');
    logger.info('  SESSION SUMMARY');
    logger.info('═══════════════════════════════════════════');
    logger.info(`  Final Portfolio: $${finalPortfolio.totalValue.toFixed(2)}`);
    logger.info(`  Session P&L: ${metrics.dailyPnlPct >= 0 ? '+' : ''}${metrics.dailyPnlPct.toFixed(2)}%`);
    logger.info(`  Total Cycles: ${this.cycleCount}`);
    logger.info(`  Win Rate: ${(metrics.winRate * 100).toFixed(1)}%`);
    logger.info('───────────────────────────────────────────');
    logger.info(`  Signals Generated: ${signalStats.totalSignals}`);
    logger.info(`  Reactive Executions: ${executorStats.successfulExecutions}/${executorStats.totalExecutions}`);
    logger.info(`  Total Fees Paid: $${executorStats.totalFees.toFixed(2)}`);
    logger.info(`  Errors: ${errorStats.total}`);
    logger.info('═══════════════════════════════════════════');

    process.exit(0);
  }
}

// Start the bot
const bot = new TradingBot();
bot.start().catch(error => {
  logger.error(`Fatal error: ${error}`);
  process.exit(1);
});
