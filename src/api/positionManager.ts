import { logger } from '../utils/logger.js';
import { paperPortfolio } from '../core/portfolio.js';
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

      const portfolio = paperPortfolio.getState();
      const position = portfolio.positions.find(p => p.symbol === symbol);
      
      if (!position) {
        AuditLogger.logPositionAction('CLOSE_FAILED', symbol, { reason: 'No position found' }, clientId);
        return { success: false, message: `No open position for ${symbol}` };
      }

      // Get current price from feed
      const currentPrice = 95000 + Math.random() * 2000; // Mock current price - in real implementation, get from realtimeFeed
      
      // Actually close the position using paperPortfolio
      const trade = paperPortfolio.closePosition(symbol, currentPrice, 'terminal_command');
      
      if (!trade) {
        return { success: false, message: `Failed to close ${symbol} position` };
      }

      const pnl = trade.realizedPnl || 0;
      
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
