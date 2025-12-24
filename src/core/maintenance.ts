/**
 * Self-Maintenance System
 * 
 * Runs periodically (default: weekly) to:
 * - Analyze overall performance
 * - Trim old/irrelevant data
 * - Generate strategic insights
 * - Update strategy notes
 * - Optimize AI prompts based on learnings
 */

import Database from 'better-sqlite3';
import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { config, getEnvRequired } from '../config/settings.js';
import { learningEngine } from './learningEngine.js';

interface MaintenanceReport {
  timestamp: number;
  period: string;
  performanceSummary: {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    avgTradeSize: number;
    bestDay: string | null;
    worstDay: string | null;
  };
  aiAnalysis: string;
  recommendations: string[];
  actionsToken: {
    notesAdded: number;
    notesRemoved: number;
    insightsUpdated: number;
    dataPointsTrimmed: number;
  };
}

export class MaintenanceSystem {
  private db: Database.Database;
  private aiClient: OpenAI;
  private lastMaintenanceRun: number = 0;

  constructor() {
    this.db = new Database('data/learning.db');
    this.aiClient = new OpenAI({
      apiKey: getEnvRequired('CEREBRAS_API_KEY'),
      baseURL: 'https://api.cerebras.ai/v1'
    });
    this.initMaintenanceTable();
    this.loadLastRun();
  }

