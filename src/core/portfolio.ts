import Database from 'better-sqlite3';
import { config } from '../config/settings.js';
import { logger } from '../utils/logger.js';
import type { 
  PortfolioState, 
  Position, 
  Trade,
  AIResponse 
} from '../types/index.js';

// Paper trading portfolio simulation
export class PaperPortfolio {
  private db: Database.Database;
  private positions: Map<string, Position> = new Map();
  private balance: number;
  private trades: Trade[] = [];

  constructor(initialBalance: number = 500) {
    this.balance = initialBalance;
    this.db = new Database('data/paper_trades.db');
    this.initDatabase();
    this.loadState();
  }

  private initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS portfolio_state (
        id INTEGER PRIMARY KEY,
        balance REAL NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL UNIQUE,
        side TEXT NOT NULL,
        size REAL NOT NULL,
        entry_price REAL NOT NULL,
        leverage INTEGER NOT NULL,
        stop_loss REAL,
        take_profit REAL,
        opened_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        size REAL NOT NULL,
        price REAL NOT NULL,
        fee REAL NOT NULL,
        realized_pnl REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        analysis TEXT NOT NULL,
        market_regime TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        decisions TEXT NOT NULL,
        reasoning TEXT NOT NULL
      );
    `);
  }

  private loadState(): void {
    try {
      const state = this.db.prepare(
        'SELECT balance FROM portfolio_state ORDER BY id DESC LIMIT 1'
      ).get() as { balance: number } | undefined;

      if (state) {
        this.balance = state.balance;
      } else {
        this.saveState();
      }

      const positions = this.db.prepare('SELECT * FROM positions').all() as any[];
      for (const pos of positions) {
        this.positions.set(pos.symbol, {
          symbol: pos.symbol,
          side: pos.side,
          size: pos.size,
          entryPrice: pos.entry_price,
          currentPrice: pos.entry_price,
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          leverage: pos.leverage,
          liquidationPrice: 0,
          marginUsed: (pos.size * pos.entry_price) / pos.leverage,
          stopLoss: pos.stop_loss,
          takeProfit: pos.take_profit,
          openedAt: pos.opened_at
        });
      }

      logger.info(`Loaded paper portfolio: $${this.balance.toFixed(2)}, ${this.positions.size} positions`);
    } catch (error) {
      logger.error(`Failed to load portfolio state: ${error}`);
    }
  }

  private saveState(): void {
    this.db.prepare(
      'INSERT INTO portfolio_state (balance, updated_at) VALUES (?, ?)'
    ).run(this.balance, Date.now());
  }

  updatePrices(prices: Map<string, number>): void {
    for (const [symbol, position] of this.positions) {
      const currentPrice = prices.get(symbol);
      if (currentPrice) {
        position.currentPrice = currentPrice;
        
        const priceDiff = position.side === 'long'
          ? currentPrice - position.entryPrice
          : position.entryPrice - currentPrice;
        
        position.unrealizedPnl = priceDiff * position.size;
        position.unrealizedPnlPct = (priceDiff / position.entryPrice) * 100 * position.leverage;

        // Check stop loss
        if (position.stopLoss) {
          const hitStop = position.side === 'long'
            ? currentPrice <= position.stopLoss
            : currentPrice >= position.stopLoss;
          
          if (hitStop) {
            logger.warn(`Stop loss hit for ${symbol} @ $${currentPrice}`);
            this.closePosition(symbol, currentPrice, 'stop_loss');
          }
        }

        // Check take profit
        if (position.takeProfit) {
          const hitTp = position.side === 'long'
            ? currentPrice >= position.takeProfit
            : currentPrice <= position.takeProfit;
          
          if (hitTp) {
            logger.info(`Take profit hit for ${symbol} @ $${currentPrice}`);
            this.closePosition(symbol, currentPrice, 'take_profit');
          }
        }
      }
    }
  }

  openPosition(
    symbol: string,
    side: 'long' | 'short',
    size: number,
    entryPrice: number,
    leverage: number,
    stopLoss?: number,
    takeProfit?: number
  ): boolean {
    const marginRequired = (size * entryPrice) / leverage;
    
    if (marginRequired > this.balance) {
      logger.warn(`Insufficient balance for ${symbol} position`);
      return false;
    }

    this.balance -= marginRequired;

    const position: Position = {
      symbol,
      side,
      size,
      entryPrice,
      currentPrice: entryPrice,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      leverage,
      liquidationPrice: this.calculateLiquidationPrice(entryPrice, side, leverage),
      marginUsed: marginRequired,
      stopLoss,
      takeProfit,
      openedAt: Date.now()
    };

    this.positions.set(symbol, position);
    
    // Save to database
    this.db.prepare(`
      INSERT OR REPLACE INTO positions 
      (symbol, side, size, entry_price, leverage, stop_loss, take_profit, opened_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(symbol, side, size, entryPrice, leverage, stopLoss || null, takeProfit || null, Date.now());

    this.saveState();
    logger.info(`[PAPER] Opened ${side} ${symbol}: ${size} @ $${entryPrice} (${leverage}x)`);
    
    return true;
  }

