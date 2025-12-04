/**
 * AI Orchestrator - Multi-Model Architecture
 * 
 * Supports a "Planner/Executor" pattern:
 * - Planner: Smart model for strategy (runs less frequently)
 * - Executor: Fast model for tactics (runs every cycle)
 * 
 * Also supports multiple providers: Cerebras, OpenAI, Anthropic, Google, etc.
 */

import OpenAI from 'openai';
import { logger, tradeLog } from '../utils/logger.js';
import { config } from '../config/settings.js';
import type { MarketReport, AIResponse, TradeDecision } from '../types/index.js';
import { format } from 'date-fns';
import { learningEngine } from './learningEngine.js';

// Provider configurations
export interface AIProvider {
  id: string;
  name: string;
  baseURL: string;
  models: AIModel[];
  requiresApiKey: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  contextWindow: number;
  tier: 'production' | 'preview';
  limits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    tokensPerMinute: number;
  };
}

export interface ModelConfig {
  providerId: string;
  modelId: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

export interface PlannerDirective {
  timestamp: number;
  validUntil: number;
  marketRegime: 'bull' | 'bear' | 'ranging' | 'volatile' | 'uncertain';
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  strategy: string;
  coinDirectives: {
    symbol: string;
    bias: 'long' | 'short' | 'neutral' | 'avoid';
    maxAllocation: number;
    reasoning: string;
  }[];
  warnings: string[];
  overallConfidence: number;
}

// Available providers
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'cerebras',
    name: 'Cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    requiresApiKey: true,
    models: [
      {
        id: 'llama-3.3-70b',
        name: 'Llama 3.3 70B',
        contextWindow: 65536,
        tier: 'production',
        limits: { requestsPerMinute: 30, requestsPerHour: 900, requestsPerDay: 14400, tokensPerMinute: 64000 }
      },
      {
        id: 'gpt-oss-120b',
        name: 'GPT-OSS 120B',
        contextWindow: 65536,
        tier: 'production',
        limits: { requestsPerMinute: 30, requestsPerHour: 900, requestsPerDay: 14400, tokensPerMinute: 64000 }
      },
      {
        id: 'llama3.1-8b',
        name: 'Llama 3.1 8B',
        contextWindow: 8192,
        tier: 'production',
        limits: { requestsPerMinute: 30, requestsPerHour: 900, requestsPerDay: 14400, tokensPerMinute: 60000 }
      },
      {
        id: 'qwen-3-32b',
        name: 'Qwen 3 32B',
        contextWindow: 65536,
        tier: 'production',
        limits: { requestsPerMinute: 30, requestsPerHour: 900, requestsPerDay: 14400, tokensPerMinute: 64000 }
      },
      {
        id: 'qwen-3-235b-a22b-instruct-2507',
        name: 'Qwen 3 235B (Preview)',
        contextWindow: 65536,
        tier: 'preview',
        limits: { requestsPerMinute: 30, requestsPerHour: 900, requestsPerDay: 1440, tokensPerMinute: 64000 }
      },
      {
        id: 'zai-glm-4.6',
        name: 'ZAI-GLM 4.6 (Preview)',
        contextWindow: 64000,
        tier: 'preview',
        limits: { requestsPerMinute: 10, requestsPerHour: 100, requestsPerDay: 100, tokensPerMinute: 60000 }
      }
    ]
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    baseURL: 'https://api.perplexity.ai',
    requiresApiKey: true,
    models: [
      { id: 'llama-3.1-sonar-large-128k-online', name: 'Llama 3.1 Sonar Large 128K Online', contextWindow: 127072, tier: 'production', limits: { requestsPerMinute: 50, requestsPerHour: 1000, requestsPerDay: 10000, tokensPerMinute: 80000 } },
      { id: 'llama-3.1-sonar-small-128k-online', name: 'Llama 3.1 Sonar Small 128K Online', contextWindow: 127072, tier: 'production', limits: { requestsPerMinute: 50, requestsPerHour: 1000, requestsPerDay: 10000, tokensPerMinute: 80000 } },
      { id: 'llama-3.1-sonar-large-128k-chat', name: 'Llama 3.1 Sonar Large 128K Chat', contextWindow: 127072, tier: 'production', limits: { requestsPerMinute: 50, requestsPerHour: 1000, requestsPerDay: 10000, tokensPerMinute: 80000 } },
      { id: 'llama-3.1-sonar-small-128k-chat', name: 'Llama 3.1 Sonar Small 128K Chat', contextWindow: 127072, tier: 'production', limits: { requestsPerMinute: 50, requestsPerHour: 1000, requestsPerDay: 10000, tokensPerMinute: 80000 } }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseURL: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, tier: 'production', limits: { requestsPerMinute: 50, requestsPerHour: 1000, requestsPerDay: 10000, tokensPerMinute: 80000 } },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, tier: 'production', limits: { requestsPerMinute: 50, requestsPerHour: 1000, requestsPerDay: 10000, tokensPerMinute: 80000 } },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000, tier: 'production', limits: { requestsPerMinute: 100, requestsPerHour: 2000, requestsPerDay: 20000, tokensPerMinute: 100000 } }
    ]
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    requiresApiKey: true,
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, tier: 'production', limits: { requestsPerMinute: 60, requestsPerHour: 1000, requestsPerDay: 10000, tokensPerMinute: 100000 } },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, tier: 'production', limits: { requestsPerMinute: 60, requestsPerHour: 1000, requestsPerDay: 10000, tokensPerMinute: 100000 } }
    ]
  },
  {
    id: 'groq',
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, tier: 'production', limits: { requestsPerMinute: 30, requestsPerHour: 1000, requestsPerDay: 14400, tokensPerMinute: 6000 } },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, tier: 'production', limits: { requestsPerMinute: 30, requestsPerHour: 1000, requestsPerDay: 14400, tokensPerMinute: 5000 } }
    ]
  }
];

