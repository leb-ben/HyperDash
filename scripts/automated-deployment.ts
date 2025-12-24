#!/usr/bin/env node
/**
 * Automated Deployment & Testing Workflow
 * Validates all components before allowing bot to start
 * 
 * Steps:
 * 1. Environment validation
 * 2. Proxy connectivity test
 * 3. AI provider authentication
 * 4. Model availability verification
 * 5. Hyperliquid API connectivity
 * 6. Configuration validation
 * 7. Stress testing
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { logger } from '../src/utils/logger.js';
import { hyperliquidProxy } from '../src/utils/hyperliquidProxy.js';
import { AI_MODELS, getModelById } from '../src/core/aiProviderRegistry.js';
import { config, getEnvRequired, getEnvOptional } from '../src/config/settings.js';

class DeploymentValidator {
  private errors: string[] = [];
  private warnings: string[] = [];

  async validateAll(): Promise<boolean> {
    logger.info('🚀 Starting Automated Deployment Validation');
    
    const steps = [
      () => this.validateEnvironment(),
      () => this.validateDependencies(),
      () => this.testProxyConnectivity(),
      () => this.validateAIProviders(),
      () => this.testHyperliquidConnectivity(),
      () => this.validateConfiguration(),
      () => this.runStressTests(),
    ];

    for (let i = 0; i < steps.length; i++) {
      logger.info(`\n📋 Step ${i + 1}/${steps.length}: ${steps[i].name}`);
      try {
        await steps[i]();
        logger.info(`✅ Step ${i + 1} completed`);
      } catch (error) {
        logger.error(`❌ Step ${i + 1} failed:`, error);
        this.errors.push(`Step ${i + 1}: ${error}`);
      }
    }

    this.printResults();
    return this.errors.length === 0;
  }

  private validateEnvironment(): void {
    logger.info('Validating environment variables...');
    
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

    // Validate trading mode
    if (!config.bot.paper_trading) {
      if (!process.env.HYPERLIQUID_PRIVATE_KEY) {
        throw new Error('HYPERLIQUID_PRIVATE_KEY required for live trading');
      }
    }
  }

  private validateDependencies(): void {
    logger.info('Validating dependencies...');
    
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const requiredDeps = ['openai', 'ethers', 'yaml', 'date-fns'];
    
    for (const dep of requiredDeps) {
      if (!packageJson.dependencies[dep]) {
        throw new Error(`Missing dependency: ${dep}`);
      }
    }

    // Check if node_modules exists
    if (!existsSync('node_modules')) {
      throw new Error('node_modules not found - run npm install');
    }
  }

  private async testProxyConnectivity(): Promise<void> {
    logger.info('Testing proxy connectivity...');
    
    try {
      // Test proxy with a simple request
      const response = await hyperliquidProxy.makeRequest('https://api.hyperliquid-testnet.xyz/info', {
        type: 'meta'
      });
      
      if (!response) {
        throw new Error('Proxy test failed - no response');
      }
      
      logger.info('Proxy connectivity OK');
    } catch (error) {
      this.warnings.push(`Proxy connectivity issue: ${error}`);
      
      // Try without proxy as fallback
      try {
        const directResponse = await fetch('https://api.hyperliquid-testnet.xyz/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'meta' })
        });
        
        if (directResponse.ok) {
          logger.warn('Direct connection works, but proxy failed - may have US IP issues');
        } else {
          throw new Error('Both proxy and direct connection failed');
        }
      } catch (directError) {
        throw new Error(`Proxy and direct connection both failed: ${directError}`);
      }
    }
  }

  private async validateAIProviders(): Promise<void> {
    logger.info('Validating AI providers...');
    
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
        const availableModels = models.data?.map((m: any) => m.id) || [];
        logger.info(`Cerebras OK - Available models: ${availableModels.length}`);
      } catch (error) {
        throw new Error(`Cerebras validation failed: ${error}`);
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
        
        logger.info('Perplexity OK');
      } catch (error) {
        this.warnings.push(`Perplexity validation failed: ${error}`);
      }
    }

    // Test OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          }
        });
        
        if (!response.ok) {
          throw new Error('OpenAI authentication failed');
        }
        
        logger.info('OpenAI OK');
      } catch (error) {
        this.warnings.push(`OpenAI validation failed: ${error}`);
      }
    }
  }

  private async testHyperliquidConnectivity(): Promise<void> {
    logger.info('Testing Hyperliquid API connectivity...');
    
    const walletAddress = getEnvRequired('HYPERLIQUID_WALLET_ADDRESS');
    
    // Test testnet
    try {
      const testnetResponse = await hyperliquidProxy.makeRequest('https://api.hyperliquid-testnet.xyz/info', {
        type: 'clearinghouseState',
        user: walletAddress
      });
      
      if (!testnetResponse.marginSummary) {
        throw new Error('Testnet API response invalid');
      }
      
      logger.info(`Testnet connectivity OK - Balance: $${testnetResponse.marginSummary.accountValue}`);
    } catch (error) {
      throw new Error(`Testnet connectivity failed: ${error}`);
    }

    // Test mainnet
    try {
      const mainnetResponse = await hyperliquidProxy.makeRequest('https://api.hyperliquid.xyz/info', {
        type: 'clearinghouseState',
        user: walletAddress
      });
      
      if (!mainnetResponse.marginSummary) {
        throw new Error('Mainnet API response invalid');
      }
      
      logger.info(`Mainnet connectivity OK - Balance: $${mainnetResponse.marginSummary.accountValue}`);
    } catch (error) {
      this.warnings.push(`Mainnet connectivity failed: ${error}`);
    }
  }

  private validateConfiguration(): void {
    logger.info('Validating configuration...');
    
    // Check config.yaml
    if (!existsSync('config.yaml')) {
      throw new Error('config.yaml not found');
    }
    
    // Validate AI model selection
    const selectedModel = config.ai?.model || 'llama-3.3-70b';
    const model = getModelById(selectedModel);
    
    if (!model) {
      throw new Error(`Invalid AI model selected: ${selectedModel}`);
    }
    
    logger.info(`AI model OK: ${model.name} (${model.provider})`);
    
    // Validate risk parameters
    if (config.risk.max_single_position_pct > 50) {
      this.warnings.push('High single position risk (>50%)');
    }
    
    if (config.risk.max_leverage > 10) {
      this.warnings.push('Very high leverage (>10x)');
    }
  }

  private async runStressTests(): Promise<void> {
    logger.info('Running stress tests...');
    
    // Test concurrent API calls
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        hyperliquidProxy.makeRequest('https://api.hyperliquid-testnet.xyz/info', {
          type: 'meta'
        })
      );
    }
    
    try {
      const results = await Promise.all(promises);
      if (results.some(r => !r)) {
        throw new Error('Some concurrent requests failed');
      }
      logger.info('Stress test OK - 5 concurrent requests successful');
    } catch (error) {
      this.warnings.push(`Stress test warning: ${error}`);
    }
  }

  private printResults(): void {
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
      logger.error('Validation failed:', error);
      process.exit(1);
    });
}

export { DeploymentValidator };
