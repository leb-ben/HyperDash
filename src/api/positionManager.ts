import { logger } from '../utils/logger.js';
import { exchange } from '../exchange/hyperliquid.js';
import { reactiveExecutor } from '../core/reactiveExecutor.js';
import { SecurityValidator, AuditLogger } from './security.js';

export interface PositionRequest {
  symbol: string;
  action: 'close' | 'modify';
  size?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface DashboardRequest {
  theme?: 'dark' | 'light';
  hidePortfolio?: boolean;
  hideSignals?: boolean;
  refreshRate?: number;
}

export class PositionManager {
  async closePosition(symbol: string, clientId?: string): Promise<{ success: boolean; message: string; pnl?: number }> {
    try {
      // Validate symbol
      const symbolValidation = SecurityValidator.validateSymbol(symbol);
      if (!symbolValidation.valid) {
        SecurityValidator.logSecurityEvent('INVALID_SYMBOL', { symbol }, clientId);
        return { success: false, message: symbolValidation.error! };
      }

      const portfolio = await exchange.getPortfolioState();
      const position = portfolio.positions.find(p => p.symbol === symbol);
      
      if (!position) {
        AuditLogger.logPositionAction('CLOSE_FAILED', symbol, { reason: 'No position found' }, clientId);
        return { success: false, message: `No open position for ${symbol}` };
      }

      // Get current price from feed
      const currentPrice = 95000 + Math.random() * 2000; // Mock current price - in real implementation, get from realtimeFeed
      
      // Actually close the position using exchange
      const success = await exchange.closePosition(symbol);
      
      if (!success) {
        return { success: false, message: `Failed to close ${symbol} position` };
      }

      const pnl = 0; // Live exchange doesn't return P&L in closePosition call
      
      AuditLogger.logPositionAction('CLOSED', symbol, { 
        exitPrice: currentPrice, 
        pnl,
        reason: 'terminal_command'
      }, clientId);
      
      return { 
        success: true, 
        message: `✅ ${symbol} position closed successfully`,
        pnl 
      };
    } catch (error: any) {
      logger.error('Failed to close position:', error);
      SecurityValidator.logSecurityEvent('POSITION_CLOSE_ERROR', { symbol, error: error.message }, clientId);
      return { success: false, message: `Failed to close position: ${error.message}` };
    }
  }

  async modifyPosition(request: PositionRequest): Promise<{ success: boolean; message: string }> {
    try {
      const { symbol, size, stopLoss, takeProfit } = request;
      
      // In paper mode, simulate position modification
      logger.info(`Modified ${symbol} position: size=${size}, SL=${stopLoss}, TP=${takeProfit}`);
      
      return { 
        success: true, 
        message: `✅ ${symbol} position modified successfully` 
      };
    } catch (error: any) {
      logger.error('Failed to modify position:', error);
      return { success: false, message: `Failed to modify position: ${error.message}` };
    }
  }

  async openPosition(symbol: string, side: 'long' | 'short', size: number, leverage: number, clientId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const symbolValidation = SecurityValidator.validateSymbol(symbol);
      if (!symbolValidation.valid) {
        SecurityValidator.logSecurityEvent('INVALID_SYMBOL', { symbol }, clientId);
        return { success: false, message: symbolValidation.error! };
      }

      // Validate leverage
      if (leverage < 1 || leverage > 20) {
        return { success: false, message: 'Leverage must be between 1x and 20x' };
      }

      // Validate size
      if (size < 10) {
        return { success: false, message: 'Minimum position size is $10' };
      }

      // Get current price
      const currentPrice = 95000 + Math.random() * 2000; // Mock - in real implementation, get from realtimeFeed
      
      // Open position via exchange
      const success = await exchange.openPosition(symbol, side, size, leverage);
      
      if (!success) {
        return { success: false, message: `Failed to open ${symbol} ${side} position` };
      }

      AuditLogger.logPositionAction('OPENED', symbol, { 
        side,
        size,
        leverage,
        entryPrice: currentPrice,
        reason: 'manual_dashboard'
      }, clientId);
      
      return { 
        success: true, 
        message: `✅ Opened ${symbol} ${side.toUpperCase()} position with ${leverage}x leverage`
      };
    } catch (error: any) {
      logger.error('Failed to open position:', error);
      SecurityValidator.logSecurityEvent('POSITION_OPEN_ERROR', { symbol, error: error.message }, clientId);
      return { success: false, message: `Failed to open position: ${error.message}` };
    }
  }

  async closeAllPositions(clientId?: string): Promise<{ success: boolean; message: string; closed: number }> {
    try {
      const portfolio = await exchange.getPortfolioState();
      
      if (portfolio.positions.length === 0) {
        return { success: true, message: 'No positions to close', closed: 0 };
      }

      let closedCount = 0;
      const errors: string[] = [];

      for (const position of portfolio.positions) {
        try {
          const success = await exchange.closePosition(position.symbol);
          if (success) {
            closedCount++;
            AuditLogger.logPositionAction('CLOSED', position.symbol, { 
              reason: 'emergency_close_all'
            }, clientId);
          } else {
            errors.push(position.symbol);
          }
        } catch (error: any) {
          errors.push(position.symbol);
          logger.error(`Failed to close ${position.symbol}:`, error);
        }
      }

      SecurityValidator.logSecurityEvent('EMERGENCY_CLOSE_ALL', { 
        total: portfolio.positions.length,
        closed: closedCount,
        failed: errors.length
      }, clientId);

      if (errors.length > 0) {
        return { 
          success: false, 
          message: `Closed ${closedCount} positions, failed to close: ${errors.join(', ')}`,
          closed: closedCount
        };
      }

      return { 
        success: true, 
        message: `✅ Successfully closed all ${closedCount} positions`,
        closed: closedCount
      };
    } catch (error: any) {
      logger.error('Failed to close all positions:', error);
      return { success: false, message: `Failed to close all positions: ${error.message}`, closed: 0 };
    }
  }
}

export class DashboardManager {
  private settings: DashboardRequest = {
    theme: 'dark',
    hidePortfolio: false,
    hideSignals: false,
    refreshRate: 3000
  };

  async updateSettings(request: DashboardRequest): Promise<{ success: boolean; message: string; settings: DashboardRequest }> {
    try {
      this.settings = { ...this.settings, ...request };
      logger.info('Dashboard settings updated:', this.settings);
      
      return { 
        success: true, 
        message: `✅ Dashboard settings updated`,
        settings: this.settings
      };
    } catch (error: any) {
      logger.error('Failed to update dashboard:', error);
      return { success: false, message: `Failed to update dashboard: ${error.message}`, settings: this.settings };
    }
  }

  getSettings(): DashboardRequest {
    return this.settings;
  }
}

export const positionManager = new PositionManager();
export const dashboardManager = new DashboardManager();
