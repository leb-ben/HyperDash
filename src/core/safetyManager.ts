/**
 * Safety Manager - Portfolio Protection System
 * 
 * Features:
 * - Global stop loss (e.g., -25% in 24hrs kills bot)
 * - Auto-profit withdrawal (e.g., +25% triggers 15% withdrawal)
 * - Emergency shutdown
 * - Alert notifications
 */

import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import { config } from '../config/settings.js';

export interface SafetyConfig {
  // Stop loss settings
  globalStopLossPct: number;       // e.g., 25 = kill bot if -25% in 24hrs
  stopLossTimeWindowHours: number; // e.g., 24
  
  // Profit taking settings
  profitTakePct: number;           // e.g., 25 = trigger at +25% in 24hrs
  profitWithdrawPct: number;       // e.g., 15 = withdraw 15% of gains
  profitTimeWindowHours: number;   // e.g., 24
  
  // Withdrawal address
  withdrawalAddress: string;
  withdrawalAddressName: string;
  
  // Alert settings
  alertOnStopLoss: boolean;
  alertOnProfitTake: boolean;
  alertWebhookUrl?: string;
  alertEmail?: string;
}

export interface SafetyEvent {
  id: string;
  type: 'stop_loss_triggered' | 'profit_take_triggered' | 'emergency_stop' | 'withdrawal_initiated';
  timestamp: number;
  portfolioValue: number;
  triggerValue: number;
  percentChange: number;
  action: string;
  details: string;
}

const DEFAULT_CONFIG: SafetyConfig = {
  globalStopLossPct: 25,
  stopLossTimeWindowHours: 24,
  profitTakePct: 25,
  profitWithdrawPct: 15,
  profitTimeWindowHours: 24,
  withdrawalAddress: '',
  withdrawalAddressName: '',
  alertOnStopLoss: true,
  alertOnProfitTake: true
};

export class SafetyManager {
  private db: Database.Database;
  private config: SafetyConfig;
  private startingValue24h: number = 0;
  private lastCheckTime: number = 0;
  private isBotKilled: boolean = false;
  private valueHistory: { timestamp: number; value: number }[] = [];

  constructor() {
    this.db = new Database('data/safety.db');
    this.config = { ...DEFAULT_CONFIG };
    this.initDatabase();
    this.loadConfig();
  }

