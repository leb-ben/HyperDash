/**
 * Learning Engine - Self-improving AI trading system
 * 
 * Collects trade outcomes, analyzes patterns, and feeds learnings
 * back into AI decision-making for continuous improvement.
 */

import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import type { TradeDecision, CoinAnalysis } from '../types/index.js';

interface TradeOutcome {
  id: string;
  symbol: string;
  action: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number | null;
  size: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  holdingTimeMs: number;
  aiConfidence: number;
  aiReasoning: string;
  marketConditions: {
    trend: string;
    rsi: number;
    macdSignal: string;
    volatility: number;
  };
  timestamp: number;
  closedAt: number | null;
  isWin: boolean;
}

interface LearningInsight {
  pattern: string;
  winRate: number;
  avgPnl: number;
  sampleSize: number;
  recommendation: string;
  confidence: number;
}

interface StrategyNote {
  id: string;
  category: 'success_pattern' | 'failure_pattern' | 'market_condition' | 'risk_note';
  content: string;
  importance: number; // 1-10
  createdAt: number;
  lastUsed: number;
  useCount: number;
}

export class LearningEngine {
  private db: Database.Database;
  private insights: LearningInsight[] = [];
  private strategyNotes: StrategyNote[] = [];

  constructor(dbPath: string = 'data/learning.db') {
    this.db = new Database(dbPath);
    this.initDatabase();
    this.loadInsights();
  }

