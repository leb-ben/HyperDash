/**
 * 24-Hour Aggressive Trading Test
 * Tests realistic paper trading with $100 USDT starting balance
 * Run: node scripts/run-24hour-test.js
 */

import fs from 'fs';
import path from 'path';
import { tradingModeManager } from '../src/core/tradingModeManager.js';
import { reactiveExecutor } from '../src/core/reactiveExecutor.js';
import { signalProcessor } from '../src/core/signalProcessor.js';
import { logger } from '../src/utils/logger.js';

class TwentyFourHourTest {
  constructor() {
    this.startTime = Date.now();
    this.testDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.initialBalance = 100;
    this.logInterval = 60 * 60 * 1000; // Log every hour
    this.testResults = [];
    this.isRunning = false;
  }

  async startTest() {
    console.log('🚀 Starting 24-Hour Aggressive Trading Test');
    console.log('='.repeat(60));
    console.log(`📊 Initial Balance: $${this.initialBalance} USDT`);
    console.log(`⚙️  Mode: Realistic Paper Trading (Aggressive)`);
    console.log(`⏱️  Duration: 24 hours`);
    console.log(`📝 Logs: Will be saved every hour`);
    console.log('');

    // Set aggressive mode
    process.env.AGGRESSIVE_TRADING = 'true';
    process.env.REALISTIC_PAPER_TRADING = 'true';
    process.env.INITIAL_PAPER_BALANCE = this.initialBalance.toString();

    // Reset portfolio
    tradingModeManager.resetPortfolio(this.initialBalance);

    this.isRunning = true;
    console.log('✅ Test started! Bot will trade aggressively for 24 hours.');
    console.log('📊 Performance will be logged every hour.');
    console.log('🛑 Press Ctrl+C to stop the test early.');

    // Start the main test loop
    await this.runTestLoop();
  }

  async runTestLoop() {
    const mainLoop = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(mainLoop);
        return;
      }

      // Process pending orders
      const orderResults = reactiveExecutor.processPendingOrders();
      if (orderResults.length > 0) {
        console.log(`📋 Processed ${orderResults.length} pending orders`);
      }

      // Generate and execute signals (simulated for testing)
      await this.generateAndExecuteSignals();

