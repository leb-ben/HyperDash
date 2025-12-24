/**
 * Bandwidth Tracker - Monitor proxy bandwidth usage
 * 
 * Tracks API call bandwidth usage and provides persistent storage
 * for monitoring against the 1GB proxy limit.
 */

import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

interface BandwidthRecord {
  id?: number;
  timestamp: number;
  endpoint: string;
  requestSize: number;
  responseSize: number;
  totalSize: number;
}

export class BandwidthTracker {
  private db: Database.Database;
  private currentUsage: number = 0;
  private readonly LIMIT_BYTES = 1073741824; // 1GB
  private resetDate: Date;

  constructor(dbPath: string = 'data/bandwidth.db') {
    this.db = new Database(dbPath);
    this.initDatabase();
    this.loadCurrentUsage();
  }

  private initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bandwidth_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        endpoint TEXT NOT NULL,
        request_size INTEGER DEFAULT 0,
        response_size INTEGER DEFAULT 0,
        total_size INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_usage (
        date TEXT PRIMARY KEY,
        total_bytes INTEGER DEFAULT 0,
        request_count INTEGER DEFAULT 0
      )
    `);

    logger.info('Bandwidth tracker initialized');
  }

  private loadCurrentUsage(): void {
    // Get current month's usage
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    this.resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const record = this.db.prepare(`
      SELECT SUM(total_size) as total FROM bandwidth_log 
      WHERE timestamp >= ?
    `).get(firstOfMonth.getTime()) as { total: number } | undefined;

    this.currentUsage = record?.total || 0;
    logger.info(`Current bandwidth usage: ${(this.currentUsage / 1024 / 1024).toFixed(2)}MB / ${(this.LIMIT_BYTES / 1024 / 1024).toFixed(0)}MB`);
  }

  /**
   * Record bandwidth usage for an API call
   */
  recordUsage(endpoint: string, requestSize: number, responseSize: number): void {
    const totalSize = requestSize + responseSize;
    this.currentUsage += totalSize;

    // Log to database
    const stmt = this.db.prepare(`
      INSERT INTO bandwidth_log (timestamp, endpoint, request_size, response_size, total_size)
        VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(Date.now(), endpoint, requestSize, responseSize, totalSize);

    // Update daily usage
    const today = new Date().toISOString().split('T')[0];
    const dailyStmt = this.db.prepare(`
      INSERT OR REPLACE INTO daily_usage (date, total_bytes, request_count)
        VALUES (
          COALESCE((SELECT date FROM daily_usage WHERE date = ?), ?),
          COALESCE((SELECT total_bytes FROM daily_usage WHERE date = ?), 0) + ?,
          COALESCE((SELECT request_count FROM daily_usage WHERE date = ?), 0) + 1
        )
    `);

    dailyStmt.run(today, today, today, totalSize, today);

    // Check if approaching limit
    const percentage = (this.currentUsage / this.LIMIT_BYTES) * 100;
    
    if (percentage > 90) {
      logger.warn(`Bandwidth usage critical: ${percentage.toFixed(2)}% used`);
    } else if (percentage > 80) {
      logger.warn(`Bandwidth usage high: ${percentage.toFixed(2)}% used`);
    }

    // Clean old records (keep 2 months)
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 2);
    
    this.db.prepare(`
      DELETE FROM bandwidth_log WHERE timestamp < ?
    `).run(cutoff.getTime());
  }

  /**
   * Get current usage statistics
   */
  getCurrentUsage(): {
    used: number;
    remaining: number;
    percentage: number;
    resetDate: string;
    isNearLimit: boolean;
  } {
    const percentage = (this.currentUsage / this.LIMIT_BYTES) * 100;
    
    return {
      used: this.currentUsage,
      remaining: Math.max(0, this.LIMIT_BYTES - this.currentUsage),
      percentage,
      resetDate: this.resetDate.toISOString().split('T')[0],
      isNearLimit: percentage > 80
    };
  }

  /**
   * Get daily usage for the last 30 days
   */
  getDailyUsage(days: number = 30): Array<{
    date: string;
    bytes: number;
    requests: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT 
        d.date,
        d.total_bytes as bytes,
        d.request_count as requests
      FROM daily_usage d
      WHERE d.date >= date('now', '-${days} days')
      ORDER BY d.date DESC
    `);

    return stmt.all() as Array<{
      date: string;
      bytes: number;
      requests: number;
    }>;
  }

  /**
   * Get usage by endpoint
   */
  getUsageByEndpoint(): Array<{
    endpoint: string;
    totalBytes: number;
    requestCount: number;
    avgRequestSize: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT 
        endpoint,
        SUM(total_size) as totalBytes,
        COUNT(*) as requestCount,
        AVG(total_size) as avgRequestSize
      FROM bandwidth_log
      WHERE timestamp >= strftime('%s', 'now', '-7 days')
      GROUP BY endpoint
      ORDER BY totalBytes DESC
    `);

    return stmt.all() as Array<{
      endpoint: string;
      totalBytes: number;
      requestCount: number;
      avgRequestSize: number;
    }>;
  }

  /**
   * Estimate daily burn rate
   */
  getDailyBurnRate(): {
    avgDaily: number;
    projectedMonthly: number;
    daysUntilReset: number;
  } {
    const daily = this.getDailyUsage(7);
    
    if (daily.length === 0) {
      return {
        avgDaily: 0,
        projectedMonthly: 0,
        daysUntilReset: Math.ceil((this.resetDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      };
    }

    const avgDaily = daily.reduce((sum, d) => sum + d.bytes, 0) / daily.length;
    const projectedMonthly = avgDaily * 30;
    const daysUntilReset = Math.ceil((this.resetDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

    return {
      avgDaily: Math.round(avgDaily),
      projectedMonthly: Math.round(projectedMonthly),
      daysUntilReset
    };
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes: number): string {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return bytes + ' B';
  }

  /**
   * Check if we should throttle requests
   */
  shouldThrottle(): boolean {
    const percentage = (this.currentUsage / this.LIMIT_BYTES) * 100;
    return percentage > 90;
  }

  /**
   * Get recommended polling interval based on usage
   */
  getRecommendedInterval(): number {
    const percentage = (this.currentUsage / this.LIMIT_BYTES) * 100;
    
    if (percentage > 90) return 60000; // 1 minute
    if (percentage > 80) return 30000; // 30 seconds
    if (percentage > 70) return 15000; // 15 seconds
    return 5000; // 5 seconds (default)
  }
}

export const bandwidthTracker = new BandwidthTracker();
