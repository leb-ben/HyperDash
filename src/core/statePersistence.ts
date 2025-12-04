/**
 * State Persistence Manager
 * Saves and loads trading state to prevent data loss on crashes/restarts
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { tradingModeManager } from './tradingModeManager.js';

// Forward declare types to avoid circular dependency
interface RealisticPortfolio {
  usdtBalance: number;
  positions: Map<string, number>;
  pendingOrders: Map<string, any>;
  totalFeesPaid: number;
  tradeHistory: any[];
}

export interface PersistedState {
  timestamp: number;
  tradingMode: string;
  portfolio: RealisticPortfolio;
  testStartTime?: number;
  cycleCount: number;
  lastSaved: number;
  botStartTime: number;
  totalRuntime: number;
}

export class StatePersistence {
  private dataDir: string;
  private stateFile: string;
  private backupFile: string;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private readonly AUTO_SAVE_INTERVAL_MS = 30000; // Save every 30 seconds
  private botStartTime: number;
  private initializationPromise: Promise<void>;

  constructor() {
    this.botStartTime = Date.now();
    this.dataDir = path.join(process.cwd(), 'data');
    this.stateFile = path.join(this.dataDir, 'trading-state.json');
    this.backupFile = path.join(this.dataDir, 'trading-state-backup.json');
    
    this.ensureDataDirectory();
    
    // Store initialization promise for callers to await
    this.initializationPromise = this.loadState().then(() => {
      // Convert boolean result to void
    });
    
    this.startAutoSave();
  }

  /**
   * Await this method to ensure state is fully loaded before using the instance
   */
  async initialize(): Promise<void> {
    await this.initializationPromise;
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      logger.info('📁 Created data directory for state persistence');
    }
  }

  /**
   * Save current trading state to disk
   */
  async saveState(force: boolean = false): Promise<void> {
    try {
      const now = Date.now();
      
      // Get current state from trading mode manager
      const portfolio = tradingModeManager.getPortfolioState();
      const config = tradingModeManager.getConfig();
      
      // Convert Maps to arrays for JSON serialization
      const serializablePortfolio = {
        ...portfolio,
        positions: Array.from(portfolio.positions.entries()),
        pendingOrders: Array.from(portfolio.pendingOrders.entries())
      };
      
      const state: PersistedState = {
        timestamp: now,
        tradingMode: config.mode,
        portfolio: serializablePortfolio,
        cycleCount: 0, // Will be updated by bot controller
        lastSaved: now,
        botStartTime: this.botStartTime || now,
        totalRuntime: now - (this.botStartTime || now)
      };

      // Create backup before overwriting
      if (fs.existsSync(this.stateFile)) {
        fs.copyFileSync(this.stateFile, this.backupFile);
      }

      // Save main state
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
      
      if (force) {
        logger.info('Trading state saved to disk');
      }
      
    } catch (error: any) {
      logger.error('Failed to save state:', error);
    }
  }

  /**
   * Load trading state from disk
   */
  async loadState(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.stateFile)) {
        logger.info('No existing state found, starting fresh');
        return false;
      }

      const stateData = fs.readFileSync(this.stateFile, 'utf8');
      const state: PersistedState = JSON.parse(stateData);
      
      logger.info(`📂 Loading state from ${new Date(state.timestamp).toLocaleString()}`);
      
      // Restore state based on trading mode
      if (state.tradingMode === 'realistic_paper' && state.portfolio) {
        // Convert arrays back to Maps for restoration
        const restoredPortfolio = {
          ...state.portfolio,
          positions: new Map(state.portfolio.positions),
          pendingOrders: new Map(state.portfolio.pendingOrders)
        };
        
        // Restore realistic paper trader state
        await this.restoreRealisticPaperTrader(restoredPortfolio);
        
        logger.info(`State restored: $${restoredPortfolio.usdtBalance.toFixed(2)} USDT, ${restoredPortfolio.positions.size} positions, ${restoredPortfolio.pendingOrders.size} pending orders`);
        return true;
      }
      
      return false;
      
    } catch (error: any) {
      logger.error('Failed to load state:', error);
      
      // Try to load from backup
      if (fs.existsSync(this.backupFile)) {
        logger.info('Attempting to restore from backup...');
        try {
          const backupData = fs.readFileSync(this.backupFile, 'utf8');
          const backupState: PersistedState = JSON.parse(backupData);
          
          if (backupState.tradingMode === 'realistic_paper' && backupState.portfolio) {
            await this.restoreRealisticPaperTrader(backupState.portfolio);
            logger.info('State restored from backup');
            return true;
          }
        } catch (backupError) {
          logger.error('Failed to restore from backup:', backupError);
        }
      }
      
      return false;
    }
  }

  private async restoreRealisticPaperTrader(portfolio: RealisticPortfolio): Promise<void> {
    try {
      // Dynamic import to avoid circular dependency
      const { realisticPaperTrader } = await import('./realisticPaperTrader.js');
      
      // Use the new complete state restoration method
      realisticPaperTrader.restoreCompleteState(portfolio);
      
      logger.info(`Restored realistic paper trader with $${portfolio.usdtBalance.toFixed(2)} USDT, ${portfolio.positions.size} positions, ${portfolio.pendingOrders.size} pending orders`);
    } catch (error) {
      logger.error('Failed to restore realistic paper trader:', error);
    }
  }

  /**
   * Start automatic state saving
   */
  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.saveState();
    }, this.AUTO_SAVE_INTERVAL_MS);
    
    logger.info(`⏰ Auto-save enabled (every ${this.AUTO_SAVE_INTERVAL_MS / 1000} seconds)`);
  }

  /**
   * Stop automatic state saving
   */
  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
      logger.info('⏹️ Auto-save stopped');
    }
  }

  /**
   * Get state information
   */
  getStateInfo(): {
    hasState: boolean;
    lastSaved?: number;
    fileSize?: number;
    backupExists: boolean;
  } {
    const hasState = fs.existsSync(this.stateFile);
    const backupExists = fs.existsSync(this.backupFile);
    
    let lastSaved: number | undefined;
    let fileSize: number | undefined;
    
    if (hasState) {
      const stats = fs.statSync(this.stateFile);
      lastSaved = stats.mtime.getTime();
      fileSize = stats.size;
    }
    
    return {
      hasState,
      lastSaved,
      fileSize,
      backupExists
    };
  }

  /**
   * Clear all saved state
   */
  clearState(): void {
    try {
      if (fs.existsSync(this.stateFile)) {
        fs.unlinkSync(this.stateFile);
      }
      
      if (fs.existsSync(this.backupFile)) {
        fs.unlinkSync(this.backupFile);
      }
      
      logger.info('🗑️ All saved state cleared');
    } catch (error: any) {
      logger.error('Failed to clear state:', error);
    }
  }

  /**
   * Force save state before shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down state persistence...');
    
    this.stopAutoSave();
    await this.saveState(true);
    
    logger.info('State persistence shutdown complete');
  }
}

export const statePersistence = new StatePersistence();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, saving state...');
  await statePersistence.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, saving state...');
  await statePersistence.shutdown();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception, saving state before exit:', error);
  await statePersistence.shutdown();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled rejection, saving state before exit:', reason);
  await statePersistence.shutdown();
  process.exit(1);
});