      // Check if we should log performance
      const now = Date.now();
      if (now - this.startTime > this.testDuration) {
        this.endTest();
        clearInterval(mainLoop);
      } else if (now % this.logInterval < 60000) { // Log every hour
        await this.logPerformance();
      }

    }, 30000); // Run every 30 seconds
  }

  async generateAndExecuteSignals() {
    // Simulate trading signals for testing
    const symbols = ['BTC', 'ETH', 'SOL'];
    const currentPortfolio = tradingModeManager.getPortfolioState();

    for (const symbol of symbols) {
      // Generate random signal for testing
      const signalStrength = 60 + Math.random() * 40; // 60-100 strength
      const direction = Math.random() > 0.5 ? 'long' : 'short';
      
      if (signalStrength > 75) { // Only execute strong signals in aggressive mode
        const signal = {
          id: `test_${Date.now()}_${symbol}`,
          symbol,
          direction,
          strength: signalStrength,
          type: 'RSI_Oversold',
          urgency: 'high',
          timestamp: Date.now(),
          price: 50000 + Math.random() * 10000, // Mock price
          confidence: signalStrength / 100
        };

        try {
          const result = await reactiveExecutor.executeSignal(signal);
          if (result.success) {
            console.log(`🎯 Trade executed: ${direction} ${symbol} (strength: ${signalStrength.toFixed(1)})`);
          }
        } catch (error) {
          console.error(`❌ Trade execution failed: ${error.message}`);
        }
      }
    }
  }

  async logPerformance() {
    const now = Date.now();
    const elapsedHours = Math.floor((now - this.startTime) / (60 * 60 * 1000));
    const performance = tradingModeManager.get24HourPerformance();
    const portfolio = tradingModeManager.getPortfolioState();

    const logEntry = {
      timestamp: now,
      elapsedHours,
      totalValueUsdt: portfolio.totalValueUsdt,
      profitLoss: portfolio.profitLoss,
      profitLossPercent: performance.profitLossPercent,
      totalFees: portfolio.totalFeesPaid,
      tradesExecuted: portfolio.tradesExecuted,
      pendingOrders: portfolio.pendingOrdersCount,
      positions: Array.from(portfolio.positions.entries()).map(([symbol, amount]) => ({ symbol, amount }))
    };

    this.testResults.push(logEntry);

    // Log to console
    console.log(`\n📊 Hour ${elapsedHours} Performance Report:`);
    console.log(`   💰 Portfolio Value: $${portfolio.totalValueUsdt.toFixed(2)}`);
    console.log(`   📈 Profit/Loss: $${portfolio.profitLoss.toFixed(2)} (${performance.profitLossPercent.toFixed(2)}%)`);
    console.log(`   💸 Total Fees: $${portfolio.totalFeesPaid.toFixed(2)}`);
    console.log(`   🔄 Trades Executed: ${portfolio.tradesExecuted}`);
    console.log(`   ⏳ Pending Orders: ${portfolio.pendingOrdersCount}`);
    console.log(`   📋 Positions: ${logEntry.positions.length} open`);

    // Save to file
    await this.saveResults();
  }

  async saveResults() {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }

    const resultsFile = path.join(logsDir, '24hour-test-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify({
      testConfig: {
        startTime: this.startTime,
        duration: this.testDuration,
        initialBalance: this.initialBalance,
        mode: 'realistic_paper_aggressive'
      },
      currentResults: this.testResults,
      summary: this.generateSummary()
    }, null, 2));
  }

  generateSummary() {
    if (this.testResults.length === 0) return null;

    const latest = this.testResults[this.testResults.length - 1];
    const first = this.testResults[0];

    return {
      totalDuration: Date.now() - this.startTime,
      startingBalance: this.initialBalance,
      endingBalance: latest.totalValueUsdt,
      totalProfitLoss: latest.profitLoss,
      totalProfitLossPercent: latest.profitLossPercent,
      totalFeesPaid: latest.totalFeesPaid,
      totalTrades: latest.tradesExecuted,
      feeToProfitRatio: latest.profitLoss > 0 ? latest.totalFeesPaid / latest.profitLoss : 0,
      profitability: latest.profitLoss > 0 ? 'PROFITABLE' : 'UNPROFITABLE',
      recommendation: this.generateRecommendation(latest)
    };
  }

  generateRecommendation(latestResult) {
    if (latestResult.profitLoss > 10) {
      return '✅ Excellent performance! The aggressive strategy is highly profitable.';
    } else if (latestResult.profitLoss > 0) {
      return '✅ Profitable! The strategy works but consider optimizing for higher returns.';
    } else if (latestResult.profitLoss > -20) {
      return '⚠️  Small loss. Consider reducing aggressiveness or improving signal quality.';
    } else {
      return '❌ Significant loss. The aggressive strategy is too risky - reconsider parameters.';
    }
  }

  async endTest() {
    this.isRunning = false;
    console.log('\n🏁 24-Hour Test Complete!');
    console.log('='.repeat(60));

    const summary = this.generateSummary();
    if (summary) {
      console.log(`📊 Final Results:`);
      console.log(`   💰 Starting Balance: $${summary.startingBalance.toFixed(2)}`);
      console.log(`   💰 Ending Balance: $${summary.endingBalance.toFixed(2)}`);
      console.log(`   📈 Total Profit/Loss: $${summary.totalProfitLoss.toFixed(2)} (${summary.totalProfitLossPercent.toFixed(2)}%)`);
      console.log(`   💸 Total Fees Paid: $${summary.totalFeesPaid.toFixed(2)}`);
      console.log(`   🔄 Total Trades: ${summary.totalTrades}`);
      console.log(`   📊 Fee/Profit Ratio: ${(summary.feeToProfitRatio * 100).toFixed(2)}%`);
      console.log(`   🎯 Result: ${summary.profitability}`);
      console.log(`   💡 Recommendation: ${summary.recommendation}`);
    }

    await this.saveResults();
    console.log(`\n📄 Detailed results saved to: logs/24hour-test-results.json`);
    
    process.exit(0);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test stopped by user');
  if (global.testInstance) {
    global.testInstance.endTest();
  } else {
    process.exit(0);
  }
});

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new TwentyFourHourTest();
  global.testInstance = test;
  
  console.log('🔧 Starting 24-hour aggressive trading test...');
  console.log('⚠️  Make sure your bot services are running:');
  console.log('   npm run paper (terminal 1)');
  console.log('   npm run start:dashboard (terminal 2)');
  console.log('');
  
  test.startTest().catch(console.error);
}

export default TwentyFourHourTest;