  closePosition(symbol: string, exitPrice: number, reason: string = 'manual'): Trade | null {
    const position = this.positions.get(symbol);
    if (!position) {
      return null;
    }

    const priceDiff = position.side === 'long'
      ? exitPrice - position.entryPrice
      : position.entryPrice - exitPrice;
    
    const realizedPnl = priceDiff * position.size;
    const fee = position.size * exitPrice * 0.0005;

    this.balance += position.marginUsed + realizedPnl - fee;
    this.positions.delete(symbol);

    // Remove from database
    this.db.prepare('DELETE FROM positions WHERE symbol = ?').run(symbol);

    const trade: Trade = {
      id: `paper-${Date.now()}`,
      orderId: `paper-${Date.now()}`,
      symbol,
      side: position.side === 'long' ? 'sell' : 'buy',
      size: position.size,
      price: exitPrice,
      fee,
      realizedPnl,
      timestamp: Date.now()
    };

    // Save trade
    this.db.prepare(`
      INSERT INTO trades (id, order_id, symbol, side, size, price, fee, realized_pnl, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(trade.id, trade.orderId, trade.symbol, trade.side, trade.size, trade.price, trade.fee, trade.realizedPnl, trade.timestamp);

    this.trades.push(trade);
    this.saveState();

    logger.info(`[PAPER] Closed ${position.side} ${symbol} @ $${exitPrice} | P&L: $${realizedPnl.toFixed(2)} (${reason})`);
    
    return trade;
  }

  reducePosition(symbol: string, percentage: number, exitPrice: number): Trade | null {
    const position = this.positions.get(symbol);
    if (!position) {
      return null;
    }

    const reduceSize = position.size * (percentage / 100);
    const priceDiff = position.side === 'long'
      ? exitPrice - position.entryPrice
      : position.entryPrice - exitPrice;
    
    const realizedPnl = priceDiff * reduceSize;
    const fee = reduceSize * exitPrice * 0.0005;
    const marginReturned = position.marginUsed * (percentage / 100);

    this.balance += marginReturned + realizedPnl - fee;
    position.size -= reduceSize;
    position.marginUsed -= marginReturned;

    if (position.size <= 0.0001) {
      // Position fully closed
      this.positions.delete(symbol);
      this.db.prepare('DELETE FROM positions WHERE symbol = ?').run(symbol);
    } else {
      // Update position in database
      this.db.prepare(
        'UPDATE positions SET size = ? WHERE symbol = ?'
      ).run(position.size, symbol);
    }

    const trade: Trade = {
      id: `paper-reduce-${Date.now()}`,
      orderId: `paper-reduce-${Date.now()}`,
      symbol,
      side: position.side === 'long' ? 'sell' : 'buy',
      size: reduceSize,
      price: exitPrice,
      fee,
      realizedPnl,
      timestamp: Date.now()
    };

    this.db.prepare(`
      INSERT INTO trades (id, order_id, symbol, side, size, price, fee, realized_pnl, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(trade.id, trade.orderId, trade.symbol, trade.side, trade.size, trade.price, trade.fee, trade.realizedPnl, trade.timestamp);

    this.trades.push(trade);
    this.saveState();

    return trade;
  }

  private calculateLiquidationPrice(entryPrice: number, side: 'long' | 'short', leverage: number): number {
    // Simplified liquidation calculation
    const liqDistance = entryPrice / leverage * 0.9; // 90% of margin
    return side === 'long' 
      ? entryPrice - liqDistance 
      : entryPrice + liqDistance;
  }

  getState(): PortfolioState {
    const positionsArray = Array.from(this.positions.values());
    const unrealizedPnl = positionsArray.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const marginUsed = positionsArray.reduce((sum, p) => sum + p.marginUsed, 0);

    return {
      totalValue: this.balance + marginUsed + unrealizedPnl,
      availableBalance: this.balance,
      marginUsed,
      unrealizedPnl,
      positions: positionsArray,
      stableBalance: this.balance,
      lastUpdated: Date.now()
    };
  }

  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  getTrades(limit: number = 50): Trade[] {
    return this.trades.slice(-limit);
  }

  saveAIDecision(decision: AIResponse): void {
    this.db.prepare(`
      INSERT INTO ai_decisions (timestamp, analysis, market_regime, risk_level, decisions, reasoning)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      Date.now(),
      decision.analysis,
      decision.marketRegime,
      decision.riskLevel,
      JSON.stringify(decision.decisions),
      decision.reasoning
    );
  }

  getRecentDecisions(limit: number = 5): AIResponse[] {
    const rows = this.db.prepare(
      'SELECT * FROM ai_decisions ORDER BY timestamp DESC LIMIT ?'
    ).all(limit) as any[];

    return rows.map(row => ({
      analysis: row.analysis,
      marketRegime: row.market_regime,
      riskLevel: row.risk_level,
      decisions: JSON.parse(row.decisions),
      holdStablePct: 50,
      reasoning: row.reasoning,
      warnings: []
    }));
  }

  resetPortfolio(initialBalance: number = 500): void {
    this.balance = initialBalance;
    this.positions.clear();
    this.trades = [];
    
    this.db.prepare('DELETE FROM positions').run();
    this.db.prepare('DELETE FROM trades').run();
    this.db.prepare('DELETE FROM portfolio_state').run();
    this.saveState();
    
    logger.info(`Portfolio reset to $${initialBalance}`);
  }
}

export const paperPortfolio = new PaperPortfolio();
export default paperPortfolio;
