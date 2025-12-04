interface SystemState {
  bot: { running: boolean; cycleCount: number; lastCycleTime: number; mode: string }
  portfolio: { totalValue: number; availableBalance: number }
  signals: { stats: { totalSignals: number; activeSignals: number } }
  executor: { totalExecutions: number; successfulExecutions: number; totalFees: number }
  safety: { globalStopLossEnabled: boolean; stopLossPercentage: number; isKilled: boolean }
  errors: { total: number }
}

interface Props {
  system: SystemState
}

export function SystemStatus({ system }: Props) {
  const formatCurrency = (value: number) => `$${value?.toFixed(2) || '0.00'}`

  return (
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
  )
}

export default SystemStatus