// System prompts
const PLANNER_SYSTEM_PROMPT = `You are a senior portfolio strategist AI. Your role is to analyze market conditions and set HIGH-LEVEL strategy directives that will guide a separate execution AI.

You run every 15-30 minutes and your decisions set the overall direction. You DO NOT make specific trade decisions - you set the strategy that the executor will follow.

Your output must be JSON:
{
  "marketRegime": "bull" | "bear" | "ranging" | "volatile" | "uncertain",
  "riskTolerance": "conservative" | "moderate" | "aggressive",
  "strategy": "Brief description of overall strategy",
  "coinDirectives": [
    {
      "symbol": "BTC",
      "bias": "long" | "short" | "neutral" | "avoid",
      "maxAllocation": 25,
      "reasoning": "Why this bias"
    }
  ],
  "warnings": ["Any major risks or concerns"],
  "overallConfidence": 0.8
}`;

const EXECUTOR_SYSTEM_PROMPT = `You are a trading execution AI. You follow directives from a senior strategist and make tactical decisions.

STRATEGIST DIRECTIVES (MUST FOLLOW):
{plannerDirectives}

Your role is to execute within these guidelines. You can:
- Time entries/exits based on short-term signals
- Adjust position sizes within the max allocation limits
- Choose not to trade if conditions are poor
- You CANNOT go against the strategist's bias (e.g., no longs if bias is "short")

Your response MUST be valid JSON:
{
  "analysis": "Brief tactical analysis",
  "marketRegime": "from planner",
  "riskLevel": "low" | "moderate" | "high",
  "decisions": [
    {
      "action": "BUY" | "SELL" | "CLOSE" | "HOLD" | "REDUCE",
      "symbol": "BTC",
      "side": "long" | "short",
      "percentage": 10,
      "leverage": 3,
      "stopLoss": 95000,
      "takeProfit": 105000,
      "reason": "Explanation",
      "confidence": 0.8,
      "urgency": "low" | "medium" | "high"
    }
  ],
  "holdStablePct": 50,
  "reasoning": "Why these decisions",
  "warnings": []
}`;

export class AIOrchestrator {
  private clients: Map<string, OpenAI> = new Map();
  private plannerConfig: ModelConfig | null = null;
  private executorConfig: ModelConfig;
  private currentDirective: PlannerDirective | null = null;
  private lastPlannerRun: number = 0;
  private plannerIntervalMs: number = 15 * 60 * 1000; // 15 minutes

  constructor() {
    // Default executor is Cerebras Llama
    this.executorConfig = {
      providerId: 'cerebras',
      modelId: config.ai.model || 'llama-3.3-70b',
      apiKey: process.env.CEREBRAS_API_KEY || '',
      temperature: config.ai.temperature || 0.3,
      maxTokens: config.ai.max_tokens || 2000
    };
  }

  /**
   * Initialize a client for a provider
   */
  private getClient(providerId: string, apiKey: string): OpenAI {
    const cacheKey = `${providerId}-${apiKey.slice(-8)}`;
    
    if (this.clients.has(cacheKey)) {
      return this.clients.get(cacheKey)!;
    }

    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    // Anthropic requires different handling
    if (providerId === 'anthropic') {
      // For now, use OpenAI-compatible endpoint via proxy or direct
      // In production, you'd use the Anthropic SDK
      const client = new OpenAI({
        apiKey,
        baseURL: 'https://api.anthropic.com/v1',
        defaultHeaders: {
          'anthropic-version': '2023-06-01'
        }
      });
      this.clients.set(cacheKey, client);
      return client;
    }

    const client = new OpenAI({
      apiKey,
      baseURL: provider.baseURL
    });
    
    this.clients.set(cacheKey, client);
    return client;
  }

