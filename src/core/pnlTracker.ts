/**
 * P&L Tracker - Persistent profit and loss tracking
 * 
 * Tracks portfolio value over time, calculates daily/weekly/monthly P&L,
 * and stores historical data for analysis and dashboard display.
 */

import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import type { PortfolioState, Trade } from '../types/index.js';

interface PnLSnapshot {
  id?: number;
  timestamp: number;
  totalValue: number;
  availableBalance: number;
  marginUsed: number;
  unrealizedPnl: number;
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  totalPnl: number;
  dailyStartValue: number;
  weeklyStartValue: number;
  monthlyStartValue: number;
  allTimeStartValue: number;
}

interface BandwidthUsage {
  id?: number;
  timestamp: number;
  bytesUsed: number;
  bytesRemaining: number;
  percentageUsed: number;
  resetDate: string;
}

export class PnLTracker {
  private db: Database.Database;
  private dailyStartValue: number = 0;
  private weeklyStartValue: number = 0;
  private monthlyStartValue: number = 0;
  private allTimeStartValue: number = 0;
  private lastSnapshot: PnLSnapshot | null = null;

  constructor(dbPath: string = 'data/pnl.db') {
    this.db = new Database(dbPath);
    this.initDatabase();
    this.loadStartValues();
  }

  private initDatabase(): void {
    // P&L snapshots table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pnl_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        total_value REAL NOT NULL,
        available_balance REAL NOT NULL,
        margin_used REAL NOT NULL,
        unrealized_pnl REAL NOT NULL,
        daily_pnl REAL DEFAULT 0,
        weekly_pnl REAL DEFAULT 0,
        monthly_pnl REAL DEFAULT 0,
        total_pnl REAL DEFAULT 0,
        daily_start_value REAL DEFAULT 0,
        weekly_start_value REAL DEFAULT 0,
        monthly_start_value REAL DEFAULT 0,
        all_time_start_value REAL DEFAULT 0
      )
    `);

    // Bandwidth usage tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bandwidth_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        bytes_used INTEGER DEFAULT 0,
        bytes_remaining INTEGER DEFAULT 1073741824,
        percentage_used REAL DEFAULT 0,
        reset_date TEXT NOT NULL
      )
    `);

    // Trade P&L records
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trade_pnl (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        entry_price REAL NOT NULL,
        exit_price REAL,
        size REAL NOT NULL,
        realized_pnl REAL DEFAULT 0,
        fees REAL DEFAULT 0,
        holding_time_ms INTEGER DEFAULT 0
      )
    `);

    logger.info('P&L database initialized');
  }

  private loadStartValues(): void {
    // Get the most recent snapshot for each period
    const daily = this.db.prepare(`
      SELECT * FROM pnl_snapshots 
      WHERE timestamp >= strftime('%s', 'now', 'start of day')
      ORDER BY timestamp ASC LIMIT 1
    `).get() as PnLSnapshot | undefined;

    const weekly = this.db.prepare(`
      SELECT * FROM pnl_snapshots 
      WHERE timestamp >= strftime('%s', 'now', 'weekday 0', '-6 days', 'start of day')
      ORDER BY timestamp ASC LIMIT 1
    `).get() as PnLSnapshot | undefined;

    const monthly = this.db.prepare(`
      SELECT * FROM pnl_snapshots 
      WHERE timestamp >= strftime('%s', 'now', 'start of month')
      ORDER BY timestamp ASC LIMIT 1
    `).get() as PnLSnapshot | undefined;

    const allTime = this.db.prepare(`
      SELECT * FROM pnl_snapshots 
      ORDER BY timestamp ASC LIMIT 1
    `).get() as PnLSnapshot | undefined;

    this.dailyStartValue = daily?.totalValue || 0;
    this.weeklyStartValue = weekly?.totalValue || 0;
    this.monthlyStartValue = monthly?.totalValue || 0;
    this.allTimeStartValue = allTime?.totalValue || 0;

    // Initialize if first run
    if (!this.allTimeStartValue) {
      this.allTimeStartValue = 1000; // Default starting value
    }

    logger.info(`P&L start values loaded - Daily: $${this.dailyStartValue}, Weekly: $${this.weeklyStartValue}, Monthly: $${this.monthlyStartValue}`);
  }

  /**
   * Record a portfolio snapshot
   */
  recordSnapshot(portfolio: PortfolioState): void {
    const now = Date.now();
    
    // Calculate P&L for different periods
    const dailyPnl = portfolio.totalValue - (this.dailyStartValue || portfolio.totalValue);
    const weeklyPnl = portfolio.totalValue - (this.weeklyStartValue || portfolio.totalValue);
    const monthlyPnl = portfolio.totalValue - (this.monthlyStartValue || portfolio.totalValue);
    const totalPnl = portfolio.totalValue - this.allTimeStartValue;

    const snapshot: PnLSnapshot = {
      timestamp: now,
      totalValue: portfolio.totalValue,
      availableBalance: portfolio.availableBalance,
      marginUsed: portfolio.marginUsed,
      unrealizedPnl: portfolio.unrealizedPnl,
      dailyPnl,
      weeklyPnl,
      monthlyPnl,
      totalPnl,
      dailyStartValue: this.dailyStartValue,
      weeklyStartValue: this.weeklyStartValue,
      monthlyStartValue: this.monthlyStartValue,
      allTimeStartValue: this.allTimeStartValue
    };

    // Insert snapshot
    const stmt = this.db.prepare(`
      INSERT INTO pnl_snapshots (
        timestamp, total_value, available_balance, margin_used, unrealized_pnl,
        daily_pnl, weekly_pnl, monthly_pnl, total_pnl,
        daily_start_value, weekly_start_value, monthly_start_value, all_time_start_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      snapshot.timestamp,
      snapshot.totalValue,
      snapshot.availableBalance,
      snapshot.marginUsed,
      snapshot.unrealizedPnl,
      snapshot.dailyPnl,
      snapshot.weeklyPnl,
      snapshot.monthlyPnl,
      snapshot.totalPnl,
      snapshot.dailyStartValue,
      snapshot.weeklyStartValue,
      snapshot.monthlyStartValue,
      snapshot.allTimeStartValue
    );

    this.lastSnapshot = snapshot;

    // Clean old snapshots (keep last 30 days)
    this.cleanupOldSnapshots();
  }

  /**
   * Record a completed trade
   */
  recordTrade(trade: Trade): void {
    const stmt = this.db.prepare(`
      INSERT INTO trade_pnl (
        timestamp, symbol, side, entry_price, exit_price,
        size, realized_pnl, fees, holding_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      trade.timestamp,
      trade.symbol,
      trade.side,
      0, // Will be updated when position closes
      trade.price,
      trade.size,
      trade.realizedPnl,
      trade.fee,
      0 // Will be calculated
    );
  }

  /**
   * Get current P&L summary
   */
  getCurrentPnL(): PnLSnapshot | null {
    return this.lastSnapshot;
  }

  /**
   * Get historical P&L data
   */
  getHistoricalPnL(period: 'day' | 'week' | 'month' | 'all'): PnLSnapshot[] {
    let whereClause = '';
    
    switch (period) {
      case 'day':
        whereClause = `WHERE timestamp >= strftime('%s', 'now', 'start of day')`;
        break;
      case 'week':
        whereClause = `WHERE timestamp >= strftime('%s', 'now', 'weekday 0', '-6 days', 'start of day')`;
        break;
      case 'month':
        whereClause = `WHERE timestamp >= strftime('%s', 'now', 'start of month')`;
        break;
      case 'all':
        whereClause = '';
    }

    const stmt = this.db.prepare(`
      SELECT * FROM pnl_snapshots ${whereClause} ORDER BY timestamp ASC
    `);

    return stmt.all() as PnLSnapshot[];
  }

  /**
   * Track bandwidth usage
   */
  recordBandwidthUsage(bytesUsed: number): void {
    const totalBytes = 1073741824; // 1GB
    const bytesRemaining = Math.max(0, totalBytes - bytesUsed);
    const percentageUsed = (bytesUsed / totalBytes) * 100;
    
    // Get reset date (first of next month)
    const now = new Date();
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];

    const stmt = this.db.prepare(`
      INSERT INTO bandwidth_usage (timestamp, bytes_used, bytes_remaining, percentage_used, reset_date)
        VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(Date.now(), bytesUsed, bytesRemaining, percentageUsed, resetDate);

    // Keep only last 100 records
    this.db.prepare(`
      DELETE FROM bandwidth_usage WHERE id NOT IN (
        SELECT id FROM bandwidth_usage ORDER BY timestamp DESC LIMIT 100
      )
    `).run();
  }

  /**
   * Get current bandwidth usage
   */
  getBandwidthUsage(): BandwidthUsage | null {
    const stmt = this.db.prepare(`
      SELECT * FROM bandwidth_usage ORDER BY timestamp DESC LIMIT 1
    `);

    return stmt.get() as BandwidthUsage | null;
  }

  /**
   * Get P&L statistics
   */
  getStatistics(): {
    bestDay: { date: string; pnl: number };
    worstDay: { date: string; pnl: number };
    totalTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
  } {
    // Best/worst days
    const bestDay = this.db.prepare(`
      SELECT 
        DATE(timestamp, 'unixepoch') as date,
        MAX(daily_pnl) as pnl
      FROM pnl_snapshots
      WHERE daily_pnl != 0
      GROUP BY DATE(timestamp, 'unixepoch')
      ORDER BY pnl DESC
      LIMIT 1
    `).get() as { date: string; pnl: number } | undefined;

    const worstDay = this.db.prepare(`
      SELECT 
        DATE(timestamp, 'unixepoch') as date,
        MIN(daily_pnl) as pnl
      FROM pnl_snapshots
      WHERE daily_pnl != 0
      GROUP BY DATE(timestamp, 'unixepoch')
      ORDER BY pnl ASC
      LIMIT 1
    `).get() as { date: string; pnl: number } | undefined;

    // Trade statistics
    const trades = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        AVG(CASE WHEN realized_pnl > 0 THEN realized_pnl END) as avg_win,
        AVG(CASE WHEN realized_pnl < 0 THEN realized_pnl END) as avg_loss,
        COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) as wins
      FROM trade_pnl
    `).get() as any;

    const winRate = trades.total > 0 ? (trades.wins / trades.total) * 100 : 0;

    return {
      bestDay: bestDay || { date: 'N/A', pnl: 0 },
      worstDay: worstDay || { date: 'N/A', pnl: 0 },
      totalTrades: trades.total || 0,
      winRate,
      avgWin: trades.avg_win || 0,
      avgLoss: trades.avg_loss || 0
    };
  }

  private cleanupOldSnapshots(): void {
    // Delete snapshots older than 30 days
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.db.prepare(`
      DELETE FROM pnl_snapshots WHERE timestamp < ?
    `).run(cutoff);
  }

  /**
   * Reset period start values (call at period boundaries)
   */
  resetPeriods(): void {
    const now = new Date();
    
    // Check if we crossed day boundary
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      this.dailyStartValue = this.lastSnapshot?.totalValue || 0;
    }
    
    // Check if we crossed week boundary (Sunday)
    if (now.getDay() === 0 && now.getHours() === 0 && now.getMinutes() === 0) {
      this.weeklyStartValue = this.lastSnapshot?.totalValue || 0;
    }
    
    // Check if we crossed month boundary
    if (now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() === 0) {
      this.monthlyStartValue = this.lastSnapshot?.totalValue || 0;
    }
  }
}

export const pnlTracker = new PnLTracker();
