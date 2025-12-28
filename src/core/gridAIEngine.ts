/**
 * Grid AI Engine - Brain and Risk Manager for Hamburger Bot
 * Makes intelligent rebalancing decisions based on signals and risk
 */

import type { 
  GridState, 
  GridSignals, 
  AIDecision,
  HamburgerBotConfig,
  VirtualLevel 
} from '../types/grid.js'
import { GridAction } from '../types/grid.js'
import { ParabolicSAR, CustomATR, VolumeSpike, ROC } from '../indicators/index.js'
import { logger } from '../utils/logger.js'

export class GridAIEngine {
  private config: HamburgerBotConfig
  private parabolicSAR: ParabolicSAR
  private atr: CustomATR
  private volumeSpike: VolumeSpike
  private roc: ROC

  constructor(config: HamburgerBotConfig) {
    this.config = config
    
    // Initialize indicators with config parameters
    this.parabolicSAR = new ParabolicSAR(
      this.config.ai?.signals?.parabolicSAR?.acceleration || 0.02,
      this.config.ai?.signals?.parabolicSAR?.maximum || 0.2
    )
    
    this.atr = new CustomATR(
      this.config.ai?.signals?.atr?.period || 14
    )
    
    this.volumeSpike = new VolumeSpike(
      this.config.ai?.signals?.volume?.lookback || 20,
      this.config.ai?.signals?.volume?.spikeThreshold || 2.0
    )
    
    this.roc = new ROC(
      this.config.ai?.signals?.roc?.period || 10,
      this.config.ai?.signals?.roc?.panicThreshold || 5.0
    )
  }

  /**
   * Make AI decision based on current state and signals
   */
  async makeDecision(
    state: GridState,
    signals: GridSignals,
    crossedLevels: VirtualLevel[]
  ): Promise<AIDecision> {
    // Build decision context
    const context = this.buildContext(state, signals, crossedLevels)
    
    // Apply decision hierarchy
    const action = this.applyDecisionHierarchy(context)
    
    // Calculate confidence
    const confidence = this.calculateConfidence(action, context)
    
    // Generate reasoning
    const reasoning = this.generateReasoning(action, context)
    
    // Predict expected outcome
    const expectedOutcome = this.predictOutcome(action, context)

    const decision: AIDecision = {
      action,
      confidence,
      reasoning,
      signals,
      timestamp: Date.now(),
      expectedOutcome
    }

    logger.info(`AI Decision: ${action} with ${confidence}% confidence - ${reasoning}`)
    return decision
  }

  /**
   * Calculate signals from price data
   */
  calculateSignals(candles: any[]): GridSignals {
    // Parabolic SAR
    const sarResult = this.parabolicSAR.getLatest(candles)
    
    // ATR
    const atrResult = this.atr.getLatest(candles)
    const atrPercentage = atrResult ? (atrResult / candles[candles.length - 1].close) * 100 : 0
    
    // Volume
    const volumeResult = this.volumeSpike.getLatest(candles)
    
    // ROC
    const rocResult = this.roc.getLatest(candles)

    return {
      parabolicSAR: {
        value: sarResult?.value || 0,
        isUptrend: sarResult?.isUptrend || false
      },
      atr: {
        value: atrResult || 0,
        multiplier: atrPercentage
      },
      volume: {
        current: volumeResult?.current || 0,
        average: volumeResult?.average || 0,
        spikeMultiplier: volumeResult?.spikeMultiplier || 0,
        isSpike: volumeResult?.isSpike || false
      },
      roc: {
        value: rocResult?.percentage || 0,
        panicThreshold: this.config.ai?.signals?.roc?.panicThreshold || 5.0,
        isPanic: rocResult?.isPanic || false
      }
    }
  }

  /**
   * Build decision context from all available information
   */
  private buildContext(
    state: GridState,
    signals: GridSignals,
    crossedLevels: VirtualLevel[]
  ): DecisionContext {
    // Calculate position bias
    const longPositions = state.realPositions.filter(p => p.side === 'long')
    const shortPositions = state.realPositions.filter(p => p.side === 'short')
    const totalExposure = longPositions.reduce((sum, p) => sum + p.sizeUsd, 0) +
                         shortPositions.reduce((sum, p) => sum + p.sizeUsd, 0)
    
    const longExposure = longPositions.reduce((sum, p) => sum + p.sizeUsd, 0)
    const shortExposure = shortPositions.reduce((sum, p) => sum + p.sizeUsd, 0)
    const biasPct = totalExposure > 0 ? Math.abs(longExposure - shortExposure) / totalExposure * 100 : 0

    // Check if outer positions are too far
    const outerPositions = this.getOuterPositions(state.realPositions)
    const maxDistance = this.getMaxPositionDistance(outerPositions, state.currentPrice)

    return {
      state,
      signals,
      crossedLevels,
      positionCount: state.realPositions.length,
      positionBias: biasPct,
      maxPositionDistance: maxDistance,
      trendDirection: signals.parabolicSAR.isUptrend ? 'bullish' : 'bearish',
      volatilityLevel: this.getVolatilityLevel(signals.atr.multiplier),
      isPanicCondition: signals.roc.isPanic || signals.volume.isSpike
    }
  }

