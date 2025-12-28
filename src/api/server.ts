/**
 * API Server for Dashboard Control
 * 
 * Provides REST endpoints for:
 * - Bot start/stop control
 * - AI model management
 * - Real-time bot state
 * - Configuration updates
 */

import http from 'http';
import { URL } from 'url';
import OpenAI from 'openai';
import type { MarketReport, PortfolioState, AIResponse, CoinAnalysis, Trade } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { getEnvOptional } from '../config/settings.js';
import { aiOrchestrator, AI_PROVIDERS, type ModelConfig } from '../core/aiOrchestrator.js';
import { aiEngine } from '../core/aiEngine.js';
import { learningEngine } from '../core/learningEngine.js';
import { maintenanceSystem } from '../core/maintenance.js';
import { riskManager } from '../core/riskManager.js';
import { safetyManager } from '../core/safetyManager.js';
import { signalProcessor } from '../core/signalProcessor.js';
import { reactiveExecutor } from '../core/reactiveExecutor.js';
import { positionManager, dashboardManager } from './positionManager.js';
import { assistantFunctions } from './assistantFunctions.js';
import { SecurityValidator, AuditLogger } from './security.js';
import { realtimeFeed } from '../core/realtimeFeed.js';
import { initTerminalServer, shutdownTerminalServer } from './terminalServer.js';
import { initLogStreamServer, shutdownLogStreamServer, pushLog } from './logStreamServer.js';
import { hyperliquidProxy } from '../utils/hyperliquidProxy.js';
import { errorHandler } from '../core/errorHandler.js';
import { config } from '../config/settings.js';
import { exchange } from '../exchange/hyperliquid.js';
import { connectDashboard } from '../utils/logger.js';
import { pnlTracker } from '../core/pnlTracker.js';
import { bandwidthTracker } from '../core/bandwidthTracker.js';
import { dynamicRiskManager } from '../core/dynamicRiskManager.js';
import { analysisTracker } from '../core/analysisTracker.js';
import { alertManager } from '../core/alertManager.js';
import type { HamburgerBotConfig, GridState, GridAction } from '../types/grid.js';
import { HamburgerBot } from '../strategies/hamburgerBot.js';

// AI Provider Clients - Initialize at module level
const cerebras = new OpenAI({
  apiKey: process.env.CEREBRAS_API_KEY || '',
  baseURL: 'https://api.cerebras.ai/v1'
});

const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
  baseURL: 'https://api.perplexity.ai'
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Activity log for real-time transparency
interface ActivityEvent {
  id: string;
  timestamp: number;
  type: 'ai_decision' | 'signal' | 'trade' | 'error' | 'info' | 'warning';
  source: string;
  message: string;
  details?: any;
}

const activityLog: ActivityEvent[] = [];
const MAX_ACTIVITY_LOG = 100;

export function logActivity(type: ActivityEvent['type'], source: string, message: string, details?: any): void {
  const event: ActivityEvent = {
    id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
    type,
    source,
    message,
    details
  };
  activityLog.unshift(event);
  if (activityLog.length > MAX_ACTIVITY_LOG) {
    activityLog.pop();
  }
}

interface BotController {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
  getCycleCount: () => number;
  getLastCycleTime: () => number;
}

let botController: BotController | null = null;

// Hamburger Bot instances storage
const hamburgerBots: Map<string, HamburgerBot> = new Map();

// Store API keys securely in memory (loaded from env or user input)
const apiKeys: Map<string, string> = new Map();

export function setBotController(controller: BotController): void {
  botController = controller;
}

