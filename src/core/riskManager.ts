import { config } from '../config/settings.js';
import { logger, tradeLog } from '../utils/logger.js';
import type { 
  TradeDecision, 
  PortfolioState, 
  Position,
  Trade 
} from '../types/index.js';

export interface RiskCheck {
  allowed: boolean;
  reason: string;
  adjustedSize?: number;
  adjustedLeverage?: number;
}

export class RiskManager {
  private dailyStartValue: number = 0;
  private dailyPnl: number = 0;
  private dailyTrades: Trade[] = [];
  private isPaused: boolean = false;
  private pauseReason: string = '';
  private highWaterMark: number = 0;

  constructor() {
    this.resetDailyStats();
  }

  resetDailyStats(): void {
    this.dailyPnl = 0;
    this.dailyTrades = [];
  }

  setDailyStartValue(value: number): void {
    this.dailyStartValue = value;
    if (value > this.highWaterMark) {
      this.highWaterMark = value;
    }
  }

  recordTrade(trade: Trade): void {
    this.dailyTrades.push(trade);
    this.dailyPnl += trade.realizedPnl;
  }

  // ==================== Pre-Trade Risk Checks ====================

  validateTrade(
    decision: TradeDecision,
    portfolio: PortfolioState,
    currentPrice: number
  ): RiskCheck {
    // Check if bot is paused
    if (this.isPaused) {
      return { allowed: false, reason: `Bot paused: ${this.pauseReason}` };
    }

    // Check daily loss limit
    const dailyLossPct = this.dailyStartValue > 0 
      ? (this.dailyPnl / this.dailyStartValue) * 100 
      : 0;
    
    if (dailyLossPct <= -config.risk.max_daily_loss_pct) {
      this.pauseBot(`Daily loss limit reached: ${dailyLossPct.toFixed(2)}%`);
      return { allowed: false, reason: 'Daily loss limit reached' };
    }

    // Check drawdown limit
    const drawdown = this.highWaterMark > 0
      ? ((this.highWaterMark - portfolio.totalValue) / this.highWaterMark) * 100
      : 0;
    
    if (drawdown >= config.risk.max_drawdown_pct) {
      this.pauseBot(`Max drawdown reached: ${drawdown.toFixed(2)}%`);
      return { allowed: false, reason: 'Max drawdown limit reached' };
    }

    // For CLOSE or REDUCE, no further checks needed
    if (decision.action === 'CLOSE' || decision.action === 'REDUCE') {
      return { allowed: true, reason: 'Risk check passed' };
    }

    // For HOLD, nothing to do
    if (decision.action === 'HOLD') {
      return { allowed: true, reason: 'Hold - no action needed' };
    }

    // For BUY/SELL, validate position sizing
    return this.validateNewPosition(decision, portfolio, currentPrice);
  }

  private validateNewPosition(
    decision: TradeDecision,
    portfolio: PortfolioState,
    currentPrice: number
  ): RiskCheck {
    const availableBalance = portfolio.availableBalance;
    const totalValue = portfolio.totalValue;

    // Check minimum stable coin reserve
    const targetAllocation = (decision.percentage / 100) * availableBalance;
    const remainingBalance = availableBalance - targetAllocation;
    const stableRatio = (remainingBalance / totalValue) * 100;

    if (stableRatio < config.risk.min_stable_pct) {
      const maxAllocation = availableBalance - (totalValue * config.risk.min_stable_pct / 100);
      if (maxAllocation <= 0) {
        return { 
          allowed: false, 
          reason: `Stable reserve requirement not met (${stableRatio.toFixed(1)}% < ${config.risk.min_stable_pct}%)` 
        };
      }
      
      const adjustedPct = (maxAllocation / availableBalance) * 100;
      logger.warn(`Reducing allocation from ${decision.percentage}% to ${adjustedPct.toFixed(1)}% for stable reserve`);
      return {
        allowed: true,
        reason: 'Adjusted for stable reserve',
        adjustedSize: maxAllocation
      };
    }

    // Check single position limit
    const existingPosition = portfolio.positions.find(p => p.symbol === decision.symbol);
    const existingValue = existingPosition ? existingPosition.marginUsed : 0;
    const newTotalValue = existingValue + targetAllocation;
    const positionPct = (newTotalValue / totalValue) * 100;

    if (positionPct > config.risk.max_single_position_pct) {
      const maxNew = (totalValue * config.risk.max_single_position_pct / 100) - existingValue;
      if (maxNew <= 0) {
        return {
          allowed: false,
          reason: `Max position size for ${decision.symbol} already reached`
        };
      }
      
      logger.warn(`Capping ${decision.symbol} position to ${config.risk.max_single_position_pct}%`);
      return {
        allowed: true,
        reason: 'Adjusted for position limit',
        adjustedSize: maxNew
      };
    }

    // Check total exposure
    const currentExposure = portfolio.positions.reduce((sum, p) => sum + p.marginUsed, 0);
    const newExposure = currentExposure + targetAllocation;
    const exposurePct = (newExposure / totalValue) * 100;

    if (exposurePct > config.risk.max_total_exposure_pct) {
      const maxNew = (totalValue * config.risk.max_total_exposure_pct / 100) - currentExposure;
      if (maxNew <= 0) {
        return {
          allowed: false,
          reason: 'Max total exposure reached'
        };
      }
      
      return {
        allowed: true,
        reason: 'Adjusted for exposure limit',
        adjustedSize: maxNew
      };
    }

    // Check leverage limit
    let adjustedLeverage = decision.leverage || config.risk.default_leverage;
    if (adjustedLeverage > config.risk.max_leverage) {
      adjustedLeverage = config.risk.max_leverage;
    }

    // Validate stop loss is present
    if (!decision.stopLoss && decision.action === 'BUY') {
      tradeLog.warning(`No stop loss specified for ${decision.symbol} - will use default`);
    }

    return {
      allowed: true,
      reason: 'Risk check passed',
      adjustedLeverage
    };
  }

