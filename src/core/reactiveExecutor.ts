/**
 * Reactive Trade Executor
 * 
 * Executes trades based on real-time signals:
 * - Instant reaction to high-urgency signals
 * - Position management based on signal direction
 * - Risk-adjusted position sizing
 * - Automatic stop-loss placement
 */

import { logger, tradeLog } from '../utils/logger.js';
import { errorHandler } from './errorHandler.js';
import { signalProcessor, type TradingSignal, SignalDirection, SignalUrgency, SignalType } from './signalProcessor.js';
import { safetyManager } from './safetyManager.js';
import { feesCalculator } from './tradingFees.js';
import { riskManager } from './riskManager.js';
import { paperPortfolio } from './portfolio.js';
import { config } from '../config/settings.js';
// import { tradingModeManager } from './tradingModeManager.js'; // Temporarily disabled for debugging

interface ExecutionConfig {
  enabled: boolean;
  minSignalStrength: number;
  minUrgency: SignalUrgency;
  maxPositionPct: number;
  defaultLeverage: number;
  cooldownMs: number;
  requireConfirmation: boolean;
}

interface ExecutionResult {
  success: boolean;
  signal: TradingSignal;
  action: 'open_long' | 'open_short' | 'close' | 'skip' | 'error';
  reason: string;
  tradeId?: string;
  executedPrice?: number;
  size?: number;
  fees?: number;
}

const DEFAULT_CONFIG: ExecutionConfig = {
  enabled: true,
  minSignalStrength: 60,
  minUrgency: SignalUrgency.MEDIUM,
  maxPositionPct: 10,
  defaultLeverage: 3,
  cooldownMs: 30000, // 30 second cooldown per symbol
  requireConfirmation: false
};

class ReactiveExecutor {
  private config: ExecutionConfig;
  private lastExecutionTime: Map<string, number> = new Map();
  private executionHistory: ExecutionResult[] = [];
  private isListening: boolean = false;