  private initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS safety_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS safety_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        portfolio_value REAL NOT NULL,
        trigger_value REAL NOT NULL,
        percent_change REAL NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS value_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        value REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pending_withdrawals (
        id TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        address TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT DEFAULT 'pending'
      );
    `);
  }

  private loadConfig(): void {
    const rows = this.db.prepare('SELECT key, value FROM safety_config').all() as any[];
    for (const row of rows) {
      try {
        (this.config as any)[row.key] = JSON.parse(row.value);
      } catch {
        (this.config as any)[row.key] = row.value;
      }
    }
    
    // Load 24h starting value
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const oldestValue = this.db.prepare(`
      SELECT value FROM value_history 
      WHERE timestamp >= ? 
      ORDER BY timestamp ASC LIMIT 1
    `).get(dayAgo) as { value: number } | undefined;
    
    if (oldestValue) {
      this.startingValue24h = oldestValue.value;
    }
  }

  /**
   * Update safety configuration
   */
  updateConfig(updates: Partial<SafetyConfig>): void {
    for (const [key, value] of Object.entries(updates)) {
      (this.config as any)[key] = value;
      this.db.prepare(`
        INSERT OR REPLACE INTO safety_config (key, value, updated_at)
        VALUES (?, ?, ?)
      `).run(key, JSON.stringify(value), Date.now());
    }
    logger.info('Safety config updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): SafetyConfig {
    return { ...this.config };
  }

  /**
   * Set withdrawal address
   */
  setWithdrawalAddress(address: string, name: string = 'Secure Wallet'): void {
    this.updateConfig({
      withdrawalAddress: address,
      withdrawalAddressName: name
    });
    logger.info(`Withdrawal address set: ${name} (${address.slice(0, 10)}...)`);
  }

  /**
   * Record portfolio value for tracking
   */
  recordValue(value: number): void {
    const now = Date.now();
    
    // Record to history
    this.db.prepare(`
      INSERT INTO value_history (timestamp, value) VALUES (?, ?)
    `).run(now, value);
    
    // Keep in-memory history
    this.valueHistory.push({ timestamp: now, value });
    
    // Trim old entries (keep 48 hours)
    const cutoff = now - (48 * 60 * 60 * 1000);
    this.valueHistory = this.valueHistory.filter(v => v.timestamp > cutoff);
    this.db.prepare('DELETE FROM value_history WHERE timestamp < ?').run(cutoff);
    
    // Update 24h starting value if needed
    const dayAgo = now - (24 * 60 * 60 * 1000);
    if (!this.startingValue24h || this.lastCheckTime < dayAgo) {
      const oldest = this.valueHistory.find(v => v.timestamp >= dayAgo);
      if (oldest) {
        this.startingValue24h = oldest.value;
      }
    }
    
    this.lastCheckTime = now;
  }

  /**
   * Check safety conditions and return action if needed
   */
  checkSafety(currentValue: number): { 
    safe: boolean; 
    action?: 'kill_bot' | 'withdraw_profit' | 'alert';
    reason?: string;
    event?: SafetyEvent;
  } {
    if (this.isBotKilled) {
      return { 
        safe: false, 
        action: 'kill_bot', 
        reason: 'Bot was previously killed by safety system' 
      };
    }

    if (!this.startingValue24h) {
      this.startingValue24h = currentValue;
      return { safe: true };
    }

    const percentChange = ((currentValue - this.startingValue24h) / this.startingValue24h) * 100;

    // Check global stop loss
    if (percentChange <= -this.config.globalStopLossPct) {
      const event = this.createEvent('stop_loss_triggered', currentValue, percentChange, 
        `EMERGENCY STOP: Portfolio down ${Math.abs(percentChange).toFixed(2)}% in 24hrs (limit: ${this.config.globalStopLossPct}%)`);
      
      this.isBotKilled = true;
      
      return {
        safe: false,
        action: 'kill_bot',
        reason: `Portfolio down ${Math.abs(percentChange).toFixed(2)}% - exceeded ${this.config.globalStopLossPct}% stop loss`,
        event
      };
    }

    // Check profit taking
    if (percentChange >= this.config.profitTakePct) {
      const withdrawAmount = (currentValue - this.startingValue24h) * (this.config.profitWithdrawPct / 100);
      
      if (this.config.withdrawalAddress && withdrawAmount > 10) { // Min $10 withdrawal
        const event = this.createEvent('profit_take_triggered', currentValue, percentChange,
          `Profit target hit: +${percentChange.toFixed(2)}%. Withdrawing $${withdrawAmount.toFixed(2)} to ${this.config.withdrawalAddressName}`);
        
        this.queueWithdrawal(withdrawAmount, 'profit_take');
        
        return {
          safe: true,
          action: 'withdraw_profit',
          reason: `Withdrawing $${withdrawAmount.toFixed(2)} profit to ${this.config.withdrawalAddressName}`,
          event
        };
      }
    }

    return { safe: true };
  }

  /**
   * Create and log safety event
   */
  private createEvent(type: SafetyEvent['type'], value: number, percentChange: number, details: string): SafetyEvent {
    const event: SafetyEvent = {
      id: `safety_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: Date.now(),
      portfolioValue: value,
      triggerValue: this.startingValue24h,
      percentChange,
      action: type,
      details
    };

    this.db.prepare(`
      INSERT INTO safety_events (id, type, timestamp, portfolio_value, trigger_value, percent_change, action, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event.id, event.type, event.timestamp, event.portfolioValue, event.triggerValue, event.percentChange, event.action, event.details);

    logger.warn(`SAFETY EVENT: ${details}`);
    
    // Try to send alert
    this.sendAlert(event);

    return event;
  }

  /**
   * Queue withdrawal for processing
   */
  private queueWithdrawal(amount: number, reason: string): void {
    const id = `withdraw_${Date.now()}`;
    this.db.prepare(`
      INSERT INTO pending_withdrawals (id, amount, address, reason, created_at, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(id, amount, this.config.withdrawalAddress, reason, Date.now());
    
    logger.info(`Queued withdrawal: $${amount.toFixed(2)} to ${this.config.withdrawalAddress}`);
  }

  /**
   * Get pending withdrawals
   */
  getPendingWithdrawals(): { id: string; amount: number; address: string; reason: string; created_at: number }[] {
    return this.db.prepare(`
      SELECT * FROM pending_withdrawals WHERE status = 'pending'
    `).all() as any[];
  }

  /**
   * Mark withdrawal as complete
   */
  completeWithdrawal(id: string): void {
    this.db.prepare(`
      UPDATE pending_withdrawals SET status = 'completed' WHERE id = ?
    `).run(id);
  }

  /**
   * Send alert notification
   */
  private async sendAlert(event: SafetyEvent): Promise<void> {
    // Console alert
    console.log('\n' + '='.repeat(60));
    console.log('SAFETY ALERT');
    console.log('='.repeat(60));
    console.log(`Type: ${event.type}`);
    console.log(`Details: ${event.details}`);
    console.log(`Portfolio: $${event.portfolioValue.toFixed(2)}`);
    console.log(`Change: ${event.percentChange.toFixed(2)}%`);
    console.log('='.repeat(60) + '\n');

    // Webhook alert if configured
    if (this.config.alertWebhookUrl) {
      try {
        await fetch(this.config.alertWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        });
      } catch (e) {
        logger.error('Failed to send webhook alert:', e);
      }
    }
  }

  /**
   * Get 24h performance
   */
  get24hPerformance(): { startValue: number; currentChange: number } {
    return {
      startValue: this.startingValue24h,
      currentChange: 0 // Will be calculated with current value
    };
  }

  /**
   * Get recent safety events
   */
  getRecentEvents(limit: number = 10): SafetyEvent[] {
    return this.db.prepare(`
      SELECT * FROM safety_events ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as SafetyEvent[];
  }

  /**
   * Reset bot kill status (manual override)
   */
  resetKillStatus(): void {
    this.isBotKilled = false;
    logger.warn('Safety kill status reset - bot can run again');
  }

  /**
   * Check if bot is killed
   */
  isKilled(): boolean {
    return this.isBotKilled;
  }

  /**
   * Emergency stop
   */
  emergencyStop(reason: string): SafetyEvent {
    this.isBotKilled = true;
    const lastValue = this.valueHistory[this.valueHistory.length - 1]?.value || 0;
    return this.createEvent('emergency_stop', lastValue, 0, `EMERGENCY STOP: ${reason}`);
  }
}

export const safetyManager = new SafetyManager();
