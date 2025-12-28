/**
 * Strategy Persistence Module
 * Saves and retrieves the most profitable trading strategies per symbol per day
 */

import Database from 'better-sqlite3'
import type { Database as SQLiteDatabase } from 'better-sqlite3'
import { HamburgerBotConfig } from '../types/grid.js'
import { logger } from '../utils/logger.js'

export interface OptimalStrategy {
  symbol: string
  date: string // YYYY-MM-DD format
  strategy: {
    aggressiveness: string
    confidenceThreshold: number
    leverage: number
    gridSpacing: number
    activeCapitalPct: number
  }
  metrics: {
    totalReturnPct: number
    totalReturnUsd: number
    winRate: number
    maxDrawdown: number
    sharpeRatio: number
    totalTrades: number
    backtestDurationHours?: number
  }
  createdAt: number
}

export class StrategyPersistence {
  private db: SQLiteDatabase

  constructor(dbPath: string = './data/optimal_strategies.db') {
    this.db = new Database(dbPath)
    this.initializeTables()
  }

  private initializeTables(): void {
    const createTable = `
      CREATE TABLE IF NOT EXISTS optimal_strategies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        date TEXT NOT NULL,
        strategy TEXT NOT NULL,
        metrics TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(symbol, date)
      )
    `
    
    try {
      this.db.exec(createTable)
      logger.info('Strategy persistence database initialized')
    } catch (error) {
      logger.error('Failed to initialize strategy persistence database:', error)
      throw error
    }
  }

  /**
   * Save or update an optimal strategy for a symbol on a specific date
   */
  saveOptimalStrategy(strategy: OptimalStrategy): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO optimal_strategies 
        (symbol, date, strategy, metrics, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)

      const metricsJson = JSON.stringify(strategy.metrics)
      logger.info(`Saving strategy for ${strategy.symbol} on ${strategy.date} with metrics:`, {
        totalReturnPct: strategy.metrics.totalReturnPct,
        backtestDurationHours: strategy.metrics.backtestDurationHours,
        normalizedReturn: strategy.metrics.backtestDurationHours ? 
          (strategy.metrics.totalReturnPct / strategy.metrics.backtestDurationHours * 24).toFixed(2) + '%' : 
          'N/A'
      })

      stmt.run(
        strategy.symbol,
        strategy.date,
        JSON.stringify(strategy.strategy),
        metricsJson,
        strategy.createdAt
      )

