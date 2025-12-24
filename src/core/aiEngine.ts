import OpenAI from 'openai';
import { config, getEnvRequired, getEnvOptional } from '../config/settings.js';
import { logger, tradeLog } from '../utils/logger.js';
import type { MarketReport, AIResponse, TradeDecision, CoinAnalysis, PortfolioState } from '../types/index.js';
import { format } from 'date-fns';
import { learningEngine } from './learningEngine.js';
import { getModelById, AI_MODELS } from './aiProviderRegistry.js';

// AI Provider Clients
const cerebras = new OpenAI({
  apiKey: getEnvRequired('CEREBRAS_API_KEY'),
  baseURL: 'https://api.cerebras.ai/v1'
});

// Secondary Cerebras key for failover
const cerebrasFailover = new OpenAI({
  apiKey: getEnvOptional('CEREBRAS_API_KEY_2', ''),
  baseURL: 'https://api.cerebras.ai/v1'
});

const perplexity = new OpenAI({
  apiKey: getEnvOptional('PERPLEXITY_API_KEY', ''),
  baseURL: 'https://api.perplexity.ai'
});

const openai = new OpenAI({
  apiKey: getEnvOptional('OPENAI_API_KEY', ''),
});

const SYSTEM_PROMPT = `You are an expert cryptocurrency trading AI managing a portfolio on Hyperliquid (perpetual futures DEX).

Your goals:
1. Preserve capital - never risk more than necessary
2. Maximize risk-adjusted returns
3. Follow strict risk management rules
4. Make data-driven decisions based on technical analysis

Risk Rules:
- Never allocate more than ${config.risk.max_single_position_pct}% to a single position
- Always maintain at least ${config.risk.min_stable_pct}% in stablecoins
- Maximum leverage: ${config.risk.max_leverage}x (default: ${config.risk.default_leverage}x)
- Stop losses are mandatory
- Pause trading if daily loss exceeds ${config.risk.max_daily_loss_pct}%

Your response MUST be valid JSON matching this schema:
{
  "analysis": "Brief market overview",
  "marketRegime": "trending_up" | "trending_down" | "ranging" | "volatile" | "uncertain",
  "riskLevel": "low" | "moderate" | "high" | "extreme",
  "decisions": [
    {
      "action": "BUY" | "SELL" | "CLOSE" | "HOLD" | "REDUCE",
      "symbol": "BTC",
      "side": "long" | "short" (required for BUY),
      "percentage": 10 (% of available balance to use),
      "leverage": 3 (optional, uses default if not specified),
      "stopLoss": 95000 (required for BUY),
      "takeProfit": 105000 (optional),
      "reason": "Brief explanation",
      "confidence": 0.8 (0-1 scale),
      "urgency": "low" | "medium" | "high"
    }
  ],
  "holdStablePct": 50 (target % to keep in stablecoins),
  "reasoning": "Detailed explanation of your analysis and decisions",
  "warnings": ["Any risk warnings or concerns"]
}

Important:
- Only include actions you're confident about (>60% confidence)
- HOLD means do nothing for that coin
- REDUCE means partially close a position
- Always provide stopLoss for new positions
- Consider funding rates for perpetuals
- Higher leverage = lower position size to maintain same risk`;

export class AIEngine {
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private provider: 'cerebras' | 'perplexity' | 'openai';
  private lastDecision: AIResponse | null = null;

  constructor() {
    // Get model configuration from registry
    const modelId = config.ai?.model || 'gpt-oss-120b';
    const aiModel = getModelById(modelId);
    
    if (!aiModel) {
      throw new Error(`Invalid AI model: ${modelId}`);
    }
    
    this.model = aiModel.id;
    this.provider = aiModel.provider;
    this.temperature = config.ai?.temperature || 0.3;
    // Use max tokens from model registry, not config
    this.maxTokens = config.ai?.max_tokens || 4000;
    
    logger.info(`AI Engine initialized: ${aiModel.name} (${aiModel.provider})`);
    logger.info(`Max tokens: ${this.maxTokens}, Context window: ${aiModel.contextWindow}`);
  }