  private initDatabase(): void {
    // Trade outcomes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trade_outcomes (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        action TEXT NOT NULL,
        side TEXT NOT NULL,
        entry_price REAL NOT NULL,
        exit_price REAL,
        size REAL NOT NULL,
        leverage INTEGER NOT NULL,
        pnl REAL DEFAULT 0,
        pnl_percent REAL DEFAULT 0,
        holding_time_ms INTEGER DEFAULT 0,
        ai_confidence REAL NOT NULL,
        ai_reasoning TEXT,
        market_trend TEXT,
        market_rsi REAL,
        market_macd TEXT,
        market_volatility REAL,
        timestamp INTEGER NOT NULL,
        closed_at INTEGER,
        is_win INTEGER DEFAULT 0
      )
    `);

    // Strategy notes table - learnings that persist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS strategy_notes (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        importance INTEGER DEFAULT 5,
        created_at INTEGER NOT NULL,
        last_used INTEGER NOT NULL,
        use_count INTEGER DEFAULT 0
      )
    `);

    // Performance snapshots for trend analysis
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        period TEXT NOT NULL,
        total_trades INTEGER,
        win_rate REAL,
        total_pnl REAL,
        avg_win REAL,
        avg_loss REAL,
        best_coin TEXT,
        worst_coin TEXT,
        insights_json TEXT
      )
    `);

    logger.info('Learning database initialized');
  }

  /**
   * Record a new trade with full context
   */
  recordTrade(
    decision: TradeDecision,
    analysis: CoinAnalysis,
    entryPrice: number,
    size: number
  ): string {
    const id = `trade_${Date.now()}_${decision.symbol}`;
    
    const stmt = this.db.prepare(`
      INSERT INTO trade_outcomes (
        id, symbol, action, side, entry_price, size, leverage,
        ai_confidence, ai_reasoning, market_trend, market_rsi,
        market_macd, market_volatility, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      decision.symbol,
      decision.action,
      decision.side || 'long',
      entryPrice,
      size,
      decision.leverage || 3,
      decision.confidence,
      decision.reason,
      analysis.trend,
      analysis.indicators['5m']?.rsi ?? 0,
      (analysis.indicators['5m']?.macd?.histogram ?? 0) > 0 ? 'bullish' : 'bearish',
      analysis.indicators['5m']?.atr ?? 0,
      Date.now()
    );

    logger.info(`Recorded trade: ${id}`);
    return id;
  }

  /**
   * Close a trade and calculate outcome
   */
  closeTrade(tradeId: string, exitPrice: number, pnl: number): void {
    const trade = this.db.prepare('SELECT * FROM trade_outcomes WHERE id = ?').get(tradeId) as any;
    
    if (!trade) {
      logger.warn(`Trade not found: ${tradeId}`);
      return;
    }

    const holdingTimeMs = Date.now() - trade.timestamp;
    const pnlPercent = (pnl / (trade.entry_price * trade.size)) * 100;
    const isWin = pnl > 0 ? 1 : 0;

    this.db.prepare(`
      UPDATE trade_outcomes SET
        exit_price = ?,
        pnl = ?,
        pnl_percent = ?,
        holding_time_ms = ?,
        closed_at = ?,
        is_win = ?
      WHERE id = ?
    `).run(exitPrice, pnl, pnlPercent, holdingTimeMs, Date.now(), isWin, tradeId);

    // Immediately analyze this trade for learnings
    this.analyzeTradeOutcome(tradeId);
    
    logger.info(`Closed trade ${tradeId}: ${pnl >= 0 ? 'WIN' : 'LOSS'} ${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
  }

  /**
   * Analyze a single trade outcome and extract learnings
   */
  private analyzeTradeOutcome(tradeId: string): void {
    const trade = this.db.prepare('SELECT * FROM trade_outcomes WHERE id = ?').get(tradeId) as any;
    if (!trade || trade.exit_price === null) return;

    const isWin = trade.pnl > 0;
    const isSignificant = Math.abs(trade.pnl_percent) > 2; // > 2% move

    if (isSignificant) {
      const note: StrategyNote = {
        id: `note_${Date.now()}`,
        category: isWin ? 'success_pattern' : 'failure_pattern',
        content: this.generateTradeNote(trade, isWin),
        importance: Math.min(10, Math.abs(trade.pnl_percent)),
        createdAt: Date.now(),
        lastUsed: Date.now(),
        useCount: 0
      };

      this.saveStrategyNote(note);
    }
  }

  /**
   * Generate a learning note from a trade
   */
  private generateTradeNote(trade: any, isWin: boolean): string {
    const conditions = [];
    
    if (trade.market_rsi < 30) conditions.push('oversold RSI');
    if (trade.market_rsi > 70) conditions.push('overbought RSI');
    if (trade.market_trend === 'bullish') conditions.push('bullish trend');
    if (trade.market_trend === 'bearish') conditions.push('bearish trend');
    if (trade.ai_confidence > 0.8) conditions.push('high AI confidence');
    if (trade.ai_confidence < 0.6) conditions.push('low AI confidence');

    const holdingHours = trade.holding_time_ms / (1000 * 60 * 60);
    
    if (isWin) {
      return `${trade.side.toUpperCase()} ${trade.symbol} was PROFITABLE (${trade.pnl_percent.toFixed(1)}%) ` +
        `when: ${conditions.join(', ')}. Held for ${holdingHours.toFixed(1)}h. ` +
        `AI reasoning: "${trade.ai_reasoning}"`;
    } else {
      return `${trade.side.toUpperCase()} ${trade.symbol} was UNPROFITABLE (${trade.pnl_percent.toFixed(1)}%) ` +
        `when: ${conditions.join(', ')}. Held for ${holdingHours.toFixed(1)}h. ` +
        `AVOID similar setups. AI reasoning was: "${trade.ai_reasoning}"`;
    }
  }

  /**
   * Save a strategy note to the database
   */
  private saveStrategyNote(note: StrategyNote): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO strategy_notes (
        id, category, content, importance, created_at, last_used, use_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      note.id, note.category, note.content, note.importance,
      note.createdAt, note.lastUsed, note.useCount
    );

    this.strategyNotes.push(note);
    logger.info(`💡 New learning recorded: ${note.category}`);
  }

  /**
   * Load existing insights and notes
   */
  private loadInsights(): void {
    const notes = this.db.prepare(`
      SELECT * FROM strategy_notes 
      ORDER BY importance DESC, last_used DESC 
      LIMIT 50
    `).all() as any[];

    this.strategyNotes = notes.map(n => ({
      id: n.id,
      category: n.category,
      content: n.content,
      importance: n.importance,
      createdAt: n.created_at,
      lastUsed: n.last_used,
      useCount: n.use_count
    }));

    this.calculateInsights();
  }

  /**
   * Calculate statistical insights from trade history
   */
  private calculateInsights(): void {
    const trades = this.db.prepare(`
      SELECT * FROM trade_outcomes 
      WHERE closed_at IS NOT NULL 
      ORDER BY timestamp DESC 
      LIMIT 100
    `).all() as any[];

    if (trades.length < 5) {
      this.insights = [];
      return;
    }

    // Calculate insights by various dimensions
    this.insights = [];

    // By symbol
    const bySymbol = this.groupBy(trades, 'symbol');
    for (const [symbol, symbolTrades] of Object.entries(bySymbol)) {
      const wins = (symbolTrades as any[]).filter(t => t.is_win).length;
      const winRate = wins / (symbolTrades as any[]).length;
      const avgPnl = (symbolTrades as any[]).reduce((sum, t) => sum + t.pnl_percent, 0) / (symbolTrades as any[]).length;

      if ((symbolTrades as any[]).length >= 3) {
        this.insights.push({
          pattern: `${symbol} trading`,
          winRate,
          avgPnl,
          sampleSize: (symbolTrades as any[]).length,
          recommendation: winRate > 0.6 ? `${symbol} has been profitable - consider higher allocation` :
                         winRate < 0.4 ? `${symbol} has been unprofitable - reduce exposure` : 'Neutral',
          confidence: Math.min(1, (symbolTrades as any[]).length / 10)
        });
      }
    }

    // By market condition
    const byTrend = this.groupBy(trades, 'market_trend');
    for (const [trend, trendTrades] of Object.entries(byTrend)) {
      const wins = (trendTrades as any[]).filter(t => t.is_win).length;
      const winRate = wins / (trendTrades as any[]).length;

      if ((trendTrades as any[]).length >= 3) {
        this.insights.push({
          pattern: `Trading in ${trend} markets`,
          winRate,
          avgPnl: (trendTrades as any[]).reduce((sum, t) => sum + t.pnl_percent, 0) / (trendTrades as any[]).length,
          sampleSize: (trendTrades as any[]).length,
          recommendation: winRate > 0.6 ? `${trend} markets have been favorable` :
                         `Be cautious in ${trend} markets`,
          confidence: Math.min(1, (trendTrades as any[]).length / 10)
        });
      }
    }

    // By confidence level
    const highConfTrades = trades.filter(t => t.ai_confidence >= 0.75);
    const lowConfTrades = trades.filter(t => t.ai_confidence < 0.65);

    if (highConfTrades.length >= 3) {
      const wins = highConfTrades.filter(t => t.is_win).length;
      this.insights.push({
        pattern: 'High confidence trades (>75%)',
        winRate: wins / highConfTrades.length,
        avgPnl: highConfTrades.reduce((sum, t) => sum + t.pnl_percent, 0) / highConfTrades.length,
        sampleSize: highConfTrades.length,
        recommendation: wins / highConfTrades.length > 0.7 ? 
          'High confidence signals are reliable - trust them' :
          'High confidence does not guarantee wins - verify with other factors',
        confidence: Math.min(1, highConfTrades.length / 10)
      });
    }
  }

  private groupBy(array: any[], key: string): Record<string, any[]> {
    return array.reduce((result, item) => {
      const keyValue = item[key];
      if (!result[keyValue]) result[keyValue] = [];
      result[keyValue].push(item);
      return result;
    }, {} as Record<string, any[]>);
  }

  /**
   * Get learning context for AI prompts - the key feedback loop!
   */
  getLearningContext(): string {
    const parts: string[] = [];

    // Add recent performance summary
    const recentTrades = this.db.prepare(`
      SELECT * FROM trade_outcomes 
      WHERE closed_at IS NOT NULL 
      ORDER BY closed_at DESC 
      LIMIT 20
    `).all() as any[];

    if (recentTrades.length > 0) {
      const wins = recentTrades.filter(t => t.is_win).length;
      const totalPnl = recentTrades.reduce((sum, t) => sum + t.pnl, 0);
      
      parts.push(`## RECENT PERFORMANCE (Last ${recentTrades.length} trades)`);
      parts.push(`- Win Rate: ${((wins / recentTrades.length) * 100).toFixed(1)}%`);
      parts.push(`- Total P&L: $${totalPnl.toFixed(2)}`);
      parts.push('');
    }

    // Add top insights
    if (this.insights.length > 0) {
      parts.push('## LEARNED PATTERNS');
      const topInsights = this.insights
        .filter(i => i.sampleSize >= 3)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

      for (const insight of topInsights) {
        parts.push(`- ${insight.pattern}: ${(insight.winRate * 100).toFixed(0)}% win rate (${insight.sampleSize} trades)`);
        parts.push(`  → ${insight.recommendation}`);
      }
      parts.push('');
    }

    // Add important strategy notes
    const importantNotes = this.strategyNotes
      .filter(n => n.importance >= 6)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);

    if (importantNotes.length > 0) {
      parts.push('## KEY LEARNINGS FROM PAST TRADES');
      for (const note of importantNotes) {
        const icon = note.category === 'success_pattern' ? 'SUCCESS' : 'WARNING';
        parts.push(`${icon} ${note.content}`);
        
        // Mark as used
        this.db.prepare('UPDATE strategy_notes SET last_used = ?, use_count = use_count + 1 WHERE id = ?')
          .run(Date.now(), note.id);
      }
      parts.push('');
    }

    // Add failure patterns to avoid
    const failureNotes = this.strategyNotes
      .filter(n => n.category === 'failure_pattern')
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 3);

    if (failureNotes.length > 0) {
      parts.push('## PATTERNS TO AVOID (Past Losses)');
      for (const note of failureNotes) {
        parts.push(`❌ ${note.content}`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Get overall statistics
   */
  getStats(): {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    avgWin: number;
    avgLoss: number;
    bestCoin: string | null;
    worstCoin: string | null;
    insightCount: number;
    noteCount: number;
  } {
    const trades = this.db.prepare(`
      SELECT * FROM trade_outcomes WHERE closed_at IS NOT NULL
    `).all() as any[];

    if (trades.length === 0) {
      return {
        totalTrades: 0, winRate: 0, totalPnl: 0, avgWin: 0, avgLoss: 0,
        bestCoin: null, worstCoin: null, insightCount: 0, noteCount: 0
      };
    }

    const wins = trades.filter(t => t.is_win);
    const losses = trades.filter(t => !t.is_win);
    
    // Find best/worst coins
    const bySymbol: Record<string, number> = {};
    for (const t of trades) {
      bySymbol[t.symbol] = (bySymbol[t.symbol] || 0) + t.pnl;
    }
    const sortedSymbols = Object.entries(bySymbol).sort((a, b) => b[1] - a[1]);

    return {
      totalTrades: trades.length,
      winRate: wins.length / trades.length,
      totalPnl: trades.reduce((sum, t) => sum + t.pnl, 0),
      avgWin: wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0,
      avgLoss: losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0,
      bestCoin: sortedSymbols[0]?.[0] || null,
      worstCoin: sortedSymbols[sortedSymbols.length - 1]?.[0] || null,
      insightCount: this.insights.length,
      noteCount: this.strategyNotes.length
    };
  }
}

export const learningEngine = new LearningEngine();
