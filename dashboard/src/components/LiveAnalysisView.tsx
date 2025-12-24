import { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock, Activity } from 'lucide-react';

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

export default function LiveAnalysisView() {
  const [currentAnalysis, setCurrentAnalysis] = useState<LiveAnalysis | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<LiveAnalysis[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    fetchCurrentAnalysis();
    const interval = setInterval(fetchCurrentAnalysis, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchCurrentAnalysis = async () => {
    try {
      const response = await fetch('/api/analysis/live');
      const data = await response.json();
      if (data.current) {
        setCurrentAnalysis(data.current);
      }
      if (data.recent) {
        setRecentAnalyses(data.recent.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to fetch analysis:', error);
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'data_collection': return <Activity className="w-4 h-4" />;
      case 'technical_analysis': return <TrendingUp className="w-4 h-4" />;
      case 'ai_reasoning': return <Brain className="w-4 h-4" />;
      case 'risk_check': return <AlertCircle className="w-4 h-4" />;
      case 'execution': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'in_progress': return 'text-blue-400 animate-pulse';
      case 'failed': return 'text-red-400';
      default: return 'text-slate-500';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (start: number, end?: number) => {
    const duration = (end || Date.now()) - start;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-4">
      {currentAnalysis ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Brain className="w-5 h-5 text-blue-400 animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold">Live Analysis in Progress</h3>
                <p className="text-xs text-slate-400">
                  Cycle {currentAnalysis.cycleId} - Started {formatTime(currentAnalysis.startTime)}
                </p>
              </div>
            </div>
            <div className="text-sm text-slate-400">
              {formatDuration(currentAnalysis.startTime, currentAnalysis.endTime)}
            </div>
          </div>

          <div className="space-y-3">
            {currentAnalysis.steps.map((step, idx) => (
              <div key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`p-2 rounded-lg ${
                    step.status === 'completed' ? 'bg-green-500/20' :
                    step.status === 'in_progress' ? 'bg-blue-500/20' :
                    step.status === 'failed' ? 'bg-red-500/20' :
                    'bg-slate-700/50'
                  }`}>
                    <div className={getStatusColor(step.status)}>
                      {getPhaseIcon(step.phase)}
                    </div>
                  </div>
                  {idx < currentAnalysis.steps.length - 1 && (
                    <div className={`w-0.5 flex-1 mt-2 ${
                      step.status === 'completed' ? 'bg-green-500/30' : 'bg-slate-700'
                    }`} style={{ minHeight: '20px' }} />
                  )}
                </div>

                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{step.title}</span>
                    <span className="text-xs text-slate-500">{formatTime(step.timestamp)}</span>
                  </div>
                  <p className="text-sm text-slate-400">{step.details}</p>
                  
                  {step.data && (
                    <div className="mt-2 p-2 bg-slate-700/30 rounded text-xs font-mono">
                      <pre className="whitespace-pre-wrap text-slate-300">
                        {JSON.stringify(step.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {currentAnalysis.decision && (
            <div className={`mt-4 p-4 rounded-lg border-2 ${
              currentAnalysis.decision.action === 'buy' ? 'bg-green-500/10 border-green-500/50' :
              currentAnalysis.decision.action === 'sell' ? 'bg-red-500/10 border-red-500/50' :
              'bg-slate-700/30 border-slate-600'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {currentAnalysis.decision.action === 'buy' ? (
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  ) : currentAnalysis.decision.action === 'sell' ? (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-slate-400" />
                  )}
                  <span className="font-bold text-lg uppercase">
                    {currentAnalysis.decision.action}
                    {currentAnalysis.decision.symbol && ` ${currentAnalysis.decision.symbol}`}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-slate-400">Confidence: </span>
                  <span className={`font-bold ${
                    currentAnalysis.decision.confidence >= 70 ? 'text-green-400' :
                    currentAnalysis.decision.confidence >= 50 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {currentAnalysis.decision.confidence}%
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-300">{currentAnalysis.decision.reasoning}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8 text-center">
          <Brain className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Waiting for next analysis cycle...</p>
        </div>
      )}

      {recentAnalyses.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <h3 className="font-semibold mb-3">Recent Analyses</h3>
          <div className="space-y-2">
            {recentAnalyses.map((analysis) => (
              <div key={analysis.cycleId} className="p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded ${
                      analysis.decision?.action === 'buy' ? 'bg-green-500/20' :
                      analysis.decision?.action === 'sell' ? 'bg-red-500/20' :
                      'bg-slate-600/50'
                    }`}>
                      {analysis.decision?.action === 'buy' ? (
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      ) : analysis.decision?.action === 'sell' ? (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">
                        {analysis.decision?.action.toUpperCase() || 'HOLD'}
                        {analysis.decision?.symbol && ` ${analysis.decision.symbol}`}
                      </div>
                      <div className="text-xs text-slate-400">
                        {formatTime(analysis.startTime)} - {formatDuration(analysis.startTime, analysis.endTime)}
                      </div>
                    </div>
                  </div>
                  {analysis.decision && (
                    <div className="text-sm text-slate-400">
                      {analysis.decision.confidence}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded"
          />
          Auto-scroll to latest
        </label>
        <span>Updates every 2 seconds</span>
      </div>
    </div>
  );
}