  private initMaintenanceTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS maintenance_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        report_json TEXT NOT NULL,
        status TEXT DEFAULT 'completed'
      )
    `);
  }

  private loadLastRun(): void {
    const lastRun = this.db.prepare(`
      SELECT timestamp FROM maintenance_runs 
      ORDER BY timestamp DESC LIMIT 1
    `).get() as { timestamp: number } | undefined;
    
    this.lastMaintenanceRun = lastRun?.timestamp || 0;
  }

  /**
   * Check if maintenance should run (default: weekly)
   */
  shouldRunMaintenance(intervalMs: number = 7 * 24 * 60 * 60 * 1000): boolean {
    return Date.now() - this.lastMaintenanceRun > intervalMs;
  }

  /**
   * Run full maintenance cycle
   */
  async runMaintenance(): Promise<MaintenanceReport> {
    logger.info('Starting weekly maintenance cycle...');

    const report: MaintenanceReport = {
      timestamp: Date.now(),
      period: 'weekly',
      performanceSummary: await this.calculatePerformanceSummary(),
      aiAnalysis: '',
      recommendations: [],
      actionsToken: {
        notesAdded: 0,
        notesRemoved: 0,
        insightsUpdated: 0,
        dataPointsTrimmed: 0
      }
    };

    // Step 1: Trim old data
    report.actionsToken.dataPointsTrimmed = this.trimOldData();

    // Step 2: Consolidate strategy notes
    const consolidation = this.consolidateNotes();
    report.actionsToken.notesRemoved = consolidation.removed;

    // Step 3: Get AI analysis of performance
    const aiInsights = await this.getAIMaintenanceAnalysis(report.performanceSummary);
    report.aiAnalysis = aiInsights.analysis;
    report.recommendations = aiInsights.recommendations;

    // Step 4: Create new strategy notes from AI insights
    const newNotes = this.createNotesFromAIInsights(aiInsights);
    report.actionsToken.notesAdded = newNotes;

    // Step 5: Update insights
    report.actionsToken.insightsUpdated = this.refreshInsights();

    // Save the maintenance report
    this.saveMaintenanceReport(report);

    logger.info('Maintenance complete!');
    logger.info(`   Trimmed ${report.actionsToken.dataPointsTrimmed} old records`);
    logger.info(`   Removed ${report.actionsToken.notesRemoved} redundant notes`);
    logger.info(`   Added ${report.actionsToken.notesAdded} new insights`);

    return report;
  }

  /**
   * Calculate performance summary for the period
   */
  private async calculatePerformanceSummary(): Promise<MaintenanceReport['performanceSummary']> {
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    const trades = this.db.prepare(`
      SELECT * FROM trade_outcomes 
      WHERE timestamp > ? AND closed_at IS NOT NULL
    `).all(weekAgo) as any[];

    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        totalPnl: 0,
        avgTradeSize: 0,
        bestDay: null,
        worstDay: null
      };
    }

    const wins = trades.filter(t => t.is_win).length;
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const avgSize = trades.reduce((sum, t) => sum + t.size, 0) / trades.length;

    // Find best/worst days
    const byDay: Record<string, number> = {};
    for (const t of trades) {
      const day = new Date(t.timestamp).toISOString().split('T')[0];
      byDay[day!] = (byDay[day!] || 0) + t.pnl;
    }
    
    const sortedDays = Object.entries(byDay).sort((a, b) => b[1] - a[1]);

    return {
      totalTrades: trades.length,
      winRate: wins / trades.length,
      totalPnl,
      avgTradeSize: avgSize,
      bestDay: sortedDays[0]?.[0] || null,
      worstDay: sortedDays[sortedDays.length - 1]?.[0] || null
    };
  }

  /**
   * Trim old data to keep database lean
   */
  private trimOldData(): number {
    const cutoffDate = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days

    // Keep recent trades, remove old closed ones (but keep summary)
    const result = this.db.prepare(`
      DELETE FROM trade_outcomes 
      WHERE closed_at IS NOT NULL 
      AND closed_at < ?
      AND ABS(pnl_percent) < 5
    `).run(cutoffDate);

    // Remove old, low-importance notes that haven't been used
    const noteCutoff = Date.now() - (14 * 24 * 60 * 60 * 1000); // 14 days
    const noteResult = this.db.prepare(`
      DELETE FROM strategy_notes 
      WHERE importance < 5 
      AND last_used < ?
      AND use_count < 3
    `).run(noteCutoff);

    return result.changes + noteResult.changes;
  }

  /**
   * Consolidate similar/redundant notes
   */
  private consolidateNotes(): { removed: number } {
    // Get all notes
    const notes = this.db.prepare(`
      SELECT * FROM strategy_notes ORDER BY importance DESC
    `).all() as any[];

    const toRemove: string[] = [];
    const seen = new Set<string>();

    for (const note of notes) {
      // Create a simplified signature for deduplication
      const signature = note.content
        .toLowerCase()
        .replace(/[0-9.]+%/g, 'X%')
        .replace(/\$[0-9.]+/g, '$X')
        .replace(/[0-9.]+ ?h(ours?)?/gi, 'Xh')
        .substring(0, 100);

      if (seen.has(signature)) {
        toRemove.push(note.id);
      } else {
        seen.add(signature);
      }
    }

    // Remove duplicates
    if (toRemove.length > 0) {
      this.db.prepare(`
        DELETE FROM strategy_notes WHERE id IN (${toRemove.map(() => '?').join(',')})
      `).run(...toRemove);
    }

    return { removed: toRemove.length };
  }

  /**
   * Get AI analysis of trading performance
   */
  private async getAIMaintenanceAnalysis(summary: MaintenanceReport['performanceSummary']): Promise<{
    analysis: string;
    recommendations: string[];
  }> {
    // Get recent strategy notes for context
    const recentNotes = this.db.prepare(`
      SELECT content, category FROM strategy_notes 
      ORDER BY importance DESC, last_used DESC 
      LIMIT 10
    `).all() as any[];

    // Get learning context
    const learningContext = learningEngine.getLearningContext();

    const prompt = `You are analyzing a trading bot's weekly performance for self-improvement.

## PERFORMANCE SUMMARY (Last 7 Days)
- Total Trades: ${summary.totalTrades}
- Win Rate: ${(summary.winRate * 100).toFixed(1)}%
- Total P&L: $${summary.totalPnl.toFixed(2)}
- Average Trade Size: $${summary.avgTradeSize.toFixed(2)}
- Best Day: ${summary.bestDay || 'N/A'}
- Worst Day: ${summary.worstDay || 'N/A'}

## EXISTING LEARNINGS
${learningContext}

