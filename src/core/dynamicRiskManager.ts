/**
 * Dynamic Risk Settings Manager
 * 
 * Provides configurable risk settings with portfolio allocation control,
 * confidence thresholds, and dynamic adjustment based on performance.
 */

import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import { pnlTracker } from './pnlTracker.js';

export interface RiskSettings {
  // Portfolio allocation
  portfolioAllocationPct: number;    // 5-95% of portfolio to use for trading
  reserveAllocationPct: number;      // Complementary reserve for bad positions
  
  // Confidence thresholds
  minConfidenceToTrade: number;      // 0.0-1.0, default 0.6
  highConfidenceThreshold: number;   // 0.0-1.0, default 0.8
  
  // Position sizing
  maxSinglePositionPct: number;      // Max % of trading capital per position
  maxPositions: number;              // Max concurrent positions
  
  // Aggressiveness settings
  aggressiveness: 'conservative' | 'moderate' | 'aggressive';
  leverageMultiplier: number;        // 0.5-2.0 multiplier to base leverage
  
  // Dynamic adjustment
  autoAdjust: boolean;               // Auto-adjust based on performance
  performanceWindow: number;         // Days to look back for performance
}

export interface RiskExplanation {
  setting: string;
  current: any;
  impact: string;
  pros: string[];
  cons: string[];
}

export class DynamicRiskManager {
  private db: Database.Database;
  private settings: RiskSettings;

  constructor(dbPath: string = 'data/risk_settings.db') {
    this.db = new Database(dbPath);
    this.initDatabase();
    this.loadSettings();
  }

