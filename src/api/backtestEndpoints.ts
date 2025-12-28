/**
 * Backtest API Endpoints
 * Handles backtest requests for the Hamburger Bot
 */

import { FastBacktestEngine } from '../backtesting/fastBacktestEngine.js'
import { HamburgerBotConfig, getLeverageLimit } from '../types/grid.js'
import { logger } from '../utils/logger.js'
import { getStrategyPersistence } from '../persistence/strategyPersistence.js'
import type { IncomingMessage, ServerResponse } from 'http'

/**
 * Run a backtest for the Hamburger Bot
 */
export async function runHamburgerBacktest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await new Promise<any>((resolve) => {
      let data = ''
      req.on('data', chunk => data += chunk)
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {})
        } catch {
          resolve({})
        }
      })
    })

    const { symbols, startTime, endTime, config, isBulkload, numTests } = body

    // Validate inputs
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0 || !startTime || !endTime || !config) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing or invalid required parameters' }))
      return
    }

    // Validate date range (max 6 months / 180 days)
    const daysDiff = (endTime - startTime) / (1000 * 60 * 60 * 24)
    if (daysDiff > 180) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Backtest period cannot exceed 6 months (180 days)' }))
      return
    }

    if (isBulkload) {
      logger.info(`Running bulkload of ${numTests} tests for symbols: ${symbols.join(', ')}`)
      const results = []
      const seenConfigs = new Set<string>()
      const persistence = getStrategyPersistence()
      
      // options array no longer needed - aggressiveness removed

      for (let i = 0; i < (numTests || 1); i++) {
        let attempts = 0
        const maxAttempts = 50
        let s = symbols[Math.floor(Math.random() * symbols.length)]
        let gridSpacing = config.gridSpacing || 1.0
        let confidenceThreshold = config.confidenceThreshold || 70
        let activeCapitalPct = config.activeCapitalPct || 50
        let targetMarginUtilization = config.targetMarginUtilization || 50
        // Remove aggressiveness variable - no longer needed
        let leverage = Math.min(config.leverage || 4, getLeverageLimit(s))

        // Keep trying to find a unique config
        while (attempts < maxAttempts) {
          s = symbols[Math.floor(Math.random() * symbols.length)]
          const symbolLimit = getLeverageLimit(s)
          
          gridSpacing = config.randomizeGridSpacing 
            ? Number((Math.random() * (config.gridSpacingMax - config.gridSpacingMin) + config.gridSpacingMin).toFixed(2))
            : (config.gridSpacing || 1.0)
            
          confidenceThreshold = config.randomizeConfidence
            ? Math.floor(Math.random() * (config.confidenceMax - config.confidenceMin + 1)) + config.confidenceMin
            : (config.confidenceThreshold || 70)
            
          activeCapitalPct = config.randomizeActiveCapital
            ? Math.floor(Math.random() * (config.activeCapitalMax - config.activeCapitalMin + 1)) + config.activeCapitalMin
            : (config.activeCapitalPct || 50)
            
          targetMarginUtilization = config.randomizeTargetMargin
            ? Math.floor(Math.random() * (config.targetMarginUtilizationMax - config.targetMarginUtilizationMin + 1)) + config.targetMarginUtilizationMin
            : (config.targetMarginUtilization || 50)
            
          // aggressiveness deprecated - no longer used

          const leverageLimit = Math.min(config.leverageMax || symbolLimit, symbolLimit)
          const leverageMinReq = Math.min(config.leverageMin || 1, leverageLimit)
          
          leverage = config.randomizeLeverage
            ? Math.floor(Math.random() * (leverageLimit - leverageMinReq + 1)) + leverageMinReq
            : Math.min(config.leverage || 4, symbolLimit)

          const configKey = `${s}-${gridSpacing}-${confidenceThreshold}-${activeCapitalPct}-${targetMarginUtilization}-${leverage}`
          if (!seenConfigs.has(configKey)) {
            seenConfigs.add(configKey)
            break
          }
          attempts++
        }

        if (attempts >= maxAttempts) {
          logger.warn(`Could not find a unique configuration for bulk test ${i+1} after ${maxAttempts} attempts. Skipping.`)
          continue
        }
        
        const totalInvestment = config.totalInvestmentUsd || 1000
        const activeCapitalUsd = totalInvestment * (activeCapitalPct / 100)
        const posSizeUsd = activeCapitalUsd * (config.positionSize / 100)
        
        if (posSizeUsd < 10) {
          logger.warn(`Skipping bulk test ${i+1}: Position size $${posSizeUsd.toFixed(2)} is less than $10`)
          continue
        }

        const fullConfig: HamburgerBotConfig = {
          id: `bulk-${Date.now()}-${i}`,
          symbol: s,
          enabled: true,
          totalInvestmentUsd: totalInvestment,
          leverage: leverage,
          positionType: 'percentage',
          positionSize: config.positionSize || 25,
          gridSpacing: gridSpacing,
          gridSpacingType: 'percentage',
          minPositions: 2,
          maxPositions: 4,
          maxActivePositions: config.maxActivePositions || 1,
          stopLossPct: 2.0,
          takeProfitPct: 4.0,
          rebalanceThresholdPct: 0.5,
          maxCapitalUtilization: activeCapitalPct,
          maxPositionBiasPct: 60,
          activeCapitalPct: activeCapitalPct, // Add this property
          targetMarginUtilization: targetMarginUtilization,
          useTrendFilter: config.useTrendFilter !== undefined ? config.useTrendFilter : true,
          useReversalConfirmation: true,
          useTrailingStop: true,
          minVolumeMultiplier: 1.1,
          useAdaptiveGrid: true,
          atrMultiplier: 2.5,
          useDynamicSLTP: true,
          tpAtrMultiplier: 4.0,
          slAtrMultiplier: 2.0,
          useBreakEvenStop: true,
          breakEvenThresholdPct: 25,
          exitOnTrendFlip: true,
          useRSIFilter: false,
          rsiUpperThreshold: 70,
          rsiLowerThreshold: 30,
          useMACDFilter: false,
          useReactiveMode: true,
          reactionLookback: 12,
          reactionThreshold: 0.15,
          // aiAggressiveness deprecated
          aiConfidenceThreshold: confidenceThreshold,
          ai: {
            // aggressiveness deprecated
            confidenceThreshold: confidenceThreshold,
            signals: {
              parabolicSAR: { acceleration: 0.02, maximum: 0.2 },
              atr: { period: 14, multiplier: 2 },
              volume: { spikeThreshold: 2.0, lookback: 20 },
              roc: { period: 10, panicThreshold: 5.0 }
            }
          },
          grid: { defaultSpacing: gridSpacing }
        }

        const engine = new FastBacktestEngine(fullConfig)
        try {
          await engine.loadData(s, startTime, endTime)
          const res = await engine.runBacktest()
          results.push({
            symbol: s,
            metrics: res.metrics,
            config: { gridSpacing, confidenceThreshold, activeCapitalPct, targetMarginUtilization, leverage },
            success: true
          })
        } catch (e: any) {
          results.push({ symbol: s, success: false, error: e.message })
        }
      }

      // Save most profitable strategies per symbol
      const successfulResults = results.filter(r => r.success)
      const bestStrategies = new Map<string, any>()
      
      for (const result of successfulResults) {
        const currentBest = bestStrategies.get(result.symbol)
        if (!currentBest || (result.metrics?.totalReturnPct || 0) > (currentBest.metrics?.totalReturnPct || 0)) {
          bestStrategies.set(result.symbol, result)
        }
      }

      logger.info(`Found ${bestStrategies.size} best strategies from ${successfulResults.length} successful backtests`)

      // Save to persistence
      for (const [symbol, result] of bestStrategies) {
        const metrics = {
          totalReturnPct: result.metrics.totalReturnPct,
          totalReturnUsd: result.metrics.totalReturnUsd || 0,
          winRate: result.metrics.winRate || 0,
          maxDrawdown: result.metrics.maxDrawdown || 0,
          sharpeRatio: result.metrics.sharpeRatio || 0,
          totalTrades: result.metrics.totalTrades || 0
        }

        const strategyConfig: HamburgerBotConfig = {
          id: `optimal-${symbol}`,
          symbol,
          enabled: true,
          totalInvestmentUsd: config.totalInvestmentUsd || 1000,
          leverage: result.config.leverage,
          positionType: 'percentage',
          positionSize: config.positionSize || 25,
          gridSpacing: result.config.gridSpacing,
          gridSpacingType: 'percentage',
          minPositions: 2,
          maxPositions: 4,
          maxActivePositions: config.maxActivePositions || 1,
          stopLossPct: 2.0,
          takeProfitPct: 4.0,
          rebalanceThresholdPct: 0.5,
          maxCapitalUtilization: result.config.activeCapitalPct,
          maxPositionBiasPct: 60,
          activeCapitalPct: result.config.activeCapitalPct, // Add this property
          targetMarginUtilization: result.config.targetMarginUtilization || 50,
          useTrendFilter: config.useTrendFilter !== undefined ? config.useTrendFilter : true,
          useReversalConfirmation: true,
          useTrailingStop: true,
          minVolumeMultiplier: 1.1,
          useAdaptiveGrid: true,
          atrMultiplier: 2.5,
          useDynamicSLTP: true,
          tpAtrMultiplier: 4.0,
          slAtrMultiplier: 2.0,
          useBreakEvenStop: true,
          breakEvenThresholdPct: 25,
          exitOnTrendFlip: true,
          useRSIFilter: false,
          rsiUpperThreshold: 70,
          rsiLowerThreshold: 30,
          useMACDFilter: false,
          useReactiveMode: true,
          reactionLookback: 12,
          reactionThreshold: 0.15,
          // aiAggressiveness deprecated
          aiConfidenceThreshold: result.config.confidenceThreshold,
          ai: {
            // aggressiveness deprecated
            confidenceThreshold: result.config.confidenceThreshold,
            signals: {
              parabolicSAR: { acceleration: 0.02, maximum: 0.2 },
              atr: { period: 14, multiplier: 2 },
              volume: { spikeThreshold: 2.0, lookback: 20 },
              roc: { period: 10, panicThreshold: 5.0 }
            }
          },
          grid: { defaultSpacing: result.config.gridSpacing }
        }

        // Use the end date of the backtest period as the date
        const backtestDate = new Date(endTime).toISOString().split('T')[0]
        // Calculate duration in hours
        const backtestDurationHours = Math.ceil((endTime - startTime) / (1000 * 60 * 60))
        
        const saved = persistence.saveIfMoreProfitable(symbol, strategyConfig, metrics, backtestDate, backtestDurationHours)
        if (saved) {
          const normalizedReturn = metrics.totalReturnPct / backtestDurationHours * 24
          logger.info(`Saved new optimal strategy for ${symbol} with ${(metrics.totalReturnPct || 0).toFixed(2)}% return (${normalizedReturn.toFixed(2)}% normalized to 24h)`)
        } else {
          logger.info(`Strategy for ${symbol} (${(metrics.totalReturnPct || 0).toFixed(2)}%) did not beat existing best`)
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data: results }))
      return
    }

    const results = []
    for (const s of symbols) {
      const symbolLimit = getLeverageLimit(s)
      const leverage = Math.min(config.leverage || 4, symbolLimit)
      const totalInvestment = config.totalInvestmentUsd || 1000
      const activeCapitalPct = config.activeCapitalPct || 50
      const activeCapitalUsd = totalInvestment * (activeCapitalPct / 100)
      const posSizeUsd = activeCapitalUsd * (config.positionSize / 100)
      
      if (posSizeUsd < 10) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Position size ($${posSizeUsd.toFixed(2)}) for ${s} must be at least $10. Increase capital or position percentage.` }))
        return
      }

      const fullConfig: HamburgerBotConfig = {
        id: `backtest-${s}-${Date.now()}`,
        symbol: s,
        enabled: true,
        totalInvestmentUsd: totalInvestment,
        leverage: leverage,
        positionType: 'percentage',
        positionSize: config.positionSize || 25,
        gridSpacing: config.gridSpacing || 1.0,
        gridSpacingType: 'percentage',
        minPositions: 2,
        maxPositions: 4,
        maxActivePositions: config.maxActivePositions || 1,
        stopLossPct: 2.0,
        takeProfitPct: 4.0,
        rebalanceThresholdPct: 0.5,
        maxCapitalUtilization: activeCapitalPct,
        maxPositionBiasPct: 60,
        activeCapitalPct: activeCapitalPct, // Add this property
        targetMarginUtilization: config.targetMarginUtilization || 50,
        useTrendFilter: config.useTrendFilter !== undefined ? config.useTrendFilter : true,
        useReversalConfirmation: true,
        useTrailingStop: true,
        minVolumeMultiplier: 1.1,
        useAdaptiveGrid: true,
        atrMultiplier: 2.5,
        useDynamicSLTP: true,
        tpAtrMultiplier: 4.0,
        slAtrMultiplier: 2.0,
        useBreakEvenStop: true,
        breakEvenThresholdPct: 25,
        exitOnTrendFlip: true,
        useRSIFilter: false,
        rsiUpperThreshold: 70,
        rsiLowerThreshold: 30,
        useMACDFilter: false,
        useReactiveMode: true,
        reactionLookback: 12,
        reactionThreshold: 0.15,
        // aiAggressiveness deprecated
        aiConfidenceThreshold: config.aiConfidenceThreshold || 70,
        ai: {
          // aggressiveness deprecated
          confidenceThreshold: config.aiConfidenceThreshold || 70,
          signals: {
            parabolicSAR: { acceleration: 0.02, maximum: 0.2 },
            atr: { period: 14, multiplier: 2 },
            volume: { spikeThreshold: 2.0, lookback: 20 },
            roc: { period: 10, panicThreshold: 5.0 }
          }
        },
        grid: { defaultSpacing: config.gridSpacing || 1.0 }
      }

      const engine = new FastBacktestEngine(fullConfig)
      try {
        await engine.loadData(s, startTime, endTime)
        const res = await engine.runBacktest()
          results.push({
            symbol: s,
            metrics: res.metrics,
            trades: res.trades,
            equityCurve: res.equityCurve,
            decisions: res.decisions,
            dailyReports: res.dailyReports,
            optimizationTests: res.optimizationTests,
            finalConfig: res.finalConfig,
            config: fullConfig,
            period: { symbol: s, startTime, endTime, candlesProcessed: engine['data']?.length || 0 },
            success: true
          });
      } catch (e: any) {
        results.push({ symbol: s, success: false, error: e.message });
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: symbols.length === 1 ? results[0] : results }));
    
    if (symbols.length === 1 && results[0]?.success) {
      const r = results[0] as any;
      logger.info(`Backtest completed for ${symbols[0]}: ${r.metrics.totalReturnPct.toFixed(2)}% return`);
    } else {
      logger.info(`Batch backtest completed for ${symbols.length} symbols`);
    }
    
  } catch (error) {
    logger.error('Backtest error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }));
  }
}

/**
 * Get available symbols for backtesting
 */
export async function getBacktestSymbols(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    // Focus on major players with proven liquidity and price action
    const symbols = [
      // Tier 1 - Highest liquidity, most reliable
      { name: 'BTC', maxLeverage: 40, category: 'Tier 1' },
      { name: 'ETH', maxLeverage: 40, category: 'Tier 1' },
      { name: 'SOL', maxLeverage: 40, category: 'Tier 1' },
      
      // Tier 2 - Good liquidity, secondary choices
      { name: 'DOGE', maxLeverage: 20, category: 'Tier 2' },
      { name: 'SUI', maxLeverage: 20, category: 'Tier 2' },
      { name: 'LINK', maxLeverage: 20, category: 'Tier 2' },
      { name: 'AVAX', maxLeverage: 20, category: 'Tier 2' },
      { name: 'HYPE', maxLeverage: 20, category: 'Tier 2' },
      { name: 'TIA', maxLeverage: 20, category: 'Tier 2' },
      { name: 'APT', maxLeverage: 20, category: 'Tier 2' },
      { name: 'NEAR', maxLeverage: 20, category: 'Tier 2' },
      
      // Tier 3 - Lower liquidity, avoid for initial testing
      { name: 'OP', maxLeverage: 10, category: 'Tier 3' },
      { name: 'WLD', maxLeverage: 10, category: 'Tier 3' },
      { name: 'LTC', maxLeverage: 10, category: 'Tier 3' },
      { name: 'USDC', maxLeverage: 3, category: 'Stablecoins' },
      { name: 'USDT', maxLeverage: 3, category: 'Stablecoins' }
    ]
    
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true, data: symbols }))
  } catch (error) {
    logger.error('Failed to get symbols:', error)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Failed to fetch symbols' }))
  }
}

/**
 * Get backtest history (if implemented with database)
 */
export async function getBacktestHistory(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    // TODO: Implement database storage for backtest history
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ 
      success: true, 
      data: [],
      message: 'Backtest history not implemented yet' 
    }))
  } catch (error) {
    logger.error('Failed to get backtest history:', error)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Failed to fetch history' }))
  }
}