      logger.info(`Successfully saved optimal strategy for ${strategy.symbol} on ${strategy.date}`)
      return true
    } catch (error) {
      logger.error('Failed to save optimal strategy:', error)
      return false
    }
  }

  /**
   * Get the optimal strategy for a symbol on a specific date
   */
  getOptimalStrategy(symbol: string, date: string): OptimalStrategy | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM optimal_strategies 
        WHERE symbol = ? AND date = ?
      `)

      const row = stmt.get(symbol, date) as any
      if (!row) return null

      return {
        symbol: row.symbol,
        date: row.date,
        strategy: JSON.parse(row.strategy),
        metrics: JSON.parse(row.metrics),
        createdAt: row.created_at
      }
    } catch (error) {
      logger.error('Failed to get optimal strategy:', error)
      return null
    }
  }

  /**
   * Get all optimal strategies for a symbol
   */
  getOptimalStrategiesForSymbol(symbol: string): OptimalStrategy[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM optimal_strategies 
        WHERE symbol = ?
        ORDER BY date DESC
      `)

      const rows = stmt.all(symbol) as any[]
      return rows.map(row => ({
        symbol: row.symbol,
        date: row.date,
        strategy: JSON.parse(row.strategy),
        metrics: JSON.parse(row.metrics),
        createdAt: row.created_at
      }))
    } catch (error) {
      logger.error('Failed to get optimal strategies for symbol:', error)
      return []
    }
  }

  /**
   * Get all optimal strategies across all symbols
   */
  getAllOptimalStrategies(): OptimalStrategy[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM optimal_strategies 
        ORDER BY symbol ASC, date DESC
      `)

      const rows = stmt.all() as any[]
      return rows.map(row => ({
        symbol: row.symbol,
        date: row.date,
        strategy: JSON.parse(row.strategy),
        metrics: JSON.parse(row.metrics),
        createdAt: row.created_at
      }))
    } catch (error) {
      logger.error('Failed to get all optimal strategies:', error)
      return []
    }
  }

  /**
   * Get the latest optimal strategies for all symbols
   */
  getLatestOptimalStrategies(): OptimalStrategy[] {
    try {
      // First try to get the most recently saved strategies (by created_at)
      const stmt = this.db.prepare(`
        SELECT s1.* FROM optimal_strategies s1
        INNER JOIN (
          SELECT symbol, MAX(created_at) as max_created_at
          FROM optimal_strategies
          GROUP BY symbol
        ) s2 ON s1.symbol = s2.symbol AND s1.created_at = s2.max_created_at
        ORDER BY s1.symbol ASC
      `)

      const rows = stmt.all() as any[]
      const strategies = rows.map(row => ({
        symbol: row.symbol,
        date: row.date,
        strategy: JSON.parse(row.strategy),
        metrics: JSON.parse(row.metrics),
        createdAt: row.created_at
      }))

      logger.info(`Retrieved ${strategies.length} latest optimal strategies (by creation time):`)
      strategies.forEach(s => {
        logger.info(`- ${s.symbol}: ${s.metrics.totalReturnPct}% on ${s.date} (${s.metrics.backtestDurationHours || 24}h)`)
      })

      return strategies
    } catch (error) {
      logger.error('Failed to get latest optimal strategies:', error)
      return []
    }
  }

  /**
   * Check if a backtest result is more profitable than the current optimal
   */
  isMoreProfitable(
    symbol: string, 
    date: string, 
    metrics: OptimalStrategy['metrics'],
    backtestDurationHours?: number
  ): boolean {
    const current = this.getOptimalStrategy(symbol, date)
    
    if (!current) {
      return true // No existing strategy
    }

    // Normalize returns to 24-hour period for fair comparison
    const normalizedCurrentReturn = current.metrics.totalReturnPct / (current.metrics.backtestDurationHours || 24) * 24
    const normalizedNewReturn = metrics.totalReturnPct / (backtestDurationHours || 24) * 24

    // Compare normalized returns
    return normalizedNewReturn > normalizedCurrentReturn
  }

  /**
   * Save a backtest result if it's more profitable than the current optimal
   */
  saveIfMoreProfitable(
    symbol: string,
    config: HamburgerBotConfig,
    metrics: OptimalStrategy['metrics'],
    backtestDate?: string,
    backtestDurationHours?: number
  ): boolean {
    const dateToUse = backtestDate || this.getTodayDate()
    
    if (!this.isMoreProfitable(symbol, dateToUse, metrics, backtestDurationHours)) {
      return false
    }

    const optimalStrategy: OptimalStrategy = {
      symbol,
      date: dateToUse,
      strategy: {
        aggressiveness: config.aiAggressiveness || 'medium',
        confidenceThreshold: config.aiConfidenceThreshold || 70,
        leverage: config.leverage || 4,
        gridSpacing: config.gridSpacing || 1.0,
        activeCapitalPct: config.maxCapitalUtilization || 50
      },
      metrics: {
        ...metrics,
        backtestDurationHours: backtestDurationHours || 24
      },
      createdAt: Date.now()
    }

    return this.saveOptimalStrategy(optimalStrategy)
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  private getTodayDate(): string {
    const date = new Date();
    return date.toISOString().split('T')[0] || '';
  }

  /**
   * Clean up old strategies (older than specified days)
   */
  cleanupOldStrategies(daysToKeep: number = 30): void {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      const cutoffString = cutoffDate.toISOString().split('T')[0]

      const stmt = this.db.prepare(`
        DELETE FROM optimal_strategies 
        WHERE date < ?
      `)

      const result = stmt.run(cutoffString)
      logger.info(`Cleaned up ${result.changes} old strategy records`)
    } catch (error) {
      logger.error('Failed to cleanup old strategies:', error)
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close()
  }
}

// Singleton instance
let persistenceInstance: StrategyPersistence | null = null

export function getStrategyPersistence(): StrategyPersistence {
  if (!persistenceInstance) {
    persistenceInstance = new StrategyPersistence()
  }
  return persistenceInstance
}