  private initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS risk_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        portfolio_allocation_pct REAL DEFAULT 50,
        reserve_allocation_pct REAL DEFAULT 50,
        min_confidence_to_trade REAL DEFAULT 0.6,
        high_confidence_threshold REAL DEFAULT 0.8,
        max_single_position_pct REAL DEFAULT 20,
        max_positions INTEGER DEFAULT 5,
        aggressiveness TEXT DEFAULT 'moderate',
        leverage_multiplier REAL DEFAULT 1.0,
        auto_adjust INTEGER DEFAULT 1,
        performance_window INTEGER DEFAULT 7
      )
    `);

    // Settings history for tracking changes
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        setting_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        reason TEXT
      )
    `);

    logger.info('Dynamic risk manager initialized');
  }

  private loadSettings(): void {
    const record = this.db.prepare('SELECT * FROM risk_settings WHERE id = 1').get();
    
    if (record) {
      this.settings = {
        portfolioAllocationPct: record.portfolio_allocation_pct,
        reserveAllocationPct: record.reserve_allocation_pct,
        minConfidenceToTrade: record.min_confidence_to_trade,
        highConfidenceThreshold: record.high_confidence_threshold,
        maxSinglePositionPct: record.max_single_position_pct,
        maxPositions: record.max_positions,
        aggressiveness: record.aggressiveness,
        leverageMultiplier: record.leverage_multiplier,
        autoAdjust: Boolean(record.auto_adjust),
        performanceWindow: record.performance_window
      };
    } else {
      // Insert default settings
      this.settings = this.getDefaultSettings();
      this.saveSettings('Initial setup');
    }

    logger.info(`Risk settings loaded: ${this.settings.aggressiveness} mode, ${this.settings.portfolioAllocationPct}% allocation`);
  }

  private getDefaultSettings(): RiskSettings {
    return {
      portfolioAllocationPct: 50,
      reserveAllocationPct: 50,
      minConfidenceToTrade: 0.6,
      highConfidenceThreshold: 0.8,
      maxSinglePositionPct: 20,
      maxPositions: 5,
      aggressiveness: 'moderate',
      leverageMultiplier: 1.0,
      autoAdjust: true,
      performanceWindow: 7
    };
  }

  /**
   * Get current risk settings
   */
  getSettings(): RiskSettings {
    return { ...this.settings };
  }

  /**
   * Update a specific setting
   */
  updateSetting<K extends keyof RiskSettings>(
    setting: K,
    value: RiskSettings[K],
    reason?: string
  ): void {
    const oldValue = this.settings[setting];
    this.settings[setting] = value;
    
    // Validate dependent settings
    this.validateSettings();
    
    // Save to database
    this.saveSettings(reason || `Updated ${setting}`);
    
    // Log the change
    logger.info(`Risk setting updated: ${setting} from ${oldValue} to ${value}`);
    
    // Record in history
    this.recordHistory(setting, String(oldValue), String(value), reason);
  }

  /**
   * Validate settings and ensure consistency
   */
  private validateSettings(): void {
    // Ensure allocation percentages add to 100
    if (this.settings.portfolioAllocationPct + this.settings.reserveAllocationPct !== 100) {
      this.settings.reserveAllocationPct = 100 - this.settings.portfolioAllocationPct;
    }

    // Clamp values to valid ranges
    this.settings.portfolioAllocationPct = Math.max(5, Math.min(95, this.settings.portfolioAllocationPct));
    this.settings.reserveAllocationPct = Math.max(5, Math.min(95, this.settings.reserveAllocationPct));
    this.settings.minConfidenceToTrade = Math.max(0.1, Math.min(1.0, this.settings.minConfidenceToTrade));
    this.settings.highConfidenceThreshold = Math.max(
      this.settings.minConfidenceToTrade,
      Math.min(1.0, this.settings.highConfidenceThreshold)
    );
    this.settings.maxSinglePositionPct = Math.max(5, Math.min(50, this.settings.maxSinglePositionPct));
    this.settings.maxPositions = Math.max(1, Math.min(20, this.settings.maxPositions));
    this.settings.leverageMultiplier = Math.max(0.5, Math.min(2.0, this.settings.leverageMultiplier));
  }

  /**
   * Save settings to database
   */
  private saveSettings(reason?: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO risk_settings (
        id, portfolio_allocation_pct, reserve_allocation_pct,
        min_confidence_to_trade, high_confidence_threshold,
        max_single_position_pct, max_positions, aggressiveness,
        leverage_multiplier, auto_adjust, performance_window
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      1,
      this.settings.portfolioAllocationPct,
      this.settings.reserveAllocationPct,
      this.settings.minConfidenceToTrade,
      this.settings.highConfidenceThreshold,
      this.settings.maxSinglePositionPct,
      this.settings.maxPositions,
      this.settings.aggressiveness,
      this.settings.leverageMultiplier,
      this.settings.autoAdjust ? 1 : 0,
      this.settings.performanceWindow
    );
  }

  /**
   * Record setting change in history
   */
  private recordHistory(setting: string, oldValue: string, newValue: string, reason?: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO settings_history (timestamp, setting_name, old_value, new_value, reason)
        VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(Date.now(), setting, oldValue, newValue, reason || 'Manual update');
  }

  /**
   * Get explanations for each setting
   */
  getSettingExplanations(): RiskExplanation[] {
    return [
      {
        setting: 'Portfolio Allocation',
        current: `${this.settings.portfolioAllocationPct}%`,
        impact: 'Controls how much of your portfolio is used for active trading',
        pros: [
          'Higher allocation = more potential profit',
          'More capital available for opportunities',
          'Better utilization of funds'
        ],
        cons: [
          'Higher risk of large drawdowns',
          'Less reserve for emergencies',
          'Increased liquidation risk'
        ]
      },
      {
        setting: 'Confidence Threshold',
        current: `${(this.settings.minConfidenceToTrade * 100).toFixed(0)}%`,
        impact: 'Minimum AI confidence required to execute trades',
        pros: [
          'Higher threshold = higher win rate',
          'Fewer emotional/bad trades',
          'More selective trading'
        ],
        cons: [
          'Fewer trading opportunities',
          'May miss good entries',
          'Lower volume of trades'
        ]
      },
      {
        setting: 'Max Position Size',
        current: `${this.settings.maxSinglePositionPct}%`,
        impact: 'Maximum percentage of trading capital per single position',
        pros: [
          'Limits exposure to any one asset',
          'Better diversification',
          'Reduces single-point failure risk'
        ],
        cons: [
          'May limit profit potential',
          'Requires more positions for full allocation',
          'Could miss large moves'
        ]
      },
      {
        setting: 'Aggressiveness',
        current: this.settings.aggressiveness,
        impact: 'Overall trading style and risk tolerance',
        pros: [
          'Matches your risk tolerance',
          'Adaptable to market conditions',
          'Can be optimized for goals'
        ],
        cons: [
          'Too conservative = missed opportunities',
          'Too aggressive = high risk',
          'Requires monitoring and adjustment'
        ]
      }
    ];
  }

  /**
   * Auto-adjust settings based on recent performance
   */
  async autoAdjustSettings(): Promise<void> {
    if (!this.settings.autoAdjust) {
      return;
    }

    const stats = pnlTracker.getStatistics();
    const recentPnL = pnlTracker.getHistoricalPnL('day').slice(-this.settings.performanceWindow);
    
    if (recentPnL.length < 3) {
      return; // Not enough data
    }

    const avgDailyPnL = recentPnL.reduce((sum, d) => sum + d.dailyPnl, 0) / recentPnL.length;
    const winRate = stats.winRate;

    let adjustments: Array<{ setting: keyof RiskSettings; value: any; reason: string }> = [];

    // Adjust based on performance
    if (winRate < 40 && avgDailyPnL < 0) {
      // Poor performance - be more conservative
      adjustments.push({
        setting: 'minConfidenceToTrade',
        value: Math.min(0.8, this.settings.minConfidenceToTrade + 0.05),
        reason: 'Low win rate, increasing confidence requirement'
      });
      
      adjustments.push({
        setting: 'maxSinglePositionPct',
        value: Math.max(10, this.settings.maxSinglePositionPct - 5),
        reason: 'Reducing position size due to losses'
      });
    } else if (winRate > 60 && avgDailyPnL > 0) {
      // Good performance - can be more aggressive
      adjustments.push({
        setting: 'portfolioAllocationPct',
        value: Math.min(75, this.settings.portfolioAllocationPct + 5),
        reason: 'Strong performance, increasing allocation'
      });
    }

    // Apply adjustments
    for (const adj of adjustments) {
      this.updateSetting(adj.setting, adj.value, adj.reason);
    }

    if (adjustments.length > 0) {
      logger.info(`Auto-adjusted ${adjustments.length} risk settings based on performance`);
    }
  }

  /**
   * Get preset configurations
   */
  getPreset(name: 'conservative' | 'moderate' | 'aggressive'): RiskSettings {
    const presets = {
      conservative: {
        portfolioAllocationPct: 30,
        reserveAllocationPct: 70,
        minConfidenceToTrade: 0.75,
        highConfidenceThreshold: 0.9,
        maxSinglePositionPct: 10,
        maxPositions: 3,
        aggressiveness: 'conservative' as const,
        leverageMultiplier: 0.75,
        autoAdjust: true,
        performanceWindow: 14
      },
      moderate: this.getDefaultSettings(),
      aggressive: {
        portfolioAllocationPct: 75,
        reserveAllocationPct: 25,
        minConfidenceToTrade: 0.5,
        highConfidenceThreshold: 0.7,
        maxSinglePositionPct: 30,
        maxPositions: 8,
        aggressiveness: 'aggressive' as const,
        leverageMultiplier: 1.5,
        autoAdjust: true,
        performanceWindow: 7
      }
    };

    return presets[name];
  }

  /**
   * Apply preset configuration
   */
  applyPreset(name: 'conservative' | 'moderate' | 'aggressive'): void {
    const preset = this.getPreset(name);
    const oldSettings = { ...this.settings };
    
    this.settings = preset;
    this.validateSettings();
    this.saveSettings(`Applied ${name} preset`);
    
    logger.info(`Applied ${name} risk preset`);
  }

  /**
   * Get settings history
   */
  getSettingsHistory(limit: number = 50): Array<{
    timestamp: number;
    setting: string;
    oldValue: string;
    newValue: string;
    reason: string;
  }> {
    const stmt = this.db.prepare(`
      SELECT * FROM settings_history
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(limit) as Array<{
      timestamp: number;
      setting: string;
      oldValue: string;
      newValue: string;
      reason: string;
    }>;
  }
}

export const dynamicRiskManager = new DynamicRiskManager();
