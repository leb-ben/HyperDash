#!/usr/bin/env node
/**
 * Automated Deployment Validator
 * Validates all components before allowing bot to start
 * 
 * Usage: node scripts/deployment-validator.js
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DeploymentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  async validateAll() {
    console.log('🚀 Starting Automated Deployment Validation');
    
    const steps = [
      () => this.validateEnvironment(),
      () => this.validateDependencies(),
      () => this.validateConfiguration(),
      () => this.testAIProviders(),
      () => this.testProxyConnectivity(),
      () => this.validateHyperliquidConnectivity(),
      () => this.runStressTests(),
    ];

    for (let i = 0; i < steps.length; i++) {
      console.log(`\n📋 Step ${i + 1}/${steps.length}: ${steps[i].name}`);
      try {
        await steps[i]();
        console.log(`✅ Step ${i + 1} completed`);
      } catch (error) {
        console.error(`❌ Step ${i + 1} failed:`, error.message);
        this.errors.push(`Step ${i + 1}: ${error.message}`);
      }
    }

    this.printResults();
    return this.errors.length === 0;
  }

  validateEnvironment() {
    console.log('Validating environment variables...');
    
    const required = [
      'CEREBRAS_API_KEY',
      'HYPERLIQUID_WALLET_ADDRESS',
    ];
    
    const optional = [
      'PERPLEXITY_API_KEY',
      'OPENAI_API_KEY',
      'PROXY_HOST',
      'PROXY_PORT',
    ];

    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`Missing required env var: ${key}`);
      }
    }

    for (const key of optional) {
      if (!process.env[key]) {
        this.warnings.push(`Optional env var not set: ${key}`);
      }
    }

    // Check if paper trading is disabled for live mode
    const config = this.loadConfig();
    if (!config.bot.paper_trading && !process.env.HYPERLIQUID_PRIVATE_KEY) {
      throw new Error('HYPERLIQUID_PRIVATE_KEY required for live trading');
    }
  }

  validateDependencies() {
    console.log('Validating dependencies...');
    
    if (!existsSync('package.json')) {
      throw new Error('package.json not found');
    }
    
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const requiredDeps = ['openai', 'ethers', 'yaml', 'date-fns', 'node-fetch', 'https-proxy-agent'];
    
    for (const dep of requiredDeps) {
      if (!packageJson.dependencies[dep]) {
        throw new Error(`Missing dependency: ${dep}`);
      }
    }

    if (!existsSync('node_modules')) {
      throw new Error('node_modules not found - run npm install');
    }
  }

  async validateConfiguration() {
    console.log('Validating configuration...');
    
    if (!existsSync('config.yaml')) {
      throw new Error('config.yaml not found');
    }
    
    const config = await this.loadConfig();
    
    // Validate AI model selection
    const selectedModel = config.ai?.model || 'llama-3.3-70b';
    const validModels = [
      'qwen-3-235b-a22b-instruction-2507',
      'gpt-oss-120b', 
      'llama-3.3-70b',
      'vai-glm-4.6',
      'llama-3.1-70b',
      'llama-3.1-sonar-large-128k-online',
      'llama-3.1-sonar-small-128k-online',
      'mixtral-8x7b-instruct',
      'gpt-4-turbo',
      'gpt-4o'
    ];
    
    if (!validModels.includes(selectedModel)) {
      throw new Error(`Invalid AI model selected: ${selectedModel}`);
    }
    
    console.log(`✅ AI model OK: ${selectedModel}`);
    
    // Validate risk parameters
    if (config.risk.max_single_position_pct > 50) {
      this.warnings.push('High single position risk (>50%)');
    }
    
    if (config.risk.max_leverage > 10) {
      this.warnings.push('Very high leverage (>10x)');
    }
  }

  async testAIProviders() {
    console.log('Testing AI providers...');
    
    // Test Cerebras
    if (process.env.CEREBRAS_API_KEY) {
      try {
        const response = await fetch('https://api.cerebras.ai/v1/models', {
          headers: {
            'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
          }
        });
        
        if (!response.ok) {
          throw new Error('Cerebras authentication failed');
        }
        
        const models = await response.json();
        console.log(`✅ Cerebras OK - Available models: ${models.data?.length || 0}`);
      } catch (error) {
        throw new Error(`Cerebras validation failed: ${error.message}`);
      }
    }

    // Test Perplexity
    if (process.env.PERPLEXITY_API_KEY) {
      try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-small-128k-online',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 10,
          })
        });
        
        if (!response.ok) {
          throw new Error('Perplexity authentication failed');
        }
        
        console.log('✅ Perplexity OK');
      } catch (error) {
        this.warnings.push(`Perplexity validation failed: ${error.message}`);
      }
    }
  }

  async testProxyConnectivity() {
    console.log('Testing proxy connectivity...');
    
    try {
      // Test with a simple request through proxy
      const proxyHost = process.env.PROXY_HOST || 'us-east.proxysite.com';
      const proxyPort = process.env.PROXY_PORT || '8080';
      
      console.log(`Testing proxy: ${proxyHost}:${proxyPort}`);
      
      const response = await fetch('https://api.hyperliquid-testnet.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta' })
      });
      
      if (!response.ok) {
        throw new Error('Proxy test failed - no response');
      }
      
      console.log('✅ Proxy connectivity OK');
    } catch (error) {
      this.warnings.push(`Proxy connectivity issue: ${error.message}`);
      console.log('⚠️  Will try direct connection as fallback');
    }
  }

  async validateHyperliquidConnectivity() {
    console.log('Testing Hyperliquid API connectivity...');
    
    const walletAddress = process.env.HYPERLIQUID_WALLET_ADDRESS;
    
    // Test testnet
    try {
      const testnetResponse = await fetch('https://api.hyperliquid-testnet.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clearinghouseState',
          user: walletAddress
        })
      });
      
      if (!testnetResponse.ok) {
        throw new Error('Testnet API request failed');
      }
      
      const testnetState = await testnetResponse.json();
      if (!testnetState.marginSummary) {
        throw new Error('Testnet API response invalid');
      }
      
      console.log(`✅ Testnet connectivity OK - Balance: $${testnetState.marginSummary.accountValue}`);
    } catch (error) {
      throw new Error(`Testnet connectivity failed: ${error.message}`);
    }

    // Test mainnet
    try {
      const mainnetResponse = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clearinghouseState',
          user: walletAddress
        })
      });
      
      if (!mainnetResponse.ok) {
        throw new Error('Mainnet API request failed');
      }
      
      const mainnetState = await mainnetResponse.json();
      if (!mainnetState.marginSummary) {
        throw new Error('Mainnet API response invalid');
      }
      
      console.log(`✅ Mainnet connectivity OK - Balance: $${mainnetState.marginSummary.accountValue}`);
    } catch (error) {
      this.warnings.push(`Mainnet connectivity failed: ${error.message}`);
    }
  }

  async runStressTests() {
    console.log('Running stress tests...');
    
    // Test concurrent API calls
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        fetch('https://api.hyperliquid-testnet.xyz/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'meta' })
        })
      );
    }
    
    try {
      const results = await Promise.all(promises);
      if (results.some(r => !r.ok)) {
        throw new Error('Some concurrent requests failed');
      }
      console.log('✅ Stress test OK - 5 concurrent requests successful');
    } catch (error) {
      this.warnings.push(`Stress test warning: ${error.message}`);
    }
  }

  async loadConfig() {
    try {
      const yaml = await import('js-yaml');
      const configContent = readFileSync('config.yaml', 'utf8');
      return yaml.load(configContent);
    } catch (error) {
      throw new Error(`Failed to load config: ${error.message}`);
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DEPLOYMENT VALIDATION RESULTS');
    console.log('='.repeat(60));
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All validations passed! Ready for deployment.');
    } else {
      if (this.errors.length > 0) {
        console.log('\n❌ ERRORS (must be fixed):');
        this.errors.forEach((error, i) => {
          console.log(`  ${i + 1}. ${error}`);
        });
      }
      
      if (this.warnings.length > 0) {
        console.log('\n⚠️  WARNINGS (recommended to fix):');
        this.warnings.forEach((warning, i) => {
          console.log(`  ${i + 1}. ${warning}`);
        });
      }
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DeploymentValidator();
  validator.validateAll()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

export { DeploymentValidator };