  /**
   * Set the planner model (smart/slow model for strategy)
   */
  setPlannerModel(config: ModelConfig): void {
    this.plannerConfig = config;
    logger.info(`🧠 Planner model set: ${config.providerId}/${config.modelId}`);
  }

  /**
   * Set the executor model (fast model for tactics)
   */
  setExecutorModel(config: ModelConfig): void {
    this.executorConfig = config;
    logger.info(`Executor model set: ${config.providerId}/${config.modelId}`);
  }

  /**
   * Disable planner (use only executor)
   */
  disablePlanner(): void {
    this.plannerConfig = null;
    this.currentDirective = null;
    logger.info('🧠 Planner disabled - using executor only');
  }

  /**
   * Get current configuration
   */
  getConfig(): { planner: ModelConfig | null; executor: ModelConfig; directive: PlannerDirective | null } {
    return {
      planner: this.plannerConfig,
      executor: this.executorConfig,
      directive: this.currentDirective
    };
  }

  /**
   * Run planner if needed
   */
  private async runPlannerIfNeeded(report: MarketReport): Promise<void> {
    if (!this.plannerConfig) return;

    const now = Date.now();
    const directiveExpired = !this.currentDirective || now > this.currentDirective.validUntil;
    const intervalPassed = now - this.lastPlannerRun > this.plannerIntervalMs;

    if (!directiveExpired && !intervalPassed) {
      return; // Directive still valid
    }

    logger.info('🧠 Running planner model for strategic analysis...');
    
    try {
      const client = this.getClient(this.plannerConfig.providerId, this.plannerConfig.apiKey);
      const prompt = this.buildPlannerPrompt(report);

      const startTime = Date.now();
      const completion = await client.chat.completions.create({
        model: this.plannerConfig.modelId,
        messages: [
          { role: 'system', content: PLANNER_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature: this.plannerConfig.temperature || 0.4,
        max_tokens: this.plannerConfig.maxTokens || 1500
      });

      const responseTime = Date.now() - startTime;
      logger.info(`🧠 Planner response: ${responseTime}ms`);

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          this.currentDirective = {
            timestamp: now,
            validUntil: now + this.plannerIntervalMs,
            marketRegime: parsed.marketRegime || 'uncertain',
            riskTolerance: parsed.riskTolerance || 'moderate',
            strategy: parsed.strategy || '',
            coinDirectives: parsed.coinDirectives || [],
            warnings: parsed.warnings || [],
            overallConfidence: parsed.overallConfidence || 0.5
          };
          
          logger.info(`Strategy: ${this.currentDirective.strategy}`);
          logger.info(`Market: ${this.currentDirective.marketRegime}, Risk: ${this.currentDirective.riskTolerance}`);
        }
      }

      this.lastPlannerRun = now;

    } catch (error) {
      logger.error('Planner error:', error);
      // Continue with executor even if planner fails
    }
  }

  /**
   * Build prompt for planner
   */
  private buildPlannerPrompt(report: MarketReport): string {
    const ts = format(new Date(report.timestamp), 'yyyy-MM-dd HH:mm');
    
    let prompt = `STRATEGIC MARKET ANALYSIS - ${ts}\n\n`;
    
    prompt += `Portfolio: $${report.portfolio.totalValue.toFixed(2)}\n`;
    prompt += `Positions: ${report.portfolio.positions.length}\n\n`;

    prompt += `COINS TO ANALYZE:\n`;
    for (const coin of report.coins) {
      prompt += `\n${coin.symbol}: $${coin.ticker.price.toFixed(2)} | Trend: ${coin.trend} | Strength: ${coin.strength}\n`;
      const ind = coin.indicators['1h'] || coin.indicators['15m'];
      if (ind) {
        prompt += `  RSI: ${ind.rsi?.toFixed(1) || 'N/A'} | MACD: ${(ind.macd?.histogram ?? 0) > 0 ? 'Bullish' : 'Bearish'}\n`;
      }
    }

    prompt += `\nProvide strategic directives for the next 15-30 minutes.`;
    
    return prompt;
  }