  async analyzeMarket(report: MarketReport): Promise<AIResponse> {
    const prompt = this.buildPrompt(report);
    
    tradeLog.ai('Analyzing', `${report.coins.length} coins`);
    const startTime = Date.now();

    try {
      const completion = await this.callWithRetry([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]);

      const responseTime = Date.now() - startTime;
      tradeLog.ai('Response', `${responseTime}ms`);

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty AI response');
      }

      const response = this.parseResponse(content);
      this.lastDecision = response;
      
      // Log decisions
      for (const decision of response.decisions) {
        if (decision.action !== 'HOLD') {
          tradeLog.decision(
            decision.symbol,
            `${decision.action}${decision.side ? ` ${decision.side}` : ''}`,
            decision.reason,
            decision.confidence
          );
        }
      }

      return response;

    } catch (error) {
      tradeLog.error('AIEngine.analyzeMarket', error as Error);
      
      // Return safe default response
      return {
        analysis: 'AI error - defaulting to hold',
        marketRegime: 'uncertain',
        riskLevel: 'high',
        decisions: [],
        holdStablePct: 100,
        reasoning: 'Error occurred during analysis',
        warnings: ['AI analysis failed - holding all positions']
      };
    }
  }

  private buildPrompt(report: MarketReport): string {
    const ts = format(new Date(report.timestamp), 'yyyy-MM-dd HH:mm:ss');
    
    let prompt = `MARKET REPORT - ${ts} UTC\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Portfolio Overview
    prompt += `PORTFOLIO STATUS\n`;
    prompt += `Total Value: $${report.portfolio.totalValue.toFixed(2)}\n`;
    prompt += `Available Balance: $${report.portfolio.availableBalance.toFixed(2)}\n`;
    prompt += `Unrealized P&L: $${report.portfolio.unrealizedPnl.toFixed(2)}\n`;
    prompt += `Positions: ${report.portfolio.positions.length}\n\n`;

    // Current Positions
    if (report.portfolio.positions.length > 0) {
      prompt += `OPEN POSITIONS\n`;
      for (const pos of report.portfolio.positions) {
        const pnlSign = pos.unrealizedPnl >= 0 ? '+' : '';
        prompt += `• ${pos.symbol} ${pos.side.toUpperCase()}: `;
        prompt += `$${pos.entryPrice.toFixed(2)} → $${pos.currentPrice.toFixed(2)} `;
        prompt += `(${pnlSign}${pos.unrealizedPnlPct.toFixed(2)}%) `;
        prompt += `[${pos.leverage}x, SL: ${pos.stopLoss || 'none'}]\n`;
      }
      prompt += `\n`;
    }

    // Coin Analysis
    prompt += `COIN ANALYSIS\n`;
    for (const coin of report.coins) {
      prompt += `\n═══ ${coin.symbol} ═══\n`;
      prompt += `Price: $${coin.ticker.price.toFixed(4)} `;
      prompt += `(24h: ${coin.ticker.change24h >= 0 ? '+' : ''}${coin.ticker.change24h.toFixed(2)}%)\n`;
      prompt += `Volume 24h: $${this.formatNumber(coin.ticker.volume24h)}\n`;
      
      if (coin.ticker.fundingRate !== undefined) {
        prompt += `Funding: ${(coin.ticker.fundingRate * 100).toFixed(4)}%\n`;
      }

      prompt += `Trend: ${coin.trend.toUpperCase()} (strength: ${coin.strength}/100)\n`;
      
      // Primary timeframe indicators (15m)
      const indicators = coin.indicators['15m'] || coin.indicators['5m'];
      if (indicators) {
        prompt += `RSI(14): ${indicators.rsi?.toFixed(1) || 'N/A'}\n`;
        if (indicators.macd) {
          prompt += `MACD: ${indicators.macd.histogram > 0 ? 'Bullish' : 'Bearish'} `;
          prompt += `(hist: ${indicators.macd.histogram.toFixed(4)})\n`;
        }
        if (indicators.bollinger) {
          const bbPos = ((coin.ticker.price - indicators.bollinger.lower) / 
            (indicators.bollinger.upper - indicators.bollinger.lower) * 100).toFixed(0);
          prompt += `Bollinger: ${bbPos}% (L:${indicators.bollinger.lower.toFixed(2)} `;
          prompt += `M:${indicators.bollinger.middle.toFixed(2)} U:${indicators.bollinger.upper.toFixed(2)})\n`;
        }
        prompt += `Volume: ${indicators.volumeProfile}\n`;
      }

      if (coin.signals.length > 0) {
        prompt += `Signals: ${coin.signals.join(', ')}\n`;
      }
    }

    // Add sentiment context to prompt
    if (report.marketSentiment) {
      prompt += `\nMARKET SENTIMENT\n`;
      if (report.marketSentiment.fearGreedIndex) {
        prompt += `Fear & Greed Index: ${report.marketSentiment.fearGreedIndex}/100\n`;
      }
      if (report.marketSentiment.overallSentiment) {
        prompt += `Overall Market Sentiment: ${report.marketSentiment.overallSentiment.toUpperCase()}\n`;
      }
      if (report.marketSentiment.socialSentiment && Object.keys(report.marketSentiment.socialSentiment).length > 0) {
        prompt += `Social Sentiment:\n`;
        Object.entries(report.marketSentiment.socialSentiment).forEach(([symbol, sentiment]) => {
          const sentimentLabel = sentiment > 0.3 ? 'BULLISH' : sentiment < -0.3 ? 'BEARISH' : 'NEUTRAL';
          prompt += `• ${symbol}: ${sentimentLabel} (${(sentiment * 100).toFixed(0)}%)\n`;
        });
      }
      if (report.marketSentiment.newsCount && Object.keys(report.marketSentiment.newsCount).length > 0) {
        prompt += `Recent News Activity:\n`;
        Object.entries(report.marketSentiment.newsCount).forEach(([symbol, count]) => {
          const activityLabel = count > 7 ? 'HIGH' : count > 3 ? 'MODERATE' : 'LOW';
          prompt += `• ${symbol}: ${activityLabel} (${count} articles)\n`;
        });
      }
      prompt += `\n`;
    }

    // Bot Performance
    prompt += `\nBOT PERFORMANCE\n`;
    prompt += `Daily P&L: ${report.botPerformance.dailyPnl >= 0 ? '+' : ''}${report.botPerformance.dailyPnlPct.toFixed(2)}%\n`;
    prompt += `Win Rate: ${(report.botPerformance.winRate * 100).toFixed(1)}%\n`;
    prompt += `Avg Win: $${report.botPerformance.avgWin.toFixed(2)} / `;
    prompt += `Avg Loss: $${report.botPerformance.avgLoss.toFixed(2)}\n`;

    // Recent Decisions
    if (report.recentDecisions.length > 0) {
      prompt += `\nRECENT AI DECISIONS\n`;
      const lastDecision = report.recentDecisions[0];
      if (lastDecision) {
        prompt += `Last analysis: ${lastDecision.analysis}\n`;
        prompt += `Actions taken: ${lastDecision.decisions.map(d => `${d.action} ${d.symbol}`).join(', ') || 'None'}\n`;
      }
    }

    // Add learning context from past trades
    const learningContext = learningEngine.getLearningContext();
    if (learningContext) {
      prompt += `\nLEARNED FROM PAST TRADES\n`;
      prompt += learningContext;
    }

    prompt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `Based on this data AND your learnings from past trades, provide your trading decisions as JSON.`;
    prompt += `\nIMPORTANT: Apply lessons learned - avoid patterns that led to losses, repeat patterns that led to wins.`;

    return prompt;
  }

  private parseResponse(content: string): AIResponse {
    try {
      // Try to fix truncated JSON responses
      let jsonContent = content.trim();
      
      // If JSON appears truncated, try to close it properly
      if (!jsonContent.endsWith('}')) {
        logger.warn('AI response appears truncated, attempting to fix...');
        
        // Count open braces and brackets
        const openBraces = (jsonContent.match(/{/g) || []).length;
        const closeBraces = (jsonContent.match(/}/g) || []).length;
        const openBrackets = (jsonContent.match(/\[/g) || []).length;
        const closeBrackets = (jsonContent.match(/]/g) || []).length;
        
        // Try to find a valid JSON substring
        let lastValidIndex = jsonContent.length;
        for (let i = jsonContent.length - 1; i >= 0; i--) {
          if (jsonContent[i] === '"' || jsonContent[i] === ',' || jsonContent[i] === ':') {
            lastValidIndex = i;
            break;
          }
        }
        
        // Truncate at last clean point and close brackets/braces
        jsonContent = jsonContent.substring(0, lastValidIndex);
        
        // Remove trailing commas or colons
        jsonContent = jsonContent.replace(/[,:\s]+$/, '');
        
        // Close any unclosed strings
        const quoteCount = (jsonContent.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          jsonContent += '"';
        }
        
        // Close brackets and braces
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          jsonContent += ']';
        }
        for (let i = 0; i < openBraces - closeBraces; i++) {
          jsonContent += '}';
        }
      }
      
      const parsed = JSON.parse(jsonContent);
      
      // Validate required fields
      if (!parsed.analysis || !parsed.decisions || !Array.isArray(parsed.decisions)) {
        throw new Error('Missing required fields in AI response');
      }

      // Filter decisions by confidence threshold
      const filteredDecisions: TradeDecision[] = parsed.decisions
        .filter((d: TradeDecision) => d.confidence >= config.ai.min_confidence_to_trade)
        .map((d: TradeDecision) => ({
          action: d.action,
          symbol: d.symbol,
          side: d.side,
          percentage: Math.min(d.percentage, config.risk.max_single_position_pct),
          leverage: Math.min(d.leverage || config.risk.default_leverage, config.risk.max_leverage),
          stopLoss: d.stopLoss,
          takeProfit: d.takeProfit,
          reason: d.reason,
          confidence: d.confidence,
          urgency: d.urgency || 'medium'
        }));

      return {
        analysis: parsed.analysis,
        marketRegime: parsed.marketRegime || 'uncertain',
        riskLevel: parsed.riskLevel || 'moderate',
        decisions: filteredDecisions,
        holdStablePct: Math.max(parsed.holdStablePct || 50, config.risk.min_stable_pct),
        reasoning: parsed.reasoning || '',
        warnings: parsed.warnings || []
      };

    } catch (error) {
      logger.error(`Failed to parse AI response: ${error}`);
      throw error;
    }
  }

  private async getProviderClient(): Promise<OpenAI> {
    switch (this.provider) {
      case 'cerebras':
        // Try primary key first
        if (cerebras.apiKey) {
          return cerebras;
        }
        // Failover to secondary key
        if (cerebrasFailover.apiKey) {
          logger.warn('Primary Cerebras key failed, using secondary key');
          return cerebrasFailover;
        }
        throw new Error('Both CEREBRAS_API_KEY and CEREBRAS_API_KEY_2 not configured');
      case 'perplexity':
        if (!perplexity.apiKey) {
          throw new Error('PERPLEXITY_API_KEY not configured');
        }
        return perplexity;
      case 'openai':
        if (!openai.apiKey) {
          throw new Error('OPENAI_API_KEY not configured');
        }
        return openai;
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }

  private async callWithRetry(messages: any[], attempt: number = 1): Promise<any> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    try {
      const client = await this.getProviderClient();
      
      const response = await client.chat.completions.create({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });
      
      return response;
    } catch (error: any) {
      // If Cerebras fails and we haven't tried failover yet
      if (this.provider === 'cerebras' && attempt === 1 && cerebrasFailover.apiKey) {
        logger.warn(`Cerebras API call failed, attempting failover: ${error.message}`);
        
        // Try with failover client
        try {
          const response = await cerebrasFailover.chat.completions.create({
            model: this.model,
            messages,
            temperature: this.temperature,
            max_tokens: this.maxTokens,
          });
          
          logger.info('Successfully used failover Cerebras key');
          return response;
        } catch (failoverError: any) {
          logger.error(`Both Cerebras keys failed: ${failoverError.message}`);
          
          // If we still have retries, try again with delay
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1);
            logger.warn(`Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.callWithRetry(messages, attempt + 1);
          }
          
          throw failoverError;
        }
      }
      
      // For other providers or if out of retries
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.warn(`${this.provider} API call failed, retrying in ${delay}ms: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.callWithRetry(messages, attempt + 1);
      }
      
      throw error;
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  }

  getLastDecision(): AIResponse | null {
    return this.lastDecision;
  }

  async chat(message: string, context?: {
    portfolio?: any;
    signals?: any[];
    prices?: Record<string, any>;
  }): Promise<string> {
    const chatPrompt = `You are an AI trading assistant for a crypto trading bot on Hyperliquid.

Current context:
${context ? `
Portfolio: $${context.portfolio?.totalValue?.toFixed(2) || 'N/A'}
Open positions: ${context.portfolio?.positions?.length || 0}
Active signals: ${context.signals?.length || 0}
Prices: ${context.prices ? Object.entries(context.prices).map(([sym, p]: [string, any]) => `${sym}: $${p.price}`).join(', ') : 'Loading...'}
` : ''}

User question: ${message}

Respond helpfully and concisely. If they ask about trading, provide analysis. If they ask about status, give current state. Be conversational but professional.`;

    try {
      const completion = await this.callWithRetry([
        { role: 'user', content: chatPrompt }
      ]);

      return completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
    } catch (error) {
      logger.error('Chat AI error:', error);
      throw error;
    }
  }
}

export const aiEngine = new AIEngine();
export default aiEngine;