## CURRENT STRATEGY NOTES
${recentNotes.map(n => `- [${n.category}] ${n.content}`).join('\n')}

## YOUR TASK
Analyze this performance and provide:
1. A brief analysis of what's working and what's not (2-3 sentences)
2. 3-5 specific, actionable recommendations to improve performance
3. Any patterns you notice that should be remembered

Respond in JSON format:
{
  "analysis": "Your analysis here",
  "recommendations": ["rec1", "rec2", "rec3"],
  "newPatterns": [
    {"pattern": "description", "importance": 1-10, "category": "success_pattern|failure_pattern|market_condition|risk_note"}
  ]
}`;

    try {
      const response = await this.aiClient.chat.completions.create({
        model: config.ai.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 1500
      });

      const content = response.choices[0]?.message?.content || '{}';
      
      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          analysis: parsed.analysis || 'No analysis provided',
          recommendations: parsed.recommendations || []
        };
      }
    } catch (error) {
      logger.error('AI maintenance analysis failed:', error);
    }

    return {
      analysis: 'Unable to generate AI analysis',
      recommendations: []
    };
  }

  /**
   * Create strategy notes from AI insights
   */
  private createNotesFromAIInsights(insights: { analysis: string; recommendations: string[] }): number {
    let notesAdded = 0;

    // Add a summary note if analysis is substantial
    if (insights.analysis && insights.analysis.length > 50) {
      this.db.prepare(`
        INSERT INTO strategy_notes (id, category, content, importance, created_at, last_used, use_count)
        VALUES (?, 'market_condition', ?, 7, ?, ?, 0)
      `).run(
        `weekly_${Date.now()}`,
        `Weekly Analysis: ${insights.analysis}`,
        Date.now(),
        Date.now()
      );
      notesAdded++;
    }

    // Add high-priority recommendations as notes
    for (const rec of insights.recommendations.slice(0, 3)) {
      this.db.prepare(`
        INSERT INTO strategy_notes (id, category, content, importance, created_at, last_used, use_count)
        VALUES (?, 'risk_note', ?, 6, ?, ?, 0)
      `).run(
        `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        `AI Recommendation: ${rec}`,
        Date.now(),
        Date.now()
      );
      notesAdded++;
    }

    return notesAdded;
  }

  /**
   * Refresh statistical insights
   */
  private refreshInsights(): number {
    const stats = learningEngine.getStats();
    
    // Save a performance snapshot
    this.db.prepare(`
      INSERT INTO performance_snapshots (
        timestamp, period, total_trades, win_rate, total_pnl,
        avg_win, avg_loss, best_coin, worst_coin, insights_json
      ) VALUES (?, 'weekly', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Date.now(),
      stats.totalTrades,
      stats.winRate,
      stats.totalPnl,
      stats.avgWin,
      stats.avgLoss,
      stats.bestCoin,
      stats.worstCoin,
      JSON.stringify({ insightCount: stats.insightCount, noteCount: stats.noteCount })
    );

    return stats.insightCount;
  }

  /**
   * Save maintenance report
   */
  private saveMaintenanceReport(report: MaintenanceReport): void {
    this.db.prepare(`
      INSERT INTO maintenance_runs (timestamp, report_json, status)
      VALUES (?, ?, 'completed')
    `).run(report.timestamp, JSON.stringify(report));

    this.lastMaintenanceRun = report.timestamp;
  }

  /**
   * Get last maintenance report
   */
  getLastReport(): MaintenanceReport | null {
    const row = this.db.prepare(`
      SELECT report_json FROM maintenance_runs 
      ORDER BY timestamp DESC LIMIT 1
    `).get() as { report_json: string } | undefined;

    if (row) {
      return JSON.parse(row.report_json);
    }
    return null;
  }

  /**
   * Force immediate maintenance (for testing or manual trigger)
   */
  async forceMainenance(): Promise<MaintenanceReport> {
    return this.runMaintenance();
  }
}

export const maintenanceSystem = new MaintenanceSystem();