  /**
   * Analyze market with orchestrated models
   */
  async analyzeMarket(report: MarketReport): Promise<AIResponse> {
    // Run planner if configured and needed
    await this.runPlannerIfNeeded(report);

    // Run executor
    const client = this.getClient(this.executorConfig.providerId, this.executorConfig.apiKey);
    const prompt = this.buildExecutorPrompt(report);

    tradeLog.ai('Analyzing', `${report.coins.length} coins`);
    const startTime = Date.now();

    try {
      // Build system prompt with planner directives if available
      let systemPrompt = EXECUTOR_SYSTEM_PROMPT;
      if (this.currentDirective) {
        systemPrompt = systemPrompt.replace(
          '{plannerDirectives}',
          JSON.stringify(this.currentDirective, null, 2)
        );
      } else {
        systemPrompt = systemPrompt.replace(
          'STRATEGIST DIRECTIVES (MUST FOLLOW):\n{plannerDirectives}\n\n',
          ''
        );
      }

      const completion = await client.chat.completions.create({
        model: this.executorConfig.modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: this.executorConfig.temperature || 0.3,
        max_tokens: this.executorConfig.maxTokens || 2000,
        response_format: { type: 'json_object' }
      });

      const responseTime = Date.now() - startTime;
      tradeLog.ai('Response', `${responseTime}ms`);

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty AI response');
      }

      return this.parseResponse(content);

    } catch (error) {
      tradeLog.error('AIOrchestrator.analyzeMarket', error as Error);
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

  /**
   * Build executor prompt
   */
  private buildExecutorPrompt(report: MarketReport): string {
    const ts = format(new Date(report.timestamp), 'yyyy-MM-dd HH:mm:ss');
    
    let prompt = `MARKET REPORT - ${ts} UTC\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Portfolio Overview
    prompt += `PORTFOLIO STATUS\n`;
    prompt += `Total Value: $${report.portfolio.totalValue.toFixed(2)}\n`;
    prompt += `Available Balance: $${report.portfolio.availableBalance.toFixed(2)}\n`;
    prompt += `Unrealized P&L: $${report.portfolio.unrealizedPnl.toFixed(2)}\n\n`;

    // Current Positions
    if (report.portfolio.positions.length > 0) {
      prompt += `OPEN POSITIONS\n`;
      for (const pos of report.portfolio.positions) {
        const pnlSign = pos.unrealizedPnl >= 0 ? '+' : '';
        prompt += `• ${pos.symbol} ${pos.side.toUpperCase()}: `;
        prompt += `$${pos.entryPrice.toFixed(2)} → $${pos.currentPrice.toFixed(2)} `;
        prompt += `(${pnlSign}${pos.unrealizedPnlPct.toFixed(2)}%)\n`;
      }
      prompt += `\n`;
    }

    // Coin Analysis
    prompt += `🪙 COIN ANALYSIS\n`;
    for (const coin of report.coins) {
      prompt += `\n═══ ${coin.symbol} ═══\n`;
      prompt += `Price: $${coin.ticker.price.toFixed(4)}\n`;
      prompt += `Trend: ${coin.trend.toUpperCase()} (strength: ${coin.strength}/100)\n`;
      
      const indicators = coin.indicators['15m'] || coin.indicators['5m'];
      if (indicators) {
        prompt += `RSI: ${indicators.rsi?.toFixed(1) || 'N/A'}\n`;
        if (indicators.macd) {
          prompt += `MACD: ${indicators.macd.histogram > 0 ? 'Bullish' : 'Bearish'}\n`;
        }
      }
    }

    // Learning context
    const learningContext = learningEngine.getLearningContext();
    if (learningContext) {
      prompt += `\n🧠 LEARNED FROM PAST TRADES\n${learningContext}`;
    }

    prompt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `Provide your trading decisions as JSON.`;

    return prompt;
  }

  /**
   * Parse executor response
   */
  private parseResponse(content: string): AIResponse {
    const parsed = JSON.parse(content);
    
    const filteredDecisions: TradeDecision[] = (parsed.decisions || [])
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

    // If planner has directives, validate executor decisions against them
    if (this.currentDirective) {
      for (const decision of filteredDecisions) {
        const coinDirective = this.currentDirective.coinDirectives.find(c => c.symbol === decision.symbol);
        if (coinDirective) {
          // Validate bias alignment
          if (coinDirective.bias === 'avoid' && decision.action === 'BUY') {
            logger.warn(`Executor tried to BUY ${decision.symbol} but planner says AVOID`);
            decision.action = 'HOLD';
          }
          if (coinDirective.bias === 'short' && decision.side === 'long') {
            logger.warn(`Executor tried LONG ${decision.symbol} but planner bias is SHORT`);
            decision.side = 'short';
          }
          if (coinDirective.bias === 'long' && decision.side === 'short') {
            logger.warn(`Executor tried SHORT ${decision.symbol} but planner bias is LONG`);
            decision.side = 'long';
          }
        }
      }
    }

    return {
      analysis: parsed.analysis || '',
      marketRegime: parsed.marketRegime || this.currentDirective?.marketRegime || 'uncertain',
      riskLevel: parsed.riskLevel || 'moderate',
      decisions: filteredDecisions,
      holdStablePct: Math.max(parsed.holdStablePct || 50, config.risk.min_stable_pct),
      reasoning: parsed.reasoning || '',
      warnings: parsed.warnings || []
    };
  }
}

export const aiOrchestrator = new AIOrchestrator();