  constructor(config: Partial<ExecutionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start listening for signals
   */
  start(): void {
    if (this.isListening) return;
    
    this.isListening = true;
    
    // Listen for urgent signals
    signalProcessor.on('urgent-signal', (signal: TradingSignal) => {
      this.handleSignal(signal);
    });
    
    // Listen for all signals if confirmation not required
    if (!this.config.requireConfirmation) {
      signalProcessor.on('signal', (signal: TradingSignal) => {
        if (signal.urgency >= this.config.minUrgency && signal.strength >= this.config.minSignalStrength) {
          this.handleSignal(signal);
        }
      });
    }
    
    logger.info('Reactive executor started - listening for signals');
  }

  /**
   * Stop listening
   */
  stop(): void {
    this.isListening = false;
    signalProcessor.removeAllListeners('urgent-signal');
    signalProcessor.removeAllListeners('signal');
    logger.info('Reactive executor stopped');
  }

  /**
   * Handle incoming signal
   */
  private async handleSignal(signal: TradingSignal): Promise<void> {
    if (!this.config.enabled || !this.isListening) return;
    
    try {
      // Check safety
      const portfolioState = paperPortfolio.getState();
      const safetyCheck = safetyManager.checkSafety(portfolioState.totalValue);
      
      if (!safetyCheck.safe) {
        logger.warn(`Safety check failed: ${safetyCheck.reason}`);
        return;
      }
      
      // Check cooldown
      const lastExec = this.lastExecutionTime.get(signal.symbol);
      if (lastExec && Date.now() - lastExec < this.config.cooldownMs) {
        return; // Still in cooldown
      }
      
      // Evaluate and execute
      const result = await this.evaluateAndExecute(signal);
      this.recordExecution(result);
      
      if (result.success) {
        this.lastExecutionTime.set(signal.symbol, Date.now());
        logger.info(`Executed: ${signal.symbol} ${result.action} (strength: ${signal.strength}%, type: ${signal.type})`);
      }
    } catch (error) {
      errorHandler.processError(error, {
        operation: 'handleSignal',
        component: 'ReactiveExecutor',
        metadata: { signal }
      });
    }
  }

  /**
   * Evaluate signal and execute trade
   */
  private async evaluateAndExecute(signal: TradingSignal): Promise<ExecutionResult> {
    const portfolioState = paperPortfolio.getState();
    const existingPosition = portfolioState.positions.find(p => p.symbol === signal.symbol);
    
    // Skip conditions
    if (signal.strength < this.config.minSignalStrength) {
      return this.skipResult(signal, 'Signal strength too low');
    }
    
    if (signal.direction === SignalDirection.NEUTRAL) {
      return this.skipResult(signal, 'Neutral signal');
    }

    // Check if we should exit based on signal
    if (signal.type === SignalType.STOP_LOSS_HIT || signal.type === SignalType.TAKE_PROFIT_HIT) {
      if (existingPosition) {
        return this.executeClose(signal, existingPosition);
      }
      return this.skipResult(signal, 'No position to close');
    }

    // If we have a position, check if signal conflicts
    if (existingPosition) {
      const positionDirection = existingPosition.side === 'long' ? SignalDirection.LONG : SignalDirection.SHORT;
      
      // Conflicting signal - close position
      if (signal.direction !== positionDirection && signal.strength >= 70) {
        return this.executeClose(signal, existingPosition);
      }
      
      // Same direction - skip (already in position)
      return this.skipResult(signal, 'Already in position with same direction');
    }

    // No position - open new one based on signal
    if (signal.direction === SignalDirection.LONG) {
      return this.executeOpen(signal, 'long');
    } else if (signal.direction === SignalDirection.SHORT) {
      return this.executeOpen(signal, 'short');
    }

    return this.skipResult(signal, 'No action determined');
  }

  /**
   * Execute open position
   */
  private async executeOpen(signal: TradingSignal, side: 'long' | 'short'): Promise<ExecutionResult> {
    try {
      const portfolioState = paperPortfolio.getState();
      
      // Calculate position size based on signal strength
      const strengthMultiplier = signal.strength / 100;
      const maxPosition = portfolioState.availableBalance * (this.config.maxPositionPct / 100);
      const positionValue = maxPosition * strengthMultiplier;
      
      // Apply fees
      const costs = feesCalculator.calculateTradeCosts(
        positionValue,
        side,
        true, // market order
        signal.price
      );
      
      const size = (positionValue - costs.totalCost) / costs.effectivePrice;
      
      // Validate with risk manager
      const coinConfig = config.coins.tracked.find((c: { symbol: string }) => c.symbol === signal.symbol);
      const leverage = coinConfig?.leverage || this.config.defaultLeverage;
      
      // Execute trade using basic paper trading (realistic mode temporarily disabled)
      if (config.bot.paper_trading) {
        // Use existing simulation mode
        // Set stop loss at 5% from entry
        const stopLoss = side === 'long' 
          ? costs.effectivePrice * 0.95 
          : costs.effectivePrice * 1.05;
        
        // Set take profit at 10% from entry
        const takeProfit = side === 'long'
          ? costs.effectivePrice * 1.10
          : costs.effectivePrice * 0.90;
        
        paperPortfolio.openPosition(
          signal.symbol,
          side,
          size,
          costs.effectivePrice,
          leverage,
          stopLoss,
          takeProfit
        );
        
        logger.info(`REACTIVE TRADE: ${side.toUpperCase()} ${signal.symbol} @ $${costs.effectivePrice.toFixed(2)} (size: ${size.toFixed(6)}, signal: ${signal.type})`);
        
        return {
          success: true,
          signal,
          action: side === 'long' ? 'open_long' : 'open_short',
          reason: `Opened ${side} position on ${signal.type}`,
          executedPrice: costs.effectivePrice,
          size,
          fees: costs.totalCost
        };
      }
      
      // Live trading would go here
      return this.skipResult(signal, 'Live trading not implemented');
      
    } catch (error) {
      return {
        success: false,
        signal,
        action: 'error',
        reason: `Execution error: ${error}`
      };
    }
  }

  /**
   * Execute close position
   */
  private async executeClose(signal: TradingSignal, position: any): Promise<ExecutionResult> {
    try {
      const costs = feesCalculator.calculateTradeCosts(
        position.size * signal.price,
        position.side === 'long' ? 'short' : 'long',
        true,
        signal.price
      );
      
      if (config.bot.paper_trading) {
        // Use existing simulation mode for now
        paperPortfolio.closePosition(signal.symbol, costs.effectivePrice, signal.type);
        
        logger.info(`REACTIVE CLOSE: ${signal.symbol} @ $${costs.effectivePrice.toFixed(2)} (signal: ${signal.type})`);
        
        return {
          success: true,
          signal,
          action: 'close',
          reason: `Closed position on ${signal.type}`,
          executedPrice: costs.effectivePrice,
          fees: costs.totalCost
        };
      }
      
      return this.skipResult(signal, 'Live trading not implemented');
      
    } catch (error) {
      return {
        success: false,
        signal,
        action: 'error',
        reason: `Close error: ${error}`
      };
    }
  }

  /**
   * Create skip result
   */
  private skipResult(signal: TradingSignal, reason: string): ExecutionResult {
    return {
      success: false,
      signal,
      action: 'skip',
      reason
    };
  }

  /**
   * Record execution
   */
  private recordExecution(result: ExecutionResult): void {
    this.executionHistory.unshift(result);
    if (this.executionHistory.length > 100) {
      this.executionHistory.pop();
    }
  }

  /**
   * Get execution history
   */
  getHistory(limit: number = 20): ExecutionResult[] {
    return this.executionHistory.slice(0, limit);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    skippedExecutions: number;
    errorExecutions: number;
    totalFees: number;
  } {
    let successful = 0;
    let skipped = 0;
    let errors = 0;
    let totalFees = 0;
    
    for (const result of this.executionHistory) {
      if (result.success) {
        successful++;
        totalFees += result.fees || 0;
      } else if (result.action === 'error') {
        errors++;
      } else {
        skipped++;
      }
    }
    
    return {
      totalExecutions: this.executionHistory.length,
      successfulExecutions: successful,
      skippedExecutions: skipped,
      errorExecutions: errors,
      totalFees
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ExecutionConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('Reactive executor config updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): ExecutionConfig {
    return { ...this.config };
  }

  /**
   * Process pending orders (called by main bot loop)
   */
  processPendingOrders(): Array<{ orderId: string; executed: boolean; message: string }> {
    // return tradingModeManager.processPendingOrders(); // Temporarily disabled
    return []; // No pending orders in basic mode
  }

  /**
   * Enable/disable executor
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    logger.info(`Reactive executor ${enabled ? 'enabled' : 'disabled'}`);
  }
}

export const reactiveExecutor = new ReactiveExecutor();
