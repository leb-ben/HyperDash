import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

interface PnLData {
  totalValue: number;
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  totalPnl: number;
  unrealizedPnl: number;
}

interface PnLStats {
  bestDay: { date: string; pnl: number };
  worstDay: { date: string; pnl: number };
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
}

export default function PnLDashboard() {
  const [pnlData, setPnlData] = useState<PnLData | null>(null);
  const [stats, setStats] = useState<PnLStats | null>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'all'>('day');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPnLData();
    const interval = setInterval(fetchPnLData, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchPnLData = async () => {
    try {
      const response = await fetch(`/api/pnl/current`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      console.log('PnL API response:', data);
      if (data.pnl) {
        setPnlData(data.pnl);
      } else {
        console.warn('No pnl data in response:', data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch P&L data:', error);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/pnl/statistics');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch P&L stats:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 bg-slate-700 rounded"></div>
            <div className="h-20 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!pnlData) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <p className="text-slate-400">No P&L data available yet</p>
      </div>
    );
  }

  const dailyReturn = pnlData.dailyPnl > 0 ? 'text-green-400' : 'text-red-400';
  const weeklyReturn = pnlData.weeklyPnl > 0 ? 'text-green-400' : 'text-red-400';
  const monthlyReturn = pnlData.monthlyPnl > 0 ? 'text-green-400' : 'text-red-400';
  const totalReturn = pnlData.totalPnl > 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="space-y-4">
      {/* Main P&L Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Daily P&L */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Daily P&L</span>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </div>
          <div className={`text-lg font-bold ${dailyReturn}`}>
            {formatCurrency(pnlData.dailyPnl)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {formatPercent((pnlData.dailyPnl / pnlData.totalValue) * 100)}
          </div>
        </div>

        {/* Weekly P&L */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Weekly P&L</span>
            <BarChart3 className="h-4 w-4 text-slate-500" />
          </div>
          <div className={`text-lg font-bold ${weeklyReturn}`}>
            {formatCurrency(pnlData.weeklyPnl)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {formatPercent((pnlData.weeklyPnl / pnlData.totalValue) * 100)}
          </div>
        </div>

        {/* Monthly P&L */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Monthly P&L</span>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </div>
          <div className={`text-lg font-bold ${monthlyReturn}`}>
            {formatCurrency(pnlData.monthlyPnl)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {formatPercent((pnlData.monthlyPnl / pnlData.totalValue) * 100)}
          </div>
        </div>

        {/* Total P&L */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Total P&L</span>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </div>
          <div className={`text-lg font-bold ${totalReturn}`}>
            {formatCurrency(pnlData.totalPnl)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {formatPercent((pnlData.totalPnl / pnlData.totalValue) * 100)}
          </div>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <h3 className="text-sm font-semibold text-slate-100 mb-3">Performance Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <div className="text-xs text-slate-400">Total Trades</div>
              <div className="text-lg font-bold text-slate-100">{stats.totalTrades}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Win Rate</div>
              <div className={`text-lg font-bold ${stats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.winRate.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Avg Win</div>
              <div className="text-lg font-bold text-green-400">{formatCurrency(stats.avgWin)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Avg Loss</div>
              <div className="text-lg font-bold text-red-400">{formatCurrency(stats.avgLoss)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Best Day</div>
              <div className="text-lg font-bold text-green-400">{formatCurrency(stats.bestDay.pnl)}</div>
              <div className="text-xs text-slate-500">{stats.bestDay.date}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Worst Day</div>
              <div className="text-lg font-bold text-red-400">{formatCurrency(stats.worstDay.pnl)}</div>
              <div className="text-xs text-slate-500">{stats.worstDay.date}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
