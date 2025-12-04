/**
 * Automated Test Runner for Trading Bot
 * Run: npx ts-node scripts/run-tests.ts
 */

import fs from 'fs';
import path from 'path';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  message: string;
  evidence?: any;
}

class TestRunner {
  private results: TestResult[] = [];
  private startTime: Date = new Date();

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const start = Date.now();
    console.log(`\n🧪 Running: ${name}`);
    
    try {
      await testFn();
      const duration = Date.now() - start;
      this.results.push({
        name,
        status: 'PASS',
        duration,
        message: 'Test completed successfully'
      });
      console.log(`✅ ${name} - PASS (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - start;
      this.results.push({
        name,
        status: 'FAIL',
        duration,
        message: error.message,
        evidence: error.stack
      });
      console.log(`❌ ${name} - FAIL (${duration}ms): ${error.message}`);
    }
  }

  async testTerminalPositionClose(): Promise<void> {
    const response = await fetch('http://localhost:3001/api/terminal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'positions.close BTC' })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Position close failed: ${result.output}`);
    }

    if (!result.output.includes('successfully')) {
      throw new Error('Unexpected response format');
    }
  }

  async testTerminalThemeChange(): Promise<void> {
    const response = await fetch('http://localhost:3001/api/terminal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'dashboard.theme light' })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Theme change failed: ${result.output}`);
    }

    // Verify settings were updated
    const settingsResponse = await fetch('http://localhost:3001/api/dashboard/settings');
    const settings = await settingsResponse.json();
    
    if (settings.settings.theme !== 'light') {
      throw new Error('Theme not persisted in settings');
    }
  }

  async testTerminalAIQuery(): Promise<void> {
    const response = await fetch('http://localhost:3001/api/terminal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'ai.ask What is BTC price?' })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`AI query failed: ${result.output}`);
    }

    if (!result.output.includes('AI Response:')) {
      throw new Error('AI response format incorrect');
    }
  }

  async testAIChatTradeModification(): Promise<void> {
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Close my BTC position' })
    });

    const result = await response.json();
    
    if (!result.response) {
      throw new Error('AI chat did not respond');
    }

    // Check if response acknowledges the request
    if (!result.response.toLowerCase().includes('btc') || !result.response.toLowerCase().includes('close')) {
      throw new Error('AI chat response does not acknowledge the trade request');
    }
  }

  async testAIChatDashboardUpdate(): Promise<void> {
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Change dashboard to light theme' })
    });

    const result = await response.json();
    
    if (!result.response) {
      throw new Error('AI chat did not respond');
    }

    // Check if response acknowledges the theme change
    if (!result.response.toLowerCase().includes('theme') || !result.response.toLowerCase().includes('light')) {
      throw new Error('AI chat response does not acknowledge the theme change');
    }
  }

  async testAIChatComplexAnalysis(): Promise<void> {
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Analyze current market conditions and suggest 3 trading opportunities' })
    });

    const result = await response.json();
    
    if (!result.response) {
      throw new Error('AI chat did not respond');
    }

    // Check if response includes analysis
    if (result.response.length < 100) {
      throw new Error('AI chat response too short for complex analysis');
    }
  }

  async testAssistantPriceComparison(): Promise<void> {
    const response = await fetch('http://localhost:3001/api/assistant/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        symbol: 'BTC',
        exchanges: ['binance', 'coinbase', 'hyperliquid'],
        compare_prices: true
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Assistant price comparison failed: ${result.message}`);
    }

    if (!result.binance || !result.coinbase || !result.hyperliquid) {
      throw new Error('Missing exchange price data');
    }
  }

  async generateReport(): Promise<void> {
    const endTime = new Date();
    const totalDuration = endTime.getTime() - this.startTime.getTime();
    
    const report = `
=== TRADING BOT TEST REPORT ===
Date: ${this.startTime.toISOString()}
Duration: ${totalDuration}ms

SUMMARY:
Total Tests: ${this.results.length}
Passed: ${this.results.filter(r => r.status === 'PASS').length}
Failed: ${this.results.filter(r => r.status === 'FAIL').length}
Skipped: ${this.results.filter(r => r.status === 'SKIP').length}

DETAILED RESULTS:
${this.results.map(r => `
${r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️'} ${r.name}
   Status: ${r.status}
   Duration: ${r.duration}ms
   Message: ${r.message}
   ${r.evidence ? `Evidence: ${r.evidence}` : ''}
`).join('\n')}

PERFORMANCE:
Average Test Duration: ${Math.round(totalDuration / this.results.length)}ms
Fastest Test: ${Math.min(...this.results.map(r => r.duration))}ms
Slowest Test: ${Math.max(...this.results.map(r => r.duration))}ms

Generated: ${endTime.toISOString()}
`;

    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }

    // Write report
    const reportPath = path.join(logsDir, 'test-results.txt');
    fs.writeFileSync(reportPath, report);
    
    console.log('\n📊 Test Report Generated:');
    console.log(`   📁 Location: ${reportPath}`);
    console.log(`   ⏱️  Total Duration: ${totalDuration}ms`);
    console.log(`   ✅ Passed: ${this.results.filter(r => r.status === 'PASS').length}`);
    console.log(`   ❌ Failed: ${this.results.filter(r => r.status === 'FAIL').length}`);
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Trading Bot Test Suite');
    console.log('=====================================');

    // Terminal Tests
    await this.runTest('Terminal - Close Position', () => this.testTerminalPositionClose());
    await this.runTest('Terminal - Theme Change', () => this.testTerminalThemeChange());
    await this.runTest('Terminal - AI Query', () => this.testTerminalAIQuery());

    // AI Chat Tests
    await this.runTest('AI Chat - Trade Modification', () => this.testAIChatTradeModification());
    await this.runTest('AI Chat - Dashboard Update', () => this.testAIChatDashboardUpdate());
    await this.runTest('AI Chat - Complex Analysis', () => this.testAIChatComplexAnalysis());

    // Assistant Function Tests
    await this.runTest('Assistant - Price Comparison', () => this.testAssistantPriceComparison());

    await this.generateReport();
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new TestRunner();
  
  console.log('⚠️  Make sure the bot is running:');
  console.log('   npm run paper (terminal 1)');
  console.log('   npm run start:dashboard (terminal 2)');
  console.log('');
  
  runner.runAllTests().catch(console.error);
}

export default TestRunner;
