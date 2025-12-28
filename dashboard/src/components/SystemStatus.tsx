interface SystemState {
  bot: { running: boolean; cycleCount: number; lastCycleTime: number; mode: string }
  portfolio: { totalValue: number; availableBalance: number }
  signals: { stats: { totalSignals: number; activeSignals: number } }
  executor: { totalExecutions: number; successfulExecutions: number; totalFees: number }
  safety: { globalStopLossEnabled: boolean; stopLossPercentage: number; isKilled: boolean }
  errors: { total: number }
  ai?: { 
    emergencyBrake?: boolean;
    reactiveMode?: boolean;
    dynamicPositionSizing?: boolean;
    model?: string;
  }
}

interface Props {
  system: SystemState
}

export function SystemStatus({ system }: Props) {
  const formatCurrency = (value: number) => `$${value?.toFixed(2) || '0.00'}`

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="text-sm font-semibold mb-3">System Status</div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Mode</span>
            <span className={system.bot.mode === 'paper' ? 'text-yellow-400' : 'text-green-400'}>
              {system.bot.mode?.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Total Signals</span>
            <span>{system.signals?.stats?.totalSignals || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Executions</span>
            <span>{system.executor?.successfulExecutions || 0}/{system.executor?.totalExecutions || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Fees Paid</span>
            <span>{formatCurrency(system.executor?.totalFees || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Errors</span>
            <span className={system.errors?.total > 0 ? 'text-red-400' : 'text-green-400'}>{system.errors?.total || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Stop Loss</span>
            <span className={system.safety?.globalStopLossEnabled ? 'text-green-400' : 'text-slate-500'}>
              {system.safety?.globalStopLossEnabled ? `${system.safety.stopLossPercentage}%` : 'OFF'}
            </span>
          </div>
        </div>
      </div>

      {/* AI Features Info */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="text-sm font-semibold mb-3">AI Features</div>
        <div className="space-y-3">
          {/* Emergency Brake */}
          <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-red-400">Emergency Brake</span>
              <span className={`text-xs px-2 py-0.5 rounded ${system.ai?.emergencyBrake ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
                {system.ai?.emergencyBrake ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>
            <p className="text-xs text-red-300/70">
              AI monitors for extreme market conditions and can automatically halt trading to protect capital.
            </p>
          </div>

          {/* Reactive Mode */}
          <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-blue-400">Reactive Mode</span>
              <span className={`text-xs px-2 py-0.5 rounded ${system.ai?.reactiveMode ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>
                {system.ai?.reactiveMode ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-xs text-blue-300/70">
              AI dynamically adjusts positions based on market movements with configurable lookback periods.
            </p>
          </div>

          {/* Dynamic Position Sizing */}
          <div className="bg-green-900/10 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-green-400">Dynamic Position Sizing</span>
              <span className={`text-xs px-2 py-0.5 rounded ${system.ai?.dynamicPositionSizing ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                {system.ai?.dynamicPositionSizing ? 'ACTIVE' : 'FIXED'}
              </span>
            </div>
            <p className="text-xs text-green-300/70">
              Position sizes automatically adjust based on volatility and AI confidence levels.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SystemStatus