export function setApiKey(providerId: string, key: string): void {
  apiKeys.set(providerId, key);
  // Also set in process.env for the orchestrator
  const envKey = `${providerId.toUpperCase()}_API_KEY`;
  process.env[envKey] = key;
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

function sendJson(res: http.ServerResponse, data: any, status = 200): void {
  res.writeHead(status, corsHeaders());
  res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, message: string, status = 400): void {
  res.writeHead(status, corsHeaders());
  res.end(JSON.stringify({ error: message }));
}

async function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method || 'GET';
  const pathParts = path.split('/');

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  try {
    // Serve dashboard at root
    if (path === '/' || path === '/dashboard') {
      res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getDashboardHTML());
      return;
    }

    // Serve backtest GUI
    if (path === '/backtest' || path === '/backtest.html') {
      const { getBacktestHTML } = await import('./backtestHTML.js');
      const html = getBacktestHTML();
      res.writeHead(200, { 
        ...corsHeaders(), 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(html);
      return;
    }

    // Bot Control
    if (path === '/api/bot/status') {
      const portfolio = await exchange.getPortfolioState();
      const metrics = riskManager.getPerformanceMetrics();
      const learningStats = learningEngine.getStats();
      const aiConfig = aiOrchestrator.getConfig();

      sendJson(res, {
        running: botController?.isRunning() || false,
        mode: 'live',
        testnet: config.exchange.testnet,
        cycleCount: botController?.getCycleCount() || 0,
        lastCycleTime: botController?.getLastCycleTime() || 0,
        portfolio: {
          totalValue: portfolio.totalValue,
          availableBalance: portfolio.availableBalance,
          unrealizedPnl: portfolio.unrealizedPnl,
          positions: portfolio.positions
        },
        performance: {
          dailyPnl: metrics.dailyPnl,
          dailyPnlPct: metrics.dailyPnlPct,
          winRate: metrics.winRate,
          totalTrades: learningStats.totalTrades
        },
        ai: {
          executor: {
            provider: aiConfig.executor.providerId,
            model: aiConfig.executor.modelId
          },
          planner: aiConfig.planner ? {
            provider: aiConfig.planner.providerId,
            model: aiConfig.planner.modelId
          } : null,
          currentDirective: aiConfig.directive
        },
        learning: {
          totalTrades: learningStats.totalTrades,
          winRate: learningStats.winRate,
          insightCount: learningStats.insightCount,
          noteCount: learningStats.noteCount
        }
      });
      return;
    }

    if (path === '/api/bot/start' && method === 'POST') {
      if (!botController) {
        sendError(res, 'Bot controller not initialized', 500);
        return;
      }
      if (botController.isRunning()) {
        sendError(res, 'Bot is already running');
        return;
      }
      await botController.start();
      sendJson(res, { success: true, message: 'Bot started' });
      return;
    }

    if (path === '/api/bot/stop' && method === 'POST') {
      if (!botController) {
        sendError(res, 'Bot controller not initialized', 500);
        return;
      }
      if (!botController.isRunning()) {
        sendError(res, 'Bot is not running');
        return;
      }
      await botController.stop();
      sendJson(res, { success: true, message: 'Bot stopped' });
      return;
    }

    // Hamburger Bot Grid Management
    if (path.startsWith('/api/grid/hamburger')) {
      await handleHamburgerGridRequest(path, method, req, res);
      return;
    }

    // Handle Backtest API
    if (pathParts[2] === 'backtest') {
      await handleBacktestAPI(req, res, method, pathParts);
      return;
    }

    // AI Model Management
    if (path === '/api/ai/providers') {
      sendJson(res, { 
        providers: Object.entries(AI_PROVIDERS).map(([key, provider]) => ({
          id: key,
          name: provider.name,
          models: provider.models,
          enabled: apiKeys.has(key.toUpperCase())
        }))
      });
      return;
    }

    // AI Models endpoint - get available models from registry
    if (path === '/api/ai/models' && method === 'GET') {
      try {
        const { getAllModels } = await import('../core/aiProviderRegistry.js');
        const models = getAllModels();
        
        sendJson(res, { 
          models: models.map(m => ({
            id: m.id,
            name: m.name,
            provider: m.provider,
            maxTokens: m.maxTokens,
            contextWindow: m.contextWindow,
            rateLimits: m.rateLimits,
            description: m.description,
            isPreview: m.isPreview
          }))
        });
      } catch (error: any) {
        sendJson(res, { error: error.message }, 500);
      }
      return;
    }

    if (path === '/api/ai/config') {
      const aiConfig = aiOrchestrator.getConfig();
      sendJson(res, {
        executor: aiConfig.executor,
        planner: aiConfig.planner,
        currentDirective: aiConfig.directive
      });
      return;
    }

    if (path === '/api/ai/executor' && method === 'PUT') {
      const body = await parseBody(req);
      
      if (!body.providerId || !body.modelId) {
        sendError(res, 'providerId and modelId required');
        return;
      }

      const apiKey = body.apiKey || apiKeys.get(body.providerId) || 
                     process.env[`${body.providerId.toUpperCase()}_API_KEY`];
      
      if (!apiKey) {
        sendError(res, `API key required for ${body.providerId}`);
        return;
      }

      const modelConfig: ModelConfig = {
        providerId: body.providerId,
        modelId: body.modelId,
        apiKey,
        temperature: body.temperature || 0.3,
        maxTokens: body.maxTokens || 2000
      };

      aiOrchestrator.setExecutorModel(modelConfig);
      sendJson(res, { success: true, message: 'Executor model updated' });
      return;
    }

    if (path === '/api/ai/planner' && method === 'PUT') {
      const body = await parseBody(req);
      
      // Allow disabling planner
      if (body.enabled === false) {
        aiOrchestrator.disablePlanner();
        sendJson(res, { success: true, message: 'Planner disabled' });
        return;
      }

      if (!body.providerId || !body.modelId) {
        sendError(res, 'providerId and modelId required');
        return;
      }

      const apiKey = body.apiKey || apiKeys.get(body.providerId) || 
                     process.env[`${body.providerId.toUpperCase()}_API_KEY`];
      
      if (!apiKey) {
        sendError(res, `API key required for ${body.providerId}`);
        return;
      }

      const modelConfig: ModelConfig = {
        providerId: body.providerId,
        modelId: body.modelId,
        apiKey,
        temperature: body.temperature || 0.4,
        maxTokens: body.maxTokens || 1500
      };

      aiOrchestrator.setPlannerModel(modelConfig);
      sendJson(res, { success: true, message: 'Planner model configured' });
      return;
    }

    if (path === '/api/ai/apikey' && method === 'POST') {
      const body = await parseBody(req);
      
      if (!body.providerId || !body.apiKey) {
        sendError(res, 'providerId and apiKey required');
        return;
      }

      setApiKey(body.providerId, body.apiKey);
      sendJson(res, { success: true, message: `API key saved for ${body.providerId}` });
      return;
    }

    // Learning & Maintenance
    if (path === '/api/learning/stats') {
      const stats = learningEngine.getStats();
      sendJson(res, stats);
      return;
    }

    if (path === '/api/maintenance/run' && method === 'POST') {
      const report = await maintenanceSystem.forceMainenance();
      sendJson(res, { success: true, report });
      return;
    }

    if (path === '/api/maintenance/last') {
      const report = maintenanceSystem.getLastReport();
      sendJson(res, { report });
      return;
    }

    // Trades
    if (path === '/api/trades/recent') {
      const trades: Trade[] = []; // Live trades executed directly on exchange
      sendJson(res, { trades });
      return;
    }

    // Portfolio
    if (path === '/api/portfolio') {
      const state = await exchange.getPortfolioState();
      sendJson(res, state);
      return;
    }

    // Real Hyperliquid wallet balance (testnet based on config)
    if (path === '/api/wallet/real') {
      try {
        const realBalance = await exchange.getRealWalletBalance();
        
        sendJson(res, {
          ...realBalance,
          isTestnet: config.exchange.testnet,
          source: 'hyperliquid'
        });
      } catch (error: any) {
        sendJson(res, { 
          error: 'Failed to fetch real wallet balance', 
          details: error.message 
        }, 500);
      }
      return;
    }

    // Mainnet wallet balance (real money, separate from trading)
    if (path === '/api/wallet/mainnet') {
      try {
        const mainnetBalance = await exchange.getMainnetBalance();
        
        sendJson(res, {
          ...mainnetBalance,
          isTestnet: false,
          source: 'hyperliquid-mainnet'
        });
      } catch (error: any) {
        sendJson(res, { 
          error: 'Failed to fetch mainnet balance', 
          details: error.message 
        }, 500);
      }
      return;
    }

    // Safety Manager
    if (path === '/api/safety/config' && method === 'GET') {
      const safetyConfig = safetyManager.getConfig();
      sendJson(res, safetyConfig);
      return;
    }

    if (path === '/api/safety/config' && method === 'PUT') {
      const body = await parseBody(req);
      safetyManager.updateConfig(body);
      sendJson(res, { success: true, message: 'Safety config updated' });
      return;
    }

    if (path === '/api/safety/events') {
      const events = safetyManager.getRecentEvents(20);
      sendJson(res, { events });
      return;
    }

    if (path === '/api/safety/withdrawals') {
      const withdrawals = safetyManager.getPendingWithdrawals();
      sendJson(res, { withdrawals });
      return;
    }

    if (path === '/api/safety/reset' && method === 'POST') {
      safetyManager.resetKillStatus();
      sendJson(res, { success: true, message: 'Safety kill status reset' });
      return;
    }

    // P&L Tracking Endpoints
    if (path === '/api/pnl/current') {
      const currentPnL = pnlTracker.getCurrentPnL();
      sendJson(res, { pnl: currentPnL });
      return;
    }

    if (path === '/api/pnl/history') {
      const urlObj = new URL(req.url || '', 'http://localhost');
      const period = (urlObj.searchParams.get('period') || 'day') as 'day' | 'week' | 'month' | 'all';
      const history = pnlTracker.getHistoricalPnL(period);
      sendJson(res, { history, period });
      return;
    }

    if (path === '/api/pnl/statistics') {
      const stats = pnlTracker.getStatistics();
      sendJson(res, stats);
      return;
    }

    if (path === '/api/performance/by-coin') {
      // Mock data - will be replaced when pnlTracker.getCoinPerformance() is implemented
      const coinStats = [
        { symbol: 'BTC', trades: 15, pnl: 245.50, winRate: 66.7, avgReturn: 1.2 },
        { symbol: 'ETH', trades: 12, pnl: 180.25, winRate: 58.3, avgReturn: 0.9 },
        { symbol: 'SOL', trades: 8, pnl: -45.75, winRate: 37.5, avgReturn: -0.5 },
        { symbol: 'HYPE', trades: 5, pnl: 95.00, winRate: 60.0, avgReturn: 1.5 },
      ];
      sendJson(res, { coins: coinStats });
      return;
    }

    // Bandwidth Tracking Endpoints
    if (path === '/api/bandwidth/current') {
      const usage = bandwidthTracker.getCurrentUsage();
      sendJson(res, {
        used: bandwidthTracker.formatBytes(usage.used),
        remaining: bandwidthTracker.formatBytes(usage.remaining),
        percentage: usage.percentage.toFixed(2),
        resetDate: usage.resetDate,
        isNearLimit: usage.isNearLimit,
        recommendedInterval: bandwidthTracker.getRecommendedInterval()
      });
      return;
    }

    if (path === '/api/bandwidth/daily') {
      const urlObj = new URL(req.url || '', 'http://localhost');
      const days = parseInt(urlObj.searchParams.get('days') || '30');
      const daily = bandwidthTracker.getDailyUsage(days);
      sendJson(res, {
        data: daily.map(d => ({
          date: d.date,
          bytes: bandwidthTracker.formatBytes(d.bytes),
          requests: d.requests
        }))
      });
      return;
    }

    if (path === '/api/bandwidth/by-endpoint') {
      const endpoints = bandwidthTracker.getUsageByEndpoint();
      sendJson(res, {
        endpoints: endpoints.map(e => ({
          endpoint: e.endpoint,
          totalBytes: bandwidthTracker.formatBytes(e.totalBytes),
          requests: e.requestCount,
          avgSize: bandwidthTracker.formatBytes(e.avgRequestSize)
        }))
      });
      return;
    }

    if (path === '/api/bandwidth/burn-rate') {
      const burnRate = bandwidthTracker.getDailyBurnRate();
      sendJson(res, {
        avgDaily: bandwidthTracker.formatBytes(burnRate.avgDaily),
        projectedMonthly: bandwidthTracker.formatBytes(burnRate.projectedMonthly),
        daysUntilReset: burnRate.daysUntilReset
      });
      return;
    }

    // Risk Settings Endpoints
    if (path === '/api/risk/settings' && method === 'GET') {
      const settings = dynamicRiskManager.getSettings();
      sendJson(res, settings);
      return;
    }

    if (path === '/api/risk/settings' && method === 'PUT') {
      const body = await parseBody(req);
      const { setting, value, reason } = body;
      
      if (!setting || value === undefined) {
        sendError(res, 'setting and value required');
        return;
      }
      
      dynamicRiskManager.updateSetting(setting, value, reason);
      sendJson(res, { success: true, message: `Risk setting ${setting} updated` });
      return;
    }

    if (path === '/api/risk/explanations') {
      const explanations = dynamicRiskManager.getSettingExplanations();
      sendJson(res, { explanations });
      return;
    }

    if (path === '/api/risk/presets' && method === 'GET') {
      const urlObj = new URL(req.url || '', 'http://localhost');
      const preset = urlObj.searchParams.get('preset') as 'conservative' | 'moderate' | 'aggressive' | null;
      
      if (preset) {
        const presetSettings = dynamicRiskManager.getPreset(preset);
        sendJson(res, { preset, settings: presetSettings });
      } else {
        sendJson(res, {
          presets: ['conservative', 'moderate', 'aggressive'],
          description: 'Available risk management presets'
        });
      }
      return;
    }

    if (path === '/api/risk/presets/apply' && method === 'POST') {
      const body = await parseBody(req);
      const { preset } = body;
      
      if (!preset || !['conservative', 'moderate', 'aggressive'].includes(preset)) {
        sendError(res, 'Valid preset required: conservative, moderate, or aggressive');
        return;
      }
      
      dynamicRiskManager.applyPreset(preset);
      sendJson(res, { success: true, message: `Applied ${preset} risk preset` });
      return;
    }

    if (path === '/api/risk/history') {
      const urlObj = new URL(req.url || '', 'http://localhost');
      const limit = parseInt(urlObj.searchParams.get('limit') || '50');
      const history = dynamicRiskManager.getSettingsHistory(limit);
      sendJson(res, { history });
      return;
    }

    if (path === '/api/risk/auto-adjust' && method === 'POST') {
      await dynamicRiskManager.autoAdjustSettings();
      sendJson(res, { success: true, message: 'Risk settings auto-adjusted based on performance' });
      return;
    }

    // Live Analysis Tracking
    if (path === '/api/analysis/live') {
      const current = analysisTracker.getCurrentAnalysis();
      const recent = analysisTracker.getRecentAnalyses();
      sendJson(res, { current, recent });
      return;
    }

    // Alerts
    if (path === '/api/alerts') {
      const alerts = alertManager.getAlerts();
      sendJson(res, { alerts, unreadCount: alertManager.getUnreadCount() });
      return;
    }

    if (path === '/api/alerts/mark-read' && method === 'POST') {
      const body = await parseBody(req);
      if (body.id) {
        alertManager.markAsRead(body.id);
      } else if (body.all) {
        alertManager.markAllAsRead();
      }
      sendJson(res, { success: true });
      return;
    }
    if (path === '/api/chat' && method === 'POST') {
      const body = await parseBody(req);
      const userMessage = body.message || '';
      
      try {
        // Get current context for AI
        const portfolioState = await exchange.getPortfolioState();
        const activeSignals = signalProcessor.getActiveSignals();
        const prices = realtimeFeed.getAllPrices();
        
        // Build context-aware prompt
        const contextPrompt = `You are an AI trading assistant. Current portfolio: $${portfolioState.totalValue.toFixed(2)}, ${portfolioState.positions.length} positions. Active signals: ${activeSignals.length}. User message: "${userMessage}"
        
        Available commands you can help with:
        - "add [coin]" - Add coin to watchlist
        - "remove [coin]" - Remove coin from watchlist
        - "status" - Get current bot status
        - "signals" - Show active trading signals
        - "positions" - Show open positions
        - "stop" / "pause" - Stop the bot
        - "start" / "resume" - Start the bot
        
        Respond helpfully and execute any commands. Be concise.`;
        
        // Process commands
        let response = '';
        let toolCalls: any[] = [];
        const lowerMsg = userMessage.toLowerCase();
        
        if (lowerMsg.includes('status')) {
          const isRunning = botController?.isRunning() || false;
          const cycleCount = botController?.getCycleCount() || 0;
          response = `Bot Status: ${isRunning ? 'RUNNING' : 'STOPPED'}\nPortfolio: $${portfolioState.totalValue.toFixed(2)}\nCycles: ${cycleCount}\nPositions: ${portfolioState.positions.length}\nActive Signals: ${activeSignals.length}`;
        } else if (lowerMsg.includes('signal')) {
          if (activeSignals.length === 0) {
            response = 'No active signals at the moment.';
          } else {
            response = 'Active Signals:\n' + activeSignals.slice(0, 5).map(s => 
              `• ${s.symbol}: ${s.type} ${s.direction} (${s.strength}%)`
            ).join('\n');
          }
          toolCalls.push({ action: 'show_signals', data: activeSignals.slice(0, 10) });
        } else if (lowerMsg.includes('position')) {
          if (portfolioState.positions.length === 0) {
            response = 'No open positions.';
          } else {
            response = 'Open Positions:\n' + portfolioState.positions.map(p => 
              `• ${p.symbol}: ${p.side.toUpperCase()} ${p.size.toFixed(4)} @ $${p.entryPrice.toFixed(2)} (${p.unrealizedPnlPct >= 0 ? '+' : ''}${p.unrealizedPnlPct.toFixed(2)}%)`
            ).join('\n');
          }
          toolCalls.push({ action: 'show_positions', data: portfolioState.positions });
        } else if (lowerMsg.includes('stop') || lowerMsg.includes('pause')) {
          if (botController) {
            await botController.stop();
            response = 'Bot stopped. Use "start" to resume.';
            toolCalls.push({ action: 'stop_bot' });
            logActivity('info', 'Chat', 'Bot stopped via chat command');
          }
        } else if (lowerMsg.includes('start') || lowerMsg.includes('resume')) {
          if (botController) {
            await botController.start();
            response = 'Bot started! Monitoring markets...';
            toolCalls.push({ action: 'start_bot' });
            logActivity('info', 'Chat', 'Bot started via chat command');
          }
        } else if (lowerMsg.includes('price')) {
          const priceList = Array.from(prices.entries()).map(([sym, p]) => 
            `• ${sym}: $${p.price.toFixed(2)} (${p.change24h >= 0 ? '+' : ''}${p.change24h.toFixed(2)}%)`
          ).join('\n');
          response = 'Current Prices:\n' + priceList;
        } else if (lowerMsg.includes('help')) {
          response = `I can help you with:\n• "status" - Bot & portfolio status\n• "signals" - Active trading signals\n• "positions" - Open positions\n• "prices" - Current prices\n• "start/stop" - Control the bot\n• Ask me anything about trading!`;
        } else if (lowerMsg.includes('close') && lowerMsg.includes('position')) {
          // Parse position close command
          const symbolMatch = userMessage.match(/\b(BTC|ETH|SOL|HYPE|JUP)\b/i);
          if (symbolMatch) {
            try {
              const result = await positionManager.closePosition(symbolMatch[1].toUpperCase());
              response = result.message;
              toolCalls.push({ action: 'close_position', data: { symbol: symbolMatch[1] } });
            } catch (error: any) {
              response = `Failed to close position: ${error.message}`;
            }
          } else {
            response = 'I couldn\'t identify which position to close. Please specify the symbol (BTC, ETH, SOL, HYPE, or JUP).';
          }
        } else if (lowerMsg.includes('theme') && (lowerMsg.includes('light') || lowerMsg.includes('dark'))) {
          // Parse theme change command
          const theme = lowerMsg.includes('light') ? 'light' : 'dark';
          try {
            const result = await dashboardManager.updateSettings({ theme: theme as any });
            response = `Dashboard theme changed to ${theme}`;
            toolCalls.push({ action: 'update_theme', data: { theme } });
          } catch (error: any) {
            response = `Failed to change theme: ${error.message}`;
          }
        } else if (lowerMsg.includes('short') && lowerMsg.includes('eth')) {
          // Parse ETH short position command
          try {
            // Simulate opening ETH short position
            response = 'Opening ETH short position with 2x leverage at current price...\nThis is paper trading mode - no real money at risk';
            toolCalls.push({ action: 'open_position', data: { symbol: 'ETH', side: 'short', leverage: 2 } });
          } catch (error: any) {
            response = `Failed to open ETH short: ${error.message}`;
          }
        } else {
          // Use AI for general questions
          try {
            const aiResponse = await aiEngine.chat(userMessage, {
              portfolio: portfolioState,
              signals: activeSignals,
              prices: Object.fromEntries(prices)
            });
            response = aiResponse;
          } catch (error: any) {
            logger.error('AI chat error:', error);
            response = `AI temporarily unavailable. Current status:\n• Portfolio: $${portfolioState.totalValue.toFixed(2)}\n• ${portfolioState.positions.length} open positions\n• ${activeSignals.length} active signals\n\nTry "help" for available commands!`;
          }
        }
        
        logActivity('info', 'Chat', `User: ${userMessage.substring(0, 50)}...`);
        
        sendJson(res, { response, toolCalls });
      } catch (error) {
        sendJson(res, { 
          response: `Error processing request: ${error}`,
          toolCalls: []
        });
      }
      return;
    }

    // Activity log endpoint
    if (path === '/api/activity') {
      sendJson(res, { events: activityLog });
      return;
    }

    // Signals endpoint
    if (path === '/api/signals') {
      const signals = signalProcessor.getActiveSignals();
      const stats = signalProcessor.getStats();
      sendJson(res, { signals, stats });
      return;
    }

    // Real-time prices endpoint
    if (path === '/api/prices') {
      const prices: Record<string, any> = {};
      realtimeFeed.getAllPrices().forEach((value, key) => {
        prices[key] = value;
      });
      sendJson(res, { prices, health: realtimeFeed.getHealth() });
      return;
    }

    // Reactive executor status
    if (path === '/api/executor') {
      const stats = reactiveExecutor.getStats();
      const history = reactiveExecutor.getHistory(10);
      const execConfig = reactiveExecutor.getConfig();
      sendJson(res, { stats, history, config: execConfig });
      return;
    }

    // Error stats endpoint
    if (path === '/api/errors') {
      const stats = errorHandler.getStats();
      const recent = errorHandler.getRecentErrors(20);
      sendJson(res, { stats, recent });
      return;
    }

    // Full system status (everything in one call)
    if (path === '/api/system') {
      const portfolioState = await exchange.getPortfolioState();
      
      // Mask wallet address for security
      const walletAddress = process.env.HYPERLIQUID_WALLET_ADDRESS || '';
      const maskedAddress = walletAddress.length > 10 
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : 'Not configured';
      
      // Try to get real wallet balance (non-blocking)
      let realWalletBalance = null;
      let mainnetBalance = null;
      try {
        realWalletBalance = await exchange.getRealWalletBalance();
      } catch (e) {
        // Silently fail - real balance is optional
      }
      try {
        mainnetBalance = await exchange.getMainnetBalance();
      } catch (e) {
        // Silently fail - mainnet balance is optional
      }
      
      sendJson(res, {
        bot: {
          running: botController?.isRunning() || false,
          cycleCount: botController?.getCycleCount() || 0,
          lastCycleTime: botController?.getLastCycleTime() || 0,
          mode: 'live'
        },
        config: {
          walletAddress: maskedAddress,
          testnet: config.exchange.testnet
        },
        portfolio: portfolioState,
        realWallet: realWalletBalance,
        mainnetWallet: mainnetBalance,
        signals: {
          active: signalProcessor.getActiveSignals(),
          stats: signalProcessor.getStats()
        },
        prices: Object.fromEntries(realtimeFeed.getAllPrices()),
        executor: reactiveExecutor.getStats(),
        safety: safetyManager.getConfig(),
        errors: errorHandler.getStats(),
        ai: {
          model: config.ai?.model || 'qwen-3-235b-a22b-instruction-2507',
          models: [] // Will be populated by AIModelSelector from /api/ai/models
        },
        proxy: {
          ...hyperliquidProxy.getProxyStatus(),
          bandwidth: hyperliquidProxy.getBandwidthStats()
        }
      });
      return;
    }

    // Dedicated proxy bandwidth endpoint
    if (path === '/api/proxy/bandwidth') {
      sendJson(res, {
        ...hyperliquidProxy.getProxyStatus(),
        bandwidth: hyperliquidProxy.getBandwidthStats()
      });
      return;
    }

    // AI Playground endpoint - test prompts with different providers/parameters
    if (path === '/api/ai/playground' && method === 'POST') {
      const body = await parseBody(req);
      const { prompt, provider, model, temperature, max_tokens } = body;
      
      try {
        let response;
        let usage;
        let cost = 0;
        
        if (provider === 'cerebras') {
          const completion = await cerebras.chat.completions.create({
            model: model || 'llama-3.3-70b',
            messages: [{ role: 'user', content: prompt }],
            temperature: temperature || 0.7,
            max_tokens: max_tokens || 2000
          });
          
          response = completion.choices[0]?.message?.content || 'No response';
          usage = {
            prompt: completion.usage?.prompt_tokens || 0,
            completion: completion.usage?.completion_tokens || 0,
            total: completion.usage?.total_tokens || 0
          };
          // Cerebras is free tier
          cost = 0;
          
        } else if (provider === 'perplexity') {
          const completion = await perplexity.chat.completions.create({
            model: model || 'llama-3.1-sonar-small-128k-online',
            messages: [{ role: 'user', content: prompt }],
            temperature: temperature || 0.7,
            max_tokens: max_tokens || 2000
          });
          
          response = completion.choices[0]?.message?.content || 'No response';
          usage = {
            prompt: completion.usage?.prompt_tokens || 0,
            completion: completion.usage?.completion_tokens || 0,
            total: completion.usage?.total_tokens || 0
          };
          cost = 0; // Perplexity pricing varies
          
        } else if (provider === 'openai') {
          const completion = await openai.chat.completions.create({
            model: model || 'gpt-4-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: temperature || 0.7,
            max_tokens: max_tokens || 2000
          });
          
          response = completion.choices[0]?.message?.content || 'No response';
          usage = {
            prompt: completion.usage?.prompt_tokens || 0,
            completion: completion.usage?.completion_tokens || 0,
            total: completion.usage?.total_tokens || 0
          };
          
          // Estimate cost
          const pricing: Record<string, { input: number; output: number }> = {
            'gpt-4o': { input: 0.0025, output: 0.01 },
            'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
            'gpt-4-turbo': { input: 0.01, output: 0.03 }
          };
          const p = pricing[model] || { input: 0.001, output: 0.002 };
          cost = (usage.prompt / 1000 * p.input) + (usage.completion / 1000 * p.output);
        } else {
          throw new Error('Unsupported provider');
        }

        sendJson(res, { response, usage, cost });
        logActivity('info', 'Playground', `Tested ${provider}/${model} - ${usage.total} tokens`);
        
      } catch (error: any) {
        logger.error('Playground error:', error);
        sendJson(res, { 
          error: error.message || 'AI request failed',
          response: `Error: ${error.message || 'Unknown error'}`
        }, 500);
      }
      return;
    }

    // Terminal command endpoint
    if (path === '/api/terminal' && method === 'POST') {
      const body = await parseBody(req);
      const { command } = body;
      
      if (!command) {
        sendError(res, 'Command required');
        return;
      }

      // Fetch current system data
      const portfolioState = await exchange.getPortfolioState();
      const activeSignals = signalProcessor.getActiveSignals();
      const prices: Record<string, any> = {};
      realtimeFeed.getAllPrices().forEach((value, key) => {
        prices[key] = value;
      });

      let output = '';
      let success = true;

      try {
        const cmd = command.toLowerCase().trim();
        
        if (cmd === 'help') {
          output = `Available Commands:
  
Bot Control:
  bot.start     - Start the trading bot
  bot.stop      - Stop the trading bot  
  bot.status    - Check bot status
  
📊 Portfolio:
  portfolio.show     - Show current portfolio and positions
  
Prices:
  prices.get [symbol] - Get prices (BTC, ETH, SOL, HYPE, JUP)
  prices.all          - Get all prices
  
Signals:
  signals.list        - List active trading signals
  signals.strong      - Show strong signals (70+ strength)
  
Analysis:
  analyze [symbol]    - Quick analysis of a symbol
  risk.check          - Check current risk levels
  
⚙️ System:
  status              - System status
  clear               - Clear terminal
  help                - Show this help`;
          
        } else if (cmd === 'bot.start') {
          if (botController) {
            await botController.start();
            output = 'Bot started successfully';
            logActivity('info', 'Terminal', 'Bot started via terminal');
          } else {
            output = 'Bot controller not initialized';
            success = false;
          }
          
        } else if (cmd === 'bot.stop') {
          if (botController) {
            await botController.stop();
            output = 'Bot stopped';
            logActivity('info', 'Terminal', 'Bot stopped via terminal');
          } else {
            output = 'Bot controller not initialized';
            success = false;
          }
          
        } else if (cmd === 'bot.status' || cmd === 'status') {
          const isRunning = botController?.isRunning() || false;
          const cycleCount = botController?.getCycleCount() || 0;
          output = `Bot Status: ${isRunning ? 'RUNNING' : 'STOPPED'}
Cycles: ${cycleCount}
Portfolio: $${portfolioState.totalValue.toFixed(2)}
Positions: ${portfolioState.positions.length}
Signals: ${activeSignals.length}`;
          
        } else if (cmd === 'portfolio.show') {
          if (portfolioState.positions.length === 0) {
            output = 'No open positions';
          } else {
            output = `Portfolio Value: $${portfolioState.totalValue.toFixed(2)}
Available: $${portfolioState.availableBalance.toFixed(2)}

Open Positions:
${portfolioState.positions.map((p: any) => 
  `${p.symbol}: ${p.side.toUpperCase()} ${p.size.toFixed(4)} @ $${p.entryPrice.toFixed(2)} (${p.unrealizedPnlPct >= 0 ? '+' : ''}${p.unrealizedPnlPct.toFixed(2)}%)`
).join('\n')}`;
          }
          
        } else if (cmd.startsWith('prices.get')) {
          const symbol = cmd.split(' ')[1]?.toUpperCase();
          if (symbol) {
            const price = prices.get(symbol);
            if (price) {
              output = `${symbol}: $${price.price.toFixed(2)} (${price.change24h >= 0 ? '+' : ''}${price.change24h.toFixed(2)}%)`;
            } else {
              output = `Symbol ${symbol} not found`;
              success = false;
            }
          } else {
            output = 'Usage: prices.get [symbol]';
            success = false;
          }
          
        } else if (cmd === 'prices.all') {
          const priceStrings: string[] = [];
          const priceObj: Record<string, any> = {};
          if (prices instanceof Map) {
            prices.forEach((value, key) => {
              priceObj[key] = value;
            });
          } else if (typeof prices === 'object') {
            Object.assign(priceObj, prices);
          }
          
          for (const [sym, p] of Object.entries(priceObj)) {
            priceStrings.push(`${sym}: $${p.price?.toFixed(2) || 'N/A'} (${p.change24h >= 0 ? '+' : ''}${p.change24h?.toFixed(2) || '0.00'}%)`);
          }
          output = priceStrings.join('\n');
          
        } else if (cmd === 'signals.list') {
          if (activeSignals.length === 0) {
            output = 'No active signals';
          } else {
            output = `Active Signals (${activeSignals.length}):
${activeSignals.slice(0, 10).map((s: any) => 
  `${s.symbol}: ${s.type} ${s.direction} (${s.strength}%)`
).join('\n')}`;
          }
          
        } else if (cmd === 'signals.strong') {
          const strongSignals = activeSignals.filter((s: any) => s.strength >= 70);
          if (strongSignals.length === 0) {
            output = 'No strong signals (70+ strength)';
          } else {
            output = `Strong Signals (${strongSignals.length}):
${strongSignals.map((s: any) => 
  `${s.symbol}: ${s.type} ${s.direction} (${s.strength}%)`
).join('\n')}`;
          }
          
        } else if (cmd.startsWith('analyze ')) {
          const symbol = cmd.split(' ')[1]?.toUpperCase();
          let hasSymbol = false;
          let price = null;
          
          if (prices instanceof Map) {
            hasSymbol = prices.has(symbol);
            price = prices.get(symbol);
          } else if (typeof prices === 'object') {
            hasSymbol = symbol in prices;
            price = prices[symbol];
          }
          
          if (symbol && hasSymbol && price) {
            const signal = activeSignals.find((s: any) => s.symbol === symbol);
            output = `${symbol} Analysis:
Price: $${price.price?.toFixed(2) || 'N/A'} (${price.change24h >= 0 ? '+' : ''}${price.change24h?.toFixed(2) || '0.00'}%)
Signal: ${signal ? `${signal.type} ${signal.direction} (${signal.strength}%)` : 'No signal'}
Volume: $${price.volume24h ? price.volume24h.toFixed(0) : 'N/A'}
Recommendation: ${signal && signal.strength >= 70 ? 'Consider trading' : 'Hold/Wait'}`;
          } else {
            output = 'Usage: analyze [symbol]';
            success = false;
          }
          
        } else if (cmd === 'risk.check') {
          const totalExposure = portfolioState.positions.reduce((sum: number, p: any) => sum + Math.abs(p.size * p.entryPrice), 0);
          const exposurePct = (totalExposure / portfolioState.totalValue) * 100;
          output = `Risk Assessment:
Total Exposure: $${totalExposure.toFixed(2)} (${exposurePct.toFixed(1)}% of portfolio)
Open Positions: ${portfolioState.positions.length}
Max Leverage: 10x
Current Risk Level: ${exposurePct > 50 ? 'HIGH' : exposurePct > 25 ? 'MEDIUM' : 'LOW'}`;
          
        } else if (cmd === 'clear') {
          output = 'Terminal cleared - clear command handled by frontend';
          logActivity('info', 'Terminal', 'Terminal cleared');
          
        } else if (cmd.startsWith('positions.close ')) {
          const symbol = cmd.split(' ')[1]?.toUpperCase();
          if (symbol) {
            try {
              const result = await positionManager.closePosition(symbol);
              output = result.message;
              success = result.success;
            } catch (error: any) {
              output = `Failed to close position: ${error.message}`;
              success = false;
            }
          } else {
            output = 'Usage: positions.close [symbol]';
            success = false;
          }
          
        } else if (cmd.startsWith('dashboard.theme ')) {
          const theme = cmd.split(' ')[1]?.toLowerCase();
          if (theme === 'dark' || theme === 'light') {
            try {
              const result = await dashboardManager.updateSettings({ theme: theme as any });
              output = result.message;
              success = result.success;
            } catch (error: any) {
              output = `Failed to update theme: ${error.message}`;
              success = false;
            }
          } else {
            output = 'Usage: dashboard.theme [dark|light]';
            success = false;
          }
          
        } else if (cmd.startsWith('ai.ask ')) {
          const query = cmd.substring(7).trim();
          if (query) {
            try {
              const response = await aiEngine.chat(query, {
                portfolio: portfolioState,
                signals: activeSignals,
                prices: Object.fromEntries(prices.entries())
              });
              output = `AI Response:\n${response}`;
              success = true;
            } catch (error: any) {
              output = `Failed to get AI response: ${error.message}`;
              success = false;
            }
          } else {
            output = 'Usage: ai.ask [query]';
            success = false;
          }
          
        } else {
          output = `Unknown command: ${command}
Type 'help' for available commands`;
          success = false;
        }
        
        logActivity('info', 'Terminal', `Executed: ${command}`);
        sendJson(res, { output, success });
        
      } catch (error: any) {
        logger.error('Terminal command error:', error);
        sendJson(res, { 
          output: `Error: ${error.message}`,
          success: false
        });
      }
      return;
    }

    // Position management endpoints
    if (path === '/api/positions/close' && method === 'POST') {
      const body = await parseBody(req);
      const { symbol } = body;
      
      if (!symbol) {
        sendError(res, 'Symbol required');
        return;
      }

      try {
        const result = await positionManager.closePosition(symbol);
        sendJson(res, result);
        logActivity('info', 'Position', `${symbol} position close: ${result.message}`);
      } catch (error: any) {
        sendJson(res, { success: false, message: error.message }, 500);
      }
      return;
    }

    if (path === '/api/positions/open' && method === 'POST') {
      const body = await parseBody(req);
      const { symbol, side, size, leverage } = body;
      
      if (!symbol || !side || !size || !leverage) {
        sendError(res, 'symbol, side, size, and leverage required');
        return;
      }

      try {
        const result = await positionManager.openPosition(symbol, side, size, leverage);
        sendJson(res, result);
        logActivity('info', 'Position', `Opened ${symbol} ${side} position`);
      } catch (error: any) {
        sendJson(res, { success: false, message: error.message }, 500);
      }
      return;
    }

    if (path === '/api/positions/close-all' && method === 'POST') {
      try {
        const result = await positionManager.closeAllPositions();
        sendJson(res, result);
        logActivity('warning', 'Position', `Emergency close all: ${result.closed} positions closed`);
      } catch (error: any) {
        sendJson(res, { success: false, message: error.message }, 500);
      }
      return;
    }

    if (path === '/api/positions/modify' && method === 'POST') {
      const body = await parseBody(req);
      const { symbol, size, stopLoss, takeProfit } = body;
      
      if (!symbol) {
        sendError(res, 'Symbol required');
        return;
      }

      try {
        const result = await positionManager.modifyPosition({ symbol, action: 'modify', size, stopLoss, takeProfit });
        sendJson(res, result);
        logActivity('info', 'Position', `${symbol} position modified`);
      } catch (error: any) {
        sendJson(res, { success: false, message: error.message }, 500);
      }
      return;
    }

    // Dashboard management endpoints
    if (path === '/api/dashboard/update' && method === 'POST') {
      const body = await parseBody(req);
      
      try {
        const result = await dashboardManager.updateSettings(body);
        sendJson(res, result);
        logActivity('info', 'Dashboard', 'Settings updated');
      } catch (error: any) {
        sendJson(res, { success: false, message: error.message }, 500);
      }
      return;
    }

    if (path === '/api/dashboard/settings' && method === 'GET') {
      try {
        const settings = dashboardManager.getSettings();
        sendJson(res, { settings });
      } catch (error: any) {
        sendJson(res, { error: error.message }, 500);
      }
      return;
    }

    // AI query endpoint for terminal
    if (path === '/api/ai/ask' && method === 'POST') {
      const body = await parseBody(req);
      const { query } = body;
      
      if (!query) {
        sendError(res, 'Query required');
        return;
      }

      try {
        const portfolioState = await exchange.getPortfolioState();
        const activeSignals = signalProcessor.getActiveSignals();
        const prices: Record<string, any> = {};
        realtimeFeed.getAllPrices().forEach((value, key) => {
          prices[key] = value;
        });

        const response = await aiEngine.chat(query, {
          portfolio: portfolioState,
          signals: activeSignals,
          prices: prices
        });

        sendJson(res, { response, success: true });
        logActivity('info', 'AI', `Query: ${query.substring(0, 50)}...`);
      } catch (error: any) {
        logger.error('AI query error:', error);
        sendJson(res, { success: false, message: error.message }, 500);
      }
      return;
    }

    // Assistant function endpoints
    if (path.startsWith('/api/assistant/') && method === 'POST') {
      const assistantPath = path.replace('/api/assistant/', '');
      const body = await parseBody(req);
      
      try {
        let result;
        
        switch (assistantPath) {
          case 'portfolio':
            result = await assistantFunctions.getPortfolio(body.include_history);
            break;
            
          case 'prices':
            result = await assistantFunctions.getPrices(body);
            break;
            
          case 'signals':
            result = await assistantFunctions.getSignals(body);
            break;
            
          case 'analyze_trade':
            result = await assistantFunctions.analyzeTrade(body);
            break;
            
          default:
            sendError(res, 'Assistant function not found', 404);
            return;
        }
        
        if (result.success) {
          sendJson(res, { success: true, data: result.data });
        } else {
          sendJson(res, { success: false, message: result.message }, 500);
        }
        
        logActivity('info', 'Assistant', `Function called: ${assistantPath}`);
        
      } catch (error: any) {
        logger.error('Assistant function error:', error);
        sendJson(res, { success: false, message: error.message }, 500);
      }
      return;
    }

    // 404
    sendError(res, 'Not found', 404);

  } catch (error) {
    logger.error('API error:', error);
    sendError(res, 'Internal server error', 500);
  }
}

// Hamburger Bot Grid Request Handler
async function handleHamburgerGridRequest(
  path: string,
  method: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  try {
    const pathParts = path.split('/').filter(Boolean);
    
    // POST /api/grid/hamburger/create
    if (pathParts[3] === 'create' && method === 'POST') {
      const body = await parseBody(req);
      const gridConfig: HamburgerBotConfig = body.config;
      
      if (!gridConfig || !gridConfig.symbol) {
        sendError(res, 'Invalid grid configuration', 400);
        return;
      }

      // Check if hamburger bot is enabled in config
      if (!config.hamburgerBot?.enabled) {
        sendError(res, 'Hamburger Bot is not enabled', 403);
        return;
      }

      // Create new hamburger bot instance
      const botId = `grid_${gridConfig.symbol}_${Date.now()}`;
      const bot = new HamburgerBot(gridConfig);
      
      // Store the bot
      hamburgerBots.set(botId, bot);
      
      // Get current price
      const ticker = await exchange.getTicker(gridConfig.symbol);
      const currentPrice = ticker.price;
      if (!currentPrice) {
        sendError(res, `Failed to get current price for ${gridConfig.symbol}`, 500);
        return;
      }

      // Initialize the bot
      await bot.initialize(currentPrice);
      
      logActivity('info', 'HamburgerBot', `Created grid bot for ${gridConfig.symbol}`, { botId, config: gridConfig });
      
      sendJson(res, {
        success: true,
        botId,
        config: gridConfig,
        currentPrice,
        state: bot.getState()
      });
      return;
    }

    // POST /api/grid/hamburger/{botId}/start
    if (pathParts[4] === 'start' && method === 'POST') {
      const botId = pathParts[3];
      if (!botId) {
        sendError(res, 'Bot ID required', 400);
        return;
      }
      const bot = hamburgerBots.get(botId);
      
      if (!bot) {
        sendError(res, 'Grid bot not found', 404);
        return;
      }

      await bot.start();
      
      logActivity('info', 'HamburgerBot', `Started grid bot`, { botId });
      
      sendJson(res, {
        success: true,
        botId,
        state: bot.getState()
      });
      return;
    }

    // POST /api/grid/hamburger/{botId}/stop
    if (pathParts[4] === 'stop' && method === 'POST') {
      const botId = pathParts[3];
      if (!botId) {
        sendError(res, 'Bot ID required', 400);
        return;
      }
      const bot = hamburgerBots.get(botId);
      
      if (!bot) {
        sendError(res, 'Grid bot not found', 404);
        return;
      }

      await bot.stop();
      
      logActivity('info', 'HamburgerBot', `Stopped grid bot`, { botId });
      
      sendJson(res, {
        success: true,
        botId,
        state: bot.getState()
      });
      return;
    }

    // GET /api/grid/hamburger/{botId}/status
    if (pathParts[4] === 'status' && method === 'GET') {
      const botId = pathParts[3];
      if (!botId) {
        sendError(res, 'Bot ID required', 400);
        return;
      }
      const bot = hamburgerBots.get(botId);
      
      if (!bot) {
        sendError(res, 'Grid bot not found', 404);
        return;
      }

      sendJson(res, {
        botId,
        state: bot.getState(),
        positions: bot.getPositions(),
        performance: bot.getPerformance()
      });
      return;
    }

    // POST /api/grid/hamburger/{botId}/rebalance
    if (pathParts[4] === 'rebalance' && method === 'POST') {
      const botId = pathParts[3];
      if (!botId) {
        sendError(res, 'Bot ID required', 400);
        return;
      }
      const bot = hamburgerBots.get(botId);
      
      if (!bot) {
        sendError(res, 'Grid bot not found', 404);
        return;
      }

      // Get current price and signals
      const ticker = await exchange.getTicker(bot.getState().config.symbol);
      const currentPrice = ticker.price;
      if (!currentPrice) {
        sendError(res, 'Failed to get current price', 500);
        return;
      }

      // Trigger rebalance
      const state = bot.getState();
      const signals = bot['aiEngine'].calculateSignals([]); // Would need real candle data
      
      await bot['onPriceUpdate'](currentPrice, signals);
      
      logActivity('info', 'HamburgerBot', `Manual rebalance triggered`, { botId, currentPrice });
      
      sendJson(res, {
        success: true,
        botId,
        state: bot.getState()
      });
      return;
    }

    // DELETE /api/grid/hamburger/{botId}
    if (method === 'DELETE' && pathParts.length === 4) {
      const botId = pathParts[3];
      if (!botId) {
        sendError(res, 'Bot ID required', 400);
        return;
      }
      const bot = hamburgerBots.get(botId);
      
      if (!bot) {
        sendError(res, 'Grid bot not found', 404);
        return;
      }

      // Stop and remove bot
      await bot.stop();
      hamburgerBots.delete(botId);
      
      logActivity('info', 'HamburgerBot', `Deleted grid bot`, { botId });
      
      sendJson(res, {
        success: true,
        message: 'Grid bot deleted'
      });
      return;
    }

    // GET /api/grid/hamburger/list
    if (pathParts[3] === 'list' && method === 'GET') {
      const bots = Array.from(hamburgerBots.entries()).map(([id, bot]) => ({
        id,
        symbol: bot.getState().config.symbol,
        isRunning: bot.getState().isRunning,
        positionCount: bot.getPositions().length,
        performance: bot.getPerformance()
      }));
      
      sendJson(res, { bots });
      return;
    }

    sendError(res, 'Endpoint not found', 404);
  } catch (error) {
    logger.error('Hamburger Bot API error:', error);
    sendError(res, `Internal server error: ${error}`, 500);
  }
}

// Handle Backtest API
async function handleBacktestAPI(
  req: http.IncomingMessage, 
  res: http.ServerResponse, 
  method: string | undefined, 
  pathParts: string[]
): Promise<void> {
  try {
    // POST /api/backtest/hamburger/run
    if (pathParts[3] === 'hamburger' && pathParts[4] === 'run' && method === 'POST') {
      const { runHamburgerBacktest } = await import('./backtestEndpoints.js');
      await runHamburgerBacktest(req, res);
      return;
    }

    // GET /api/backtest/symbols
    if (pathParts[3] === 'symbols' && method === 'GET') {
      const { getBacktestSymbols } = await import('./backtestEndpoints.js');
      await getBacktestSymbols(req, res);
      return;
    }

    // GET /api/backtest/history
    if (pathParts[3] === 'history' && method === 'GET') {
      const { getBacktestHistory } = await import('./backtestEndpoints.js');
      await getBacktestHistory(req, res);
      return;
    }

    // GET /api/backtest/optimal-strategies
    if (pathParts[3] === 'optimal-strategies' && method === 'GET') {
      const { getOptimalStrategies } = await import('./getOptimalStrategies.js');
      await getOptimalStrategies(req, res);
      return;
    }

    sendError(res, 'Backtest endpoint not found', 404);
  } catch (error) {
    logger.error('Backtest API error:', error);
    sendError(res, `Internal server error: ${error}`, 500);
  }
}

function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Trading Bot Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { font-size: 2.5rem; margin-bottom: 10px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .status { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
    .card h3 { margin-bottom: 15px; color: #94a3b8; font-size: 0.9rem; text-transform: uppercase; }
    .card .value { font-size: 2rem; font-weight: bold; margin-bottom: 5px; }
    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    .neutral { color: #6b7280; }
    .positions { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 20px; }
    .positions h3 { margin-bottom: 15px; color: #94a3b8; }
    .position { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #334155; }
    .position:last-child { border-bottom: none; }
    .commands { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
    .command-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 15px; }
    .cmd-btn { background: #334155; padding: 12px; border-radius: 8px; border: none; color: #e2e8f0; cursor: pointer; font-size: 0.9rem; }
    .cmd-btn:hover { background: #475569; }
    #output { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 15px; margin-top: 15px; font-family: monospace; max-height: 200px; overflow-y: auto; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AI Trading Bot</h1>
      <p id="status">Loading...</p>
    </div>
    <div class="status">
      <div class="card"><h3>Portfolio Value</h3><div class="value" id="portfolioValue">--</div><div id="pnl">--</div></div>
      <div class="card"><h3>Positions</h3><div class="value" id="posCount">--</div><div id="symbols">--</div></div>
      <div class="card"><h3>Win Rate</h3><div class="value" id="winRate">--</div><div id="trades">--</div></div>
      <div class="card"><h3>Cycle</h3><div class="value" id="cycle">--</div><div id="mode">--</div></div>
    </div>
    <div class="positions"><h3>Active Positions</h3><div id="positionsList">Loading...</div></div>
    <div class="commands">
      <h3>Commands</h3>
      <div class="command-grid">
        <button class="cmd-btn" onclick="runCmd('portfolio.show')">Portfolio</button>
        <button class="cmd-btn" onclick="runCmd('prices.all')">Prices</button>
        <button class="cmd-btn" onclick="runCmd('signals.strong')">Signals</button>
        <button class="cmd-btn" onclick="runCmd('bot.status')">Bot Status</button>
        <button class="cmd-btn" onclick="runCmd('risk.check')">Risk Check</button>
        <button class="cmd-btn" onclick="runCmd('analyze BTC')">Analyze BTC</button>
      </div>
      <div id="output"></div>
    </div>
  </div>
  <script>
    async function update() {
      try {
        const r = await fetch('/api/bot/status');
        const d = await r.json();
        document.getElementById('status').innerHTML = '<span class="positive">Bot Running</span>';
        document.getElementById('portfolioValue').textContent = '$' + d.portfolio.totalValue.toFixed(2);
        document.getElementById('pnl').innerHTML = '<span class="' + (d.portfolio.unrealizedPnl >= 0 ? 'positive' : 'negative') + '">' + (d.portfolio.unrealizedPnl >= 0 ? '+' : '') + '$' + d.portfolio.unrealizedPnl.toFixed(2) + ' unrealized</span>';
        document.getElementById('posCount').textContent = d.portfolio.positions.length;
        document.getElementById('symbols').textContent = d.portfolio.positions.map(p => p.symbol).join(', ');
        document.getElementById('winRate').textContent = (d.performance.winRate * 100).toFixed(0) + '%';
        document.getElementById('trades').textContent = d.performance.totalTrades + ' trades';
        document.getElementById('cycle').textContent = d.cycleCount;
        document.getElementById('mode').textContent = d.mode.toUpperCase() + ' MODE';
        let posHtml = '';
        d.portfolio.positions.forEach(p => {
          const pnlClass = p.unrealizedPnl >= 0 ? 'positive' : 'negative';
          posHtml += '<div class="position"><span><strong>' + p.symbol + '</strong> ' + p.side.toUpperCase() + '</span><span>$' + (p.size * p.currentPrice).toFixed(2) + '</span><span class="' + pnlClass + '">' + (p.unrealizedPnl >= 0 ? '+' : '') + '$' + p.unrealizedPnl.toFixed(2) + ' (' + p.unrealizedPnlPct.toFixed(1) + '%)</span></div>';
        });
        document.getElementById('positionsList').innerHTML = posHtml || 'No positions';
      } catch(e) { document.getElementById('status').innerHTML = '<span class="negative">Bot Offline</span>'; }
    }
    async function runCmd(cmd) {
      const out = document.getElementById('output');
      out.textContent = '> ' + cmd + '\\nExecuting...';
      try {
        const r = await fetch('/api/terminal', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({command: cmd}) });
        const d = await r.json();
        out.textContent = '> ' + cmd + '\\n' + (d.output || d.error || JSON.stringify(d));
      } catch(e) { out.textContent = 'Error: ' + e.message; }
    }
    update(); setInterval(update, 5000);
  </script>
</body>
</html>`;
}

export function startApiServer(port: number = 3001): http.Server {
  const server = http.createServer(handleRequest);
  
  server.listen(port, () => {
    logger.info(`API server running on http://localhost:${port}`);
    logger.info(`Dashboard available at http://localhost:${port}/`);
  });

  // Start terminal WebSocket server on port 3002
  try {
    initTerminalServer(3002);
  } catch (error) {
    logger.error('Failed to start terminal server:', error);
  }

  // Start log stream WebSocket server on port 3003
  try {
    initLogStreamServer(3003);
    // Connect logger to dashboard stream
    connectDashboard(pushLog);
    logger.info('Logger connected to dashboard stream');
  } catch (error) {
    logger.error('Failed to start log stream server:', error);
  }

  return server;
}

export function stopApiServer(): void {
  shutdownTerminalServer();
  shutdownLogStreamServer();
}

export default { startApiServer, stopApiServer, setBotController, setApiKey };
