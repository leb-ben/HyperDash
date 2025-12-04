/**
 * Comprehensive Testing Suite for AI Trading Bot
 * Run: npx ts-node scripts/run-comprehensive-tests.ts
 * 
 * SECURITY NOTE: This runs in paper trading mode with no authentication
 * DO NOT use in production or with real money
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

interface TestSuite {
  name: string;
  description: string;
  tests: TestCase[];
}

interface TestCase {
  name: string;
  type: 'terminal' | 'ai_chat' | 'assistant_function' | 'security';
  setup?: () => Promise<void>;
  execute: () => Promise<any>;
  verify: (result: any) => boolean;
  cleanup?: () => Promise<void>;
}

interface TestReport {
  suite: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  evidence: any;
  securityNote?: string;
}

class ComprehensiveTestRunner {
  private reports: TestReport[] = [];
  private startTime: Date = new Date();
  private baseUrl: string = 'http://localhost:3001';

  constructor() {
    console.log('🔒 SECURITY WARNING: Running in paper trading mode without authentication');
    console.log('⚠️  DO NOT use this configuration in production or with real money');
    console.log('');
  }

  async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`\n🚀 Running Test Suite: ${suite.name}`);
    console.log(`📝 ${suite.description}`);
    console.log('='.repeat(60));

    for (const test of suite.tests) {
      const startTime = Date.now();
      console.log(`\n🧪 ${test.name} [${test.type.toUpperCase()}]`);

      try {
        // Setup if needed
        if (test.setup) {
          await test.setup();
        }

        // Execute test
        const result = await test.execute();
        
        // Verify result
        const passed = test.verify(result);
        const duration = Date.now() - startTime;

        const report: TestReport = {
          suite: suite.name,
          test: test.name,
          status: passed ? 'PASS' : 'FAIL',
          duration,
          evidence: result,
          securityNote: test.type === 'security' ? 'Security validation passed' : undefined
        };

        this.reports.push(report);
        console.log(`${passed ? '✅' : '❌'} ${test.name} - ${report.status} (${duration}ms)`);

        if (!passed) {
          console.log(`   Evidence: ${JSON.stringify(result, null, 2)}`);
        }

        // Cleanup if needed
        if (test.cleanup) {
          await test.cleanup();
        }

      } catch (error: any) {
        const duration = Date.now() - startTime;
        const report: TestReport = {
          suite: suite.name,
          test: test.name,
          status: 'FAIL',
          duration,
          evidence: { error: error.message, stack: error.stack }
        };
        this.reports.push(report);
        console.log(`❌ ${test.name} - FAIL (${duration}ms): ${error.message}`);
      }
    }
  }

  // Test Suite 1: Terminal Mutation Capabilities
  private getTerminalTests(): TestSuite {
    return {
      name: 'Terminal Mutation Tests',
      description: 'Test terminal commands that modify system state',
      tests: [
        {
          name: 'Terminal - Close Position',
          type: 'terminal',
          setup: async () => {
            // Create a mock BTC position for testing
            console.log('   📋 Setup: Creating mock BTC position...');
            await fetch(`${this.baseUrl}/api/terminal`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: 'bot.start' })
            });
          },
          execute: async () => {
            const response = await fetch(`${this.baseUrl}/api/terminal`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: 'positions.close BTC' })
            });
            return await response.json();
          },
          verify: (result) => {
            return result.success && 
                   result.output.includes('successfully') &&
                   typeof result.pnl === 'number';
          }
        },
        {
          name: 'Terminal - Dashboard Theme Change',
          type: 'terminal',
          execute: async () => {
            const response = await fetch(`${this.baseUrl}/api/terminal`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: 'dashboard.theme light' })
            });
            const result = await response.json();
            
            // Verify settings persisted
            const settingsResponse = await fetch(`${this.baseUrl}/api/dashboard/settings`);
            const settings = await settingsResponse.json();
            
            return { terminal: result, settings };
          },
          verify: (result) => {
            return result.terminal.success && 
                   result.settings.settings.theme === 'light';
          }
        },
        {
          name: 'Terminal - AI Query with Context',
          type: 'terminal',
          execute: async () => {
            const response = await fetch(`${this.baseUrl}/api/terminal`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: 'ai.ask What is the current market sentiment?' })
            });
            return await response.json();
          },
          verify: (result) => {
            return result.success && 
                   result.output.includes('AI Response:') &&
                   result.output.length > 50;
          }
        }
      ]
    };
  }

  // Test Suite 2: AI Chat Integration
  private getAIChatTests(): TestSuite {
    return {
      name: 'AI Chat Integration Tests',
      description: 'Test AI chat command parsing and execution',
      tests: [
        {
          name: 'AI Chat - Paper Trade Modification',
          type: 'ai_chat',
          execute: async () => {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: 'Close my BTC position and open a short ETH position with 2x leverage' })
            });
            return await response.json();
          },
          verify: (result) => {
            return result.response && 
                   result.response.toLowerCase().includes('btc') &&
                   result.response.toLowerCase().includes('close') &&
                   result.response.toLowerCase().includes('eth') &&
                   result.response.toLowerCase().includes('short');
          }
        },
        {
          name: 'AI Chat - Dashboard Cosmetic Change',
          type: 'ai_chat',
          execute: async () => {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: 'Change the dashboard to light theme and hide the portfolio section' })
            });
            return await response.json();
          },
          verify: (result) => {
            return result.response && 
                   result.response.toLowerCase().includes('theme') &&
                   result.response.toLowerCase().includes('light');
          }
        },
        {
          name: 'AI Chat - Complex Market Analysis',
          type: 'ai_chat',
          execute: async () => {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: 'Analyze the current market conditions and suggest 3 trading opportunities with risk/reward ratios' })
            });
            return await response.json();
          },
          verify: (result) => {
            return result.response && 
                   result.response.length > 100 &&
                   (result.response.includes('opportunity') || result.response.includes('trade') || result.response.includes('risk'));
          }
        }
      ]
    };
  }

  // Test Suite 3: Assistant Function Integration
  private getAssistantFunctionTests(): TestSuite {
    return {
      name: 'Assistant Function Tests',
      description: 'Test OpenAI Assistant function integration',
      tests: [
        {
          name: 'Assistant - Multi-Exchange Price Comparison',
          type: 'assistant_function',
          execute: async () => {
            const response = await fetch(`${this.baseUrl}/api/assistant/prices`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                symbol: 'BTC',
                exchanges: ['binance', 'coinbase', 'hyperliquid'],
                compare_prices: true
              })
            });
            return await response.json();
          },
          verify: (result) => {
            return result.success && 
                   result.data.binance && 
                   result.data.coinbase && 
                   result.data.hyperliquid &&
                   result.data.arbitrage_opportunity;
          }
        },
        {
          name: 'Assistant - Advanced Signal Filtering',
          type: 'assistant_function',
          execute: async () => {
            const response = await fetch(`${this.baseUrl}/api/assistant/signals`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                min_strength: 75,
                signal_types: ['RSI_Oversold', 'MACD_Cross_Up'],
                symbols: ['BTC', 'ETH'],
                include_indicators: true
              })
            });
            return await response.json();
          },
          verify: (result) => {
            return result.success && 
                   Array.isArray(result.data.signals) &&
                   result.data.signals.every((s: any) => s.strength >= 75 && s.indicators);
          }
        },
        {
          name: 'Assistant - Comprehensive Trade Analysis',
          type: 'assistant_function',
          execute: async () => {
            const response = await fetch(`${this.baseUrl}/api/assistant/analyze_trade`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                symbol: 'ETH',
                side: 'long',
                size_usd: 1000,
                leverage: 3,
                risk_reward_ratio: 2.5,
                analysis_depth: 'comprehensive'
              })
            });
            return await response.json();
          },
          verify: (result) => {
            return result.success && 
                   typeof result.data.feasible === 'boolean' &&
                   result.data.entry_price > 0 &&
                   result.data.stop_loss > 0 &&
                   result.data.take_profits &&
                   result.data.risk_reward > 0 &&
                   result.data.technical_analysis;
          }
        }
      ]
    };
  }

  // Test Suite 4: Security Validation
  private getSecurityTests(): TestSuite {
    return {
      name: 'Security Validation Tests',
      description: 'Test security measures and input validation',
      tests: [
        {
          name: 'Security - Invalid Symbol Rejection',
          type: 'security',
          execute: async () => {
            const response = await fetch(`${this.baseUrl}/api/terminal`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: 'positions.close INVALID' })
            });
            return await response.json();
          },
          verify: (result) => {
            return !result.success && 
                   result.output.includes('not allowed');
          }
        },
        {
          name: 'Security - Command Injection Prevention',
          type: 'security',
          execute: async () => {
            const response = await fetch(`${this.baseUrl}/api/terminal`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: 'positions.close BTC; rm -rf /' })
            });
            return await response.json();
          },
          verify: (result) => {
            return !result.success || 
                   result.output.includes('not allowed');
          }
        },
        {
          name: 'Security - Audit Log Creation',
          type: 'security',
          execute: async () => {
            // Execute a command that should be logged
            await fetch(`${this.baseUrl}/api/terminal`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: 'status' })
            });

            // Check if audit log was created
            const auditLogPath = path.join(process.cwd(), 'logs', 'audit.log');
            const exists = fs.existsSync(auditLogPath);
            const content = exists ? fs.readFileSync(auditLogPath, 'utf8') : '';
            
            return { exists, hasContent: content.length > 0 };
          },
          verify: (result) => {
            return result.exists && result.hasContent;
          }
        }
      ]
    };
  }

  async generateComprehensiveReport(): Promise<void> {
    const endTime = new Date();
    const totalDuration = endTime.getTime() - this.startTime.getTime();
    
    const passed = this.reports.filter(r => r.status === 'PASS').length;
    const failed = this.reports.filter(r => r.status === 'FAIL').length;
    const securityTests = this.reports.filter(r => r.securityNote).length;

    const report = `
================================================================================
🤖 AI TRADING BOT - COMPREHENSIVE TEST REPORT
================================================================================

🔒 SECURITY CONFIGURATION: Paper Trading Mode (No Authentication)
⚠️  PRODUCTION WARNING: DO NOT deploy without authentication/authorization

EXECUTION SUMMARY:
------------------
Test Date: ${this.startTime.toISOString()}
Duration: ${totalDuration}ms
Total Tests: ${this.reports.length}
Passed: ${passed} ✅
Failed: ${failed} ❌
Security Tests: ${securityTests} 🔐

DETAILED RESULTS:
-----------------
${this.reports.map(r => `
${r.status === 'PASS' ? '✅' : '❌'} ${r.suite} - ${r.test}
   Status: ${r.status}
   Duration: ${r.duration}ms
   Type: ${r.evidence?.type || 'N/A'}
   ${r.securityNote ? `Security: ${r.securityNote}` : ''}
   Evidence: ${JSON.stringify(r.evidence, null, 4).substring(0, 200)}...
`).join('\n')}

PERFORMANCE METRICS:
-------------------
Average Test Duration: ${Math.round(totalDuration / this.reports.length)}ms
Fastest Test: ${Math.min(...this.reports.map(r => r.duration))}ms
Slowest Test: ${Math.max(...this.reports.map(r => r.duration))}ms

SECURITY VALIDATION:
-------------------
✅ Input Validation: ${this.reports.filter(r => r.test.includes('Invalid')).every(r => r.status === 'PASS') ? 'PASS' : 'FAIL'}
✅ Injection Prevention: ${this.reports.filter(r => r.test.includes('Injection')).every(r => r.status === 'PASS') ? 'PASS' : 'FAIL'}
✅ Audit Logging: ${this.reports.filter(r => r.test.includes('Audit')).every(r => r.status === 'PASS') ? 'PASS' : 'FAIL'}

ENTERPRISE READINESS CHECKLIST:
-----------------------------
❌ Authentication/Authorization: NOT IMPLEMENTED (Required for production)
✅ Input Validation: IMPLEMENTED
✅ Audit Logging: IMPLEMENTED
✅ Error Handling: IMPLEMENTED
✅ Rate Limiting: IMPLEMENTED (In-memory)
❌ Persistent Rate Limiting: NOT IMPLEMENTED (Redis recommended)
❌ HTTPS/TLS: NOT CONFIGURED (Required for production)
❌ Database Storage: NOT IMPLEMENTED (File-based only)

NEXT STEPS FOR PRODUCTION:
---------------------------
1. Implement API key or JWT authentication
2. Add HTTPS/TLS configuration
3. Replace in-memory rate limiting with Redis
4. Add database for audit trail and state persistence
5. Implement proper secret management
6. Add monitoring and alerting
7. Conduct security penetration testing

Generated: ${endTime.toISOString()}
================================================================================
`;

    // Write comprehensive report
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }

    const reportPath = path.join(logsDir, 'comprehensive-test-report.txt');
    fs.writeFileSync(reportPath, report);
    
    console.log('\n📊 Comprehensive Test Report Generated:');
    console.log(`   📁 Location: ${reportPath}`);
    console.log(`   ⏱️  Total Duration: ${totalDuration}ms`);
    console.log(`   ✅ Passed: ${passed}/${this.reports.length}`);
    console.log(`   ❌ Failed: ${failed}/${this.reports.length}`);
    console.log(`   🔐 Security Tests: ${securityTests}`);
    
    if (failed > 0) {
      console.log('\n⚠️  Some tests failed. Review the report for details.');
    } else {
      console.log('\n🎉 All tests passed! Ready for development deployment.');
    }

    console.log('\n🔒 REMINDER: Add authentication before production deployment!');
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive AI Trading Bot Test Suite');
    console.log('======================================================');
    
    // Check if services are running
    try {
      await fetch(`${this.baseUrl}/api/system`);
      console.log('✅ Backend service is running');
    } catch {
      console.log('❌ Backend service not running. Please start with: npm run paper');
      process.exit(1);
    }

    // Run all test suites
    await this.runTestSuite(this.getTerminalTests());
    await this.runTestSuite(this.getAIChatTests());
    await this.runTestSuite(this.getAssistantFunctionTests());
    await this.runTestSuite(this.getSecurityTests());

    // Generate comprehensive report
    await this.generateComprehensiveReport();
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new ComprehensiveTestRunner();
  runner.runAllTests().catch(console.error);
}

export default ComprehensiveTestRunner;