  /**
   * Apply decision hierarchy based on signals and context
   */
  private applyDecisionHierarchy(context: DecisionContext): GridAction {
    // 1. ROC panic trigger → Emergency protocol
    if (context.signals.roc.isPanic) {
      if (context.isPanicCondition && context.positionBias > 50) {
        return GridAction.EMERGENCY_REBALANCE
      }
      return GridAction.CLOSE_ALL
    }

    // 2. Strong trend mismatch → Cut bad side
    if (!context.signals.parabolicSAR.isUptrend && context.state.realPositions.some(p => p.side === 'long')) {
      if (context.signals.atr.multiplier > 0.1 || context.positionBias > 30) {
        return GridAction.CUT_LONG
      }
    }

    if (context.signals.parabolicSAR.isUptrend && context.state.realPositions.some(p => p.side === 'short')) {
      if (context.signals.atr.multiplier > 0.1 || context.positionBias > 30) {
        return GridAction.CUT_SHORT
      }
    }

    // 3. Default to hold - grid triggers handle entries
    return GridAction.HOLD
  }

  /**
   * Calculate confidence score for decision
   */
  private calculateConfidence(action: GridAction, context: DecisionContext): number {
    let confidence = 50 // Base confidence

    // Panic conditions increase confidence
    if (context.isPanicCondition) {
      confidence += 30
    }

    // Volume spikes increase confidence
    if (context.signals.volume.isSpike) {
      confidence += 20
    }

    // Strong trend increases confidence
    const signalStrength = this.getSignalStrength(context.signals)
    confidence += signalStrength * 20

    // Adjust for trend direction alignment (confidence boost if action matches trend)
    if ((action === GridAction.CUT_LONG && context.trendDirection === 'bearish') ||
        (action === GridAction.CUT_SHORT && context.trendDirection === 'bullish')) {
      confidence += 15
    }

    // Adjust for aggressiveness
    const aggressivenessMultiplier: Record<string, number> = {
      'low': 0.8,
      'medium': 1.0,
      'high': 1.2
    };
    
    const aggressiveness = this.config.ai?.aggressiveness || 'medium'
    confidence *= aggressivenessMultiplier[aggressiveness] || 1.0

    return Math.min(Math.round(confidence), 100)
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(action: GridAction, context: DecisionContext): string {
    const reasons: string[] = []

    // Panic conditions
    if (context.signals.roc.isPanic) {
      reasons.push(`Panic condition detected (ROC: ${context.signals.roc.value.toFixed(2)}%)`)
    }

    // Volume spikes
    if (context.signals.volume.isSpike) {
      reasons.push(`Volume spike detected (${context.signals.volume.spikeMultiplier.toFixed(1)}x average)`)
    }

    // Trend direction
    if (context.signals.parabolicSAR.isUptrend) {
      reasons.push('Parabolic SAR indicates uptrend')
    } else {
      reasons.push('Parabolic SAR indicates downtrend')
    }

    // Position distance
    const defaultSpacing = this.config.grid?.defaultSpacing || this.config.gridSpacing || 1.0
    if (context.maxPositionDistance > defaultSpacing * 3) {
      reasons.push(`Outer positions too far from price (${context.maxPositionDistance.toFixed(2)}%)`)
    }

    // Virtual level crossings
    if (context.crossedLevels.length > 0) {
      reasons.push(`${context.crossedLevels.length} virtual levels crossed`)
    }

    // Volatility
    if (context.volatilityLevel === 'high') {
      reasons.push('High volatility detected')
    }

    return reasons.join('; ')
  }

  /**
   * Predict expected outcome of the decision
   */
  private predictOutcome(action: GridAction, context: DecisionContext): string {
    switch (action) {
      case GridAction.CUT_LONG:
        return 'Closing underperforming long positions to protect capital during downtrend'
      
      case GridAction.CUT_SHORT:
        return 'Closing underperforming short positions to protect capital during uptrend'
      
      case GridAction.EMERGENCY_REBALANCE:
        return 'Extreme panic detected, aggressively rebalancing to neutral state'
      
      case GridAction.CLOSE_ALL:
        return 'Panic detected, exiting all positions'
      
      case GridAction.HOLD:
        return 'Market conditions within grid parameters, monitoring execution'
      
      default:
        return 'Executing risk management protocol'
    }
  }

  /**
   * Helper methods
   */
  private getOuterPositions(positions: any[]): any[] {
    if (positions.length === 0) return []
    const sorted = [...positions].sort((a, b) => a.entryPrice - b.entryPrice)
    return [sorted[0], sorted[sorted.length - 1]]
  }

  private getMaxPositionDistance(outerPositions: any[], currentPrice: number): number {
    if (outerPositions.length === 0) return 0
    
    const distances = outerPositions.map(p => 
      Math.abs(p.entryPrice - currentPrice) / currentPrice * 100
    )
    
    return Math.max(...distances)
  }

  private getVolatilityLevel(atrMultiplier: number): 'low' | 'medium' | 'high' {
    if (atrMultiplier < 1) return 'low'
    if (atrMultiplier < 2.5) return 'medium'
    return 'high'
  }

  private getSignalStrength(signals: GridSignals): number {
    let strength = 0
    
    // SAR strength
    if (signals.parabolicSAR.isUptrend) strength += 0.25
    else strength += 0.25
    
    // Volume strength
    if (signals.volume.isSpike) strength += 0.3
    
    // ROC strength
    if (signals.roc.isPanic) strength += 0.45
    
    return Math.min(strength, 1)
  }
}

interface DecisionContext {
  state: GridState
  signals: GridSignals
  crossedLevels: VirtualLevel[]
  positionCount: number
  positionBias: number
  maxPositionDistance: number
  trendDirection: 'bullish' | 'bearish'
  volatilityLevel: 'low' | 'medium' | 'high'
  isPanicCondition: boolean
}
