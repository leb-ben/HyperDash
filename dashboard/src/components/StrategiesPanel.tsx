import { useState, useEffect } from 'react';
import { Layers, Play, Pause, Settings, TrendingUp, TrendingDown, Grid, Zap } from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  description: string;
  type: 'grid' | 'momentum' | 'mean_reversion' | 'ai_driven';
  enabled: boolean;
  parameters: Record<string, any>;
}

const AVAILABLE_STRATEGIES: Strategy[] = [
  {
    id: 'ai_signals',
    name: 'AI Signal Trading',
    description: 'Uses AI analysis to identify entry/exit signals based on market conditions',
    type: 'ai_driven',
    enabled: true,
    parameters: {
      minConfidence: 65,
      maxPositions: 3,
      positionSizePct: 10,
    },
  },
  {
    id: 'virtual_grid',
    name: 'Virtual Grid Bot',
    description: 'Places virtual grid orders around a center price, only executing the most profitable',
    type: 'grid',
    enabled: false,
    parameters: {
      gridCount: 20,
      gridSpacingPct: 1.0,
      maxRealPositions: 2,
    },
  },
  {
    id: 'momentum',
    name: 'Momentum Trading',
    description: 'Follows strong price movements and trends with trailing stops',
    type: 'momentum',
    enabled: false,
    parameters: {
      lookbackPeriod: 14,
      momentumThreshold: 2.5,
      trailingStopPct: 3,
    },
  },
  {
    id: 'mean_reversion',
    name: 'Mean Reversion',
    description: 'Trades reversals when price deviates significantly from moving averages',
    type: 'mean_reversion',
    enabled: false,
    parameters: {
      maPeriod: 20,
      deviationThreshold: 2.0,
      takeProfitPct: 2,
    },
  },
];

export default function StrategiesPanel() {
  const [strategies, setStrategies] = useState<Strategy[]>(() => {
    const saved = localStorage.getItem('trading_strategies');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return AVAILABLE_STRATEGIES;
      }
    }
    return AVAILABLE_STRATEGIES;
  });
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('trading_strategies', JSON.stringify(strategies));
  }, [strategies]);

  const toggleStrategy = (id: string) => {
    setStrategies(strategies.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
  };

  const getStrategyIcon = (type: Strategy['type']) => {
    switch (type) {
      case 'grid': return <Grid className="w-5 h-5" />;
      case 'momentum': return <TrendingUp className="w-5 h-5" />;
      case 'mean_reversion': return <TrendingDown className="w-5 h-5" />;
      case 'ai_driven': return <Zap className="w-5 h-5" />;
    }
  };

  const getStrategyColor = (type: Strategy['type']) => {
    switch (type) {
      case 'grid': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'momentum': return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'mean_reversion': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'ai_driven': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    }
  };

  const selected = strategies.find(s => s.id === selectedStrategy);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-5 h-5 text-cyan-400" />
        <h2 className="text-lg font-semibold">Trading Strategies</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {strategies.map((strategy) => (
          <div
            key={strategy.id}
            className={`rounded-xl border p-4 cursor-pointer transition-all ${
              selectedStrategy === strategy.id
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600'
            }`}
            onClick={() => setSelectedStrategy(strategy.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${getStrategyColor(strategy.type)}`}>
                {getStrategyIcon(strategy.type)}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStrategy(strategy.id);
                }}
                className={`p-2 rounded-lg transition-colors ${
                  strategy.enabled
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {strategy.enabled ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            </div>
            <h3 className="font-semibold mb-1">{strategy.name}</h3>
            <p className="text-xs text-slate-400 line-clamp-2">{strategy.description}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded ${
                strategy.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500'
              }`}>
                {strategy.enabled ? 'Active' : 'Inactive'}
              </span>
              <span className="text-xs text-slate-500 capitalize">{strategy.type.replace('_', ' ')}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Strategy Details Panel */}
      {selected && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              {selected.name} Parameters
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(selected.parameters).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-slate-400 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => {
                    setStrategies(strategies.map(s =>
                      s.id === selected.id
                        ? { ...s, parameters: { ...s.parameters, [key]: Number(e.target.value) } }
                        : s
                    ));
                  }}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-xs text-slate-400">
              {selected.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
