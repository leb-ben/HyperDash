import { readFileSync, existsSync, mkdirSync } from 'fs';
import { parse } from 'yaml';
import { config as loadEnv } from 'dotenv';
import type { BotConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Load environment variables
loadEnv();

// Ensure data directory exists
if (!existsSync('data')) {
  mkdirSync('data', { recursive: true });
}

function loadConfig(): BotConfig {
  const configPath = 'config.yaml';
  
  if (!existsSync(configPath)) {
    logger.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const fileContents = readFileSync(configPath, 'utf8');
    const config = parse(fileContents) as BotConfig;
    
    // Override with environment variables
    if (process.env.PAPER_TRADING !== undefined) {
      config.bot.paper_trading = process.env.PAPER_TRADING === 'true';
    }
    
    if (process.env.HYPERLIQUID_TESTNET !== undefined) {
      config.exchange.testnet = process.env.HYPERLIQUID_TESTNET === 'true';
    }
    
    if (process.env.LOG_LEVEL) {
      config.logging.level = process.env.LOG_LEVEL;
    }

    return config;
  } catch (error) {
    logger.error(`Failed to parse config: ${error}`);
    process.exit(1);
  }
}

export const config = loadConfig();

// Environment variable getters with validation
export function getEnvRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    logger.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
}

export function getEnvOptional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// Validate configuration
export function validateConfig(): boolean {
  const errors: string[] = [];

  // Check required env vars for live trading
  if (!config.bot.paper_trading) {
    if (!process.env.HYPERLIQUID_PRIVATE_KEY) {
      errors.push('HYPERLIQUID_PRIVATE_KEY required for live trading');
    }
    if (!process.env.HYPERLIQUID_WALLET_ADDRESS) {
      errors.push('HYPERLIQUID_WALLET_ADDRESS required for live trading');
    }
  }

  if (!process.env.CEREBRAS_API_KEY) {
    errors.push('CEREBRAS_API_KEY required');
  }

  // Validate risk settings
  if (config.risk.max_leverage > 50) {
    errors.push('max_leverage cannot exceed 50');
  }

  if (config.risk.min_stable_pct + config.risk.max_total_exposure_pct > 100) {
    errors.push('min_stable_pct + max_total_exposure_pct cannot exceed 100');
  }

  // Validate coin allocations
  const totalMaxAllocation = config.coins.tracked.reduce(
    (sum, coin) => sum + coin.max_position_pct,
    0
  );
  if (totalMaxAllocation > 100 - config.risk.min_stable_pct) {
    logger.warn(
      `Total max coin allocation (${totalMaxAllocation}%) exceeds ` +
      `available after stable reserve (${100 - config.risk.min_stable_pct}%)`
    );
  }

  if (errors.length > 0) {
    errors.forEach(err => logger.error(`Config Error: ${err}`));
    return false;
  }

  logger.info('Configuration validated successfully');
  return true;
}

export default config;
