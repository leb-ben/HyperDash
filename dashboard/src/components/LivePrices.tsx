import { Eye } from 'lucide-react'

interface Props {
  prices: Record<string, { price: number; change24h: number; volume24h: number }>
}

export function LivePrices({ prices }: Props) {
  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value?.toFixed(2) || '0.00'}%`

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold">Live Prices</span>
        <span className="text-xs text-slate-500 ml-auto">Updates every 5s</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(prices || {}).map(([symbol, data]) => (
          <div key={symbol} className="bg-slate-700/30 rounded-lg p-2 text-center">
            <div className="font-semibold text-sm">{symbol}</div>
            <div className="text-xs text-slate-300">${data.price?.toFixed(2)}</div>
            <div className={`text-xs ${data.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatPercent(data.change24h || 0)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default LivePrices