  // ==================== Position Sizing ====================

  calculatePositionSize(
    decision: TradeDecision,
    portfolio: PortfolioState,
    currentPrice: number
  ): number {
    const riskCheck = this.validateTrade(decision, portfolio, currentPrice);
    
    if (!riskCheck.allowed) {
      return 0;
    }

    const baseAllocation = riskCheck.adjustedSize || 
      (decision.percentage / 100) * portfolio.availableBalance;
    
    const leverage = riskCheck.adjustedLeverage || 
      decision.leverage || 
      config.risk.default_leverage;

    // Position size in base currency (e.g., BTC for BTC/USDT)
    const notionalValue = baseAllocation * leverage;
    const positionSize = notionalValue / currentPrice;

    return positionSize;
  }

  calculateStopLoss(
    entryPrice: number,
    side: 'long' | 'short',
    atr?: number
  ): number {
    // Use ATR-based stop if available, otherwise use default percentage
    const stopPct = config.risk.default_stop_loss_pct / 100;
    
    if (atr) {
      // Use 2x ATR for stop loss
      const atrStop = 2 * atr;
      if (side === 'long') {
        return Math.max(entryPrice - atrStop, entryPrice * (1 - stopPct));
      } else {
        return Math.min(entryPrice + atrStop, entryPrice * (1 + stopPct));
      }
    }

    if (side === 'long') {
      return entryPrice * (1 - stopPct);
    } else {
      return entryPrice * (1 + stopPct);
    }
  }

  calculateTakeProfit(
    entryPrice: number,
    side: 'long' | 'short',
    riskRewardRatio: number = 2
  ): number {
    const stopPct = config.risk.default_stop_loss_pct / 100;
    const tpPct = stopPct * riskRewardRatio;

    if (side === 'long') {
      return entryPrice * (1 + tpPct);
    } else {
      return entryPrice * (1 - tpPct);
    }
  }

  // ==================== Bot State Management ====================

  pauseBot(reason: string): void {
    this.isPaused = true;
    this.pauseReason = reason;
    tradeLog.warning(`BOT PAUSED: ${reason}`);
  }

  resumeBot(): void {
    this.isPaused = false;
    this.pauseReason = '';
    logger.info('Bot resumed');
  }

  isPausedState(): { paused: boolean; reason: string } {
    return { paused: this.isPaused, reason: this.pauseReason };
  }

  // ==================== Performance Metrics ====================

  getPerformanceMetrics(): {
    dailyPnl: number;
    dailyPnlPct: number;
    weeklyPnl: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
  } {
    const wins = this.dailyTrades.filter(t => t.realizedPnl > 0);
    const losses = this.dailyTrades.filter(t => t.realizedPnl < 0);

    const dailyPnlPct = this.dailyStartValue > 0 
      ? (this.dailyPnl / this.dailyStartValue) * 100 
      : 0;

    return {
      dailyPnl: this.dailyPnl,
      dailyPnlPct,
      weeklyPnl: 0, // Would need historical data
      winRate: this.dailyTrades.length > 0 
        ? wins.length / this.dailyTrades.length 
        : 0,
      avgWin: wins.length > 0 
        ? wins.reduce((s, t) => s + t.realizedPnl, 0) / wins.length 
        : 0,
      avgLoss: losses.length > 0 
        ? Math.abs(losses.reduce((s, t) => s + t.realizedPnl, 0) / losses.length) 
        : 0
    };
  }

  updateHighWaterMark(value: number): void {
    if (value > this.highWaterMark) {
      this.highWaterMark = value;
    }
  }
}

export const riskManager = new RiskManager();
export default riskManager;
