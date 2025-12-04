import { Radio } from 'lucide-react'

interface Signal {
  id: string
  symbol: string
  type: string
  direction: string
  strength: number
  urgency: number
  price: number
  timestamp: number
}

interface Props {
  signals: Signal[]
}

export function ActiveSignals({ signals }: Props) {
  const getSignalColor = (direction: string) => {
    if (direction === 'LONG') return 'text-green-400 bg-green-500/20'
    if (direction === 'SHORT') return 'text-red-400 bg-red-500/20'
    return 'text-slate-400 bg-slate-500/20'
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-3">
        <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
        <span className="text-sm font-semibold">Active Signals</span>
        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full ml-auto">
          {signals?.length || 0} active
        </span>
      </div>
      {(signals?.length || 0) === 0 ? (
        <div className="text-slate-500 text-sm text-center py-4">No active signals - waiting for opportunities...</div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-auto">
          {signals.slice(0, 10).map((sig) => (
            <div key={sig.id} className="flex items-center justify-between bg-slate-700/30 rounded-lg p-2">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm">{sig.symbol}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${getSignalColor(sig.direction)}`}>
                  {sig.direction}
                </span>
                <span className="text-xs text-slate-400">{sig.type?.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 bg-slate-600 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${sig.direction === 'LONG' ? 'bg-green-500' : sig.direction === 'SHORT' ? 'bg-red-500' : 'bg-slate-400'}`}
                    style={{ width: `${sig.strength}%` }} />
                </div>
                <span className="text-xs text-slate-400 w-8">{sig.strength}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ActiveSignals
