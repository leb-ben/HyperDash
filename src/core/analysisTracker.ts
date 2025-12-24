import { logger } from '../utils/logger.js';

interface AnalysisStep {
  id: string;
  timestamp: number;
  phase: 'data_collection' | 'technical_analysis' | 'ai_reasoning' | 'risk_check' | 'execution' | 'complete';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  title: string;
  details: string;
  data?: any;
}

interface LiveAnalysis {
  cycleId: string;
  startTime: number;
  endTime?: number;
  steps: AnalysisStep[];
  decision?: {
    action: 'buy' | 'sell' | 'hold';
    symbol?: string;
    confidence: number;
    reasoning: string;
  };
}

class AnalysisTracker {
  private currentAnalysis: LiveAnalysis | null = null;
  private recentAnalyses: LiveAnalysis[] = [];
  private readonly MAX_RECENT = 10;

  startCycle(cycleId: string): void {
    this.currentAnalysis = {
      cycleId,
      startTime: Date.now(),
      steps: []
    };
    logger.info(`[AnalysisTracker] Started cycle ${cycleId}`);
  }

  addStep(
    phase: AnalysisStep['phase'],
    title: string,
    details: string,
    data?: any
  ): void {
    if (!this.currentAnalysis) return;

    const step: AnalysisStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      phase,
      status: 'in_progress',
      title,
      details,
      data
    };

    this.currentAnalysis.steps.push(step);
  }

  completeStep(title: string, success: boolean = true): void {
    if (!this.currentAnalysis) return;

    const step = this.currentAnalysis.steps.find(s => s.title === title);
    if (step) {
      step.status = success ? 'completed' : 'failed';
    }
  }

  setDecision(
    action: 'buy' | 'sell' | 'hold',
    symbol: string | undefined,
    confidence: number,
    reasoning: string
  ): void {
    if (!this.currentAnalysis) return;

    this.currentAnalysis.decision = {
      action,
      symbol,
      confidence,
      reasoning
    };
  }

  endCycle(): void {
    if (!this.currentAnalysis) return;

    this.currentAnalysis.endTime = Date.now();
    
    // Mark all remaining steps as completed
    this.currentAnalysis.steps.forEach(step => {
      if (step.status === 'in_progress') {
        step.status = 'completed';
      }
    });

    // Add to recent analyses
    this.recentAnalyses.unshift(this.currentAnalysis);
    if (this.recentAnalyses.length > this.MAX_RECENT) {
      this.recentAnalyses.pop();
    }

    logger.info(`[AnalysisTracker] Ended cycle ${this.currentAnalysis.cycleId}`);
    this.currentAnalysis = null;
  }

  getCurrentAnalysis(): LiveAnalysis | null {
    return this.currentAnalysis;
  }

  getRecentAnalyses(): LiveAnalysis[] {
    return this.recentAnalyses;
  }

  clear(): void {
    this.currentAnalysis = null;
    this.recentAnalyses = [];
  }
}

export const analysisTracker = new AnalysisTracker();
