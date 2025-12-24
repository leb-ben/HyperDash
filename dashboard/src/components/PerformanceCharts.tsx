import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, BarChart3, PieChart, Calendar } from 'lucide-react';

interface PnLHistoryPoint {
  date: string;
  pnl: number;
  portfolioValue: number;
  trades: number;
}

interface WinLossData {
  wins: number;
  losses: number;
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

interface CoinPerformance {
  symbol: string;
  trades: number;
  pnl: number;
  winRate: number;
  avgReturn: number;
}

export default function PerformanceCharts() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'all'>('week');
  const [pnlHistory, setPnlHistory] = useState<PnLHistoryPoint[]>([]);
  const [winLoss, setWinLoss] = useState<WinLossData | null>(null);
  const [coinPerformance, setCoinPerformance] = useState<CoinPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [period]);

  const fetchData = async () => {
    try {
      const [historyRes, statsRes, coinsRes] = await Promise.all([
        fetch(`/api/pnl/history?period=${period}`),
        fetch('/api/pnl/statistics'),
        fetch('/api/performance/by-coin')
      ]);

      if (historyRes.ok) {
        const data = await historyRes.json();
        setPnlHistory(data.history || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setWinLoss({
          wins: data.winningTrades || 0,
          losses: data.losingTrades || 0,
          totalTrades: data.totalTrades || 0,
          winRate: data.winRate || 0,
          avgWin: data.avgWin || 0,
          avgLoss: data.avgLoss || 0,
          profitFactor: data.profitFactor || 0
        });
      }

      if (coinsRes.ok) {
        const data = await coinsRes.json();
        setCoinPerformance(data.coins || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const maxPnl = Math.max(...pnlHistory.map(p => p.pnl), 0);
  const minPnl = Math.min(...pnlHistory.map(p => p.pnl), 0);
  const pnlRange = maxPnl - minPnl || 1;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8 text-center">
          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse" />
          <p className="text-slate-400">Loading performance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Performance Analytics</h2>
        <div className="flex gap-2">
          {(['day', 'week', 'month', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-sm font-semibold ${
                period === p
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {p === 'day' ? '24H' : p === 'week' ? '7D' : p === 'month' ? '30D' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {pnlHistory.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold">P&L History</h3>
          </div>
          
          <div className="relative h-64">
            <div className="absolute inset-0 flex items-end justify-between gap-1">
              {pnlHistory.map((point, idx) => {
                const heightPct = pnlRange > 0 
                  ? Math.abs(point.pnl - minPnl) / pnlRange * 100 
                  : 50;
                const isPositive = point.pnl >= 0;
                
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative">
                    <div
                      className={`w-full rounded-t transition-all ${
                        isPositive ? 'bg-green-500/70 hover:bg-green-500' : 'bg-red-500/70 hover:bg-red-500'
                      }`}
                      style={{ height: `${Math.max(heightPct, 5)}%` }}
                    />
                    
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs whitespace-nowrap z-10">
                      <div className="font-semibold">{point.date}</div>
                      <div className={isPositive ? 'text-green-400' : 'text-red-400'}>
                        {formatCurrency(point.pnl)}
                      </div>
                      <div className="text-slate-400">{point.trades} trades</div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-700" />
            <div className="absolute left-0 right-0 bottom-1/2 h-px bg-slate-700/50" />
          </div>

          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>{pnlHistory[0]?.date}</span>
            <span>{pnlHistory[pnlHistory.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {winLoss && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5 text-purple-400" />
              <h3 className="font-semibold">Win/Loss Distribution</h3>
            </div>

            <div className="flex items-center justify-center mb-4">
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="rgb(239 68 68)"
                    strokeWidth="20"
                    strokeDasharray={`${(winLoss.losses / winLoss.totalTrades) * 251.2} 251.2`}
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="rgb(34 197 94)"
                    strokeWidth="20"
                    strokeDasharray={`${(winLoss.wins / winLoss.totalTrades) * 251.2} 251.2`}
                    strokeDashoffset={`-${(winLoss.losses / winLoss.totalTrades) * 251.2}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-3xl font-bold">{winLoss.winRate.toFixed(1)}%</div>
                  <div className="text-xs text-slate-400">Win Rate</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-500/10 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-slate-400">Wins</span>
                </div>
                <div className="text-xl font-bold text-green-400">{winLoss.wins}</div>
                <div className="text-xs text-slate-500">Avg: {formatCurrency(winLoss.avgWin)}</div>
              </div>

              <div className="bg-red-500/10 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-slate-400">Losses</span>
                </div>
                <div className="text-xl font-bold text-red-400">{winLoss.losses}</div>
                <div className="text-xs text-slate-500">Avg: {formatCurrency(winLoss.avgLoss)}</div>
              </div>
            </div>

            <div className="mt-3 p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Profit Factor</span>
                <span className={`text-lg font-bold ${
                  winLoss.profitFactor >= 2 ? 'text-green-400' :
                  winLoss.profitFactor >= 1 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {winLoss.profitFactor.toFixed(2)}x
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold">Performance by Coin</h3>
            </div>

            {coinPerformance.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>No trading data yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {coinPerformance.slice(0, 5).map((coin) => (
                  <div key={coin.symbol} className="bg-slate-700/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{coin.symbol}</span>
                      <span className={`text-sm font-bold ${
                        coin.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {coin.pnl >= 0 ? '+' : ''}{formatCurrency(coin.pnl)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-slate-500">Trades</div>
                        <div className="font-semibold">{coin.trades}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Win Rate</div>
                        <div className={`font-semibold ${
                          coin.winRate >= 50 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {coin.winRate.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Avg Return</div>
                        <div className={`font-semibold ${
                          coin.avgReturn >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {coin.avgReturn >= 0 ? '+' : ''}{coin.avgReturn.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 h-1 bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${coin.winRate >= 50 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${coin.winRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-slate-500 text-center">
        <Calendar className="w-3 h-3 inline mr-1" />
        Data updates every 30 seconds
      </div>
    </div>
  );
}
