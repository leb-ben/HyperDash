import { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { saveBandwidthData } from '../lib/dashboardStorage.js';

interface BandwidthUsage {
  used: string;
  remaining: string;
  percentage: string;
  resetDate: string;
  isNearLimit: boolean;
  recommendedInterval: number;
}

interface BurnRate {
  avgDaily: string;
  projectedMonthly: string;
  daysUntilReset: number;
}

export default function BandwidthMonitor() {
  const [usage, setUsage] = useState<BandwidthUsage | null>(null);
  const [burnRate, setBurnRate] = useState<BurnRate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBandwidthData();
    const interval = setInterval(fetchBandwidthData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchBandwidthData = async () => {
    try {
      const [usageRes, burnRes] = await Promise.all([
        fetch('/api/bandwidth/current'),
        fetch('/api/bandwidth/burn-rate')
      ]);

      const usageData = await usageRes.json();
      const burnData = await burnRes.json();

      setUsage(usageData);
      setBurnRate(burnData);
      
      // Save to persistence
      const used = parseFloat(usageData.used.replace(/[^0-9.]/g, '')) || 0;
      const limit = parseFloat(usageData.limit.replace(/[^0-9.]/g, '')) || 1000000000;
      saveBandwidthData(used, limit);
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch bandwidth data:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-slate-700 rounded w-1/4"></div>
          <div className="h-4 bg-slate-700 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <p className="text-slate-400">Bandwidth data unavailable</p>
      </div>
    );
  }

  const percentageNum = parseFloat(usage.percentage);
  const isWarning = percentageNum > 80;
  const isCritical = percentageNum > 90;

  let statusColor = 'text-green-400';
  let statusBg = 'bg-green-500/10';
  let statusBorder = 'border-green-500/30';
  let statusIcon = Zap;

  if (isCritical) {
    statusColor = 'text-red-400';
    statusBg = 'bg-red-500/10';
    statusBorder = 'border-red-500/30';
    statusIcon = AlertCircle;
  } else if (isWarning) {
    statusColor = 'text-yellow-400';
    statusBg = 'bg-yellow-500/10';
    statusBorder = 'border-yellow-500/30';
  }

  const StatusIcon = statusIcon;

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <div className={`rounded-xl border p-4 ${statusBg} ${statusBorder}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <StatusIcon className={`h-6 w-6 ${statusColor}`} />
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Proxy Bandwidth Usage</h3>
              <p className="text-xs text-slate-400 mt-1">
                {isCritical && 'CRITICAL: Usage is very high'}
                {isWarning && !isCritical && 'WARNING: Usage is approaching limit'}
                {!isWarning && 'Status: Normal'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${statusColor}`}>{usage.percentage}%</div>
            <div className="text-xs text-slate-400">of 1 GB</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden mb-3">
          <div
            className={`h-full transition-all ${
              isCritical ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${percentageNum}%` }}
          ></div>
        </div>

        {/* Usage Details */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-slate-400">Used</div>
            <div className="font-semibold text-slate-100">{usage.used}</div>
          </div>
          <div>
            <div className="text-slate-400">Remaining</div>
            <div className="font-semibold text-slate-100">{usage.remaining}</div>
          </div>
          <div>
            <div className="text-slate-400">Reset Date</div>
            <div className="font-semibold text-slate-100">{usage.resetDate}</div>
          </div>
        </div>
      </div>

      {/* Burn Rate & Projection */}
      {burnRate && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-slate-400">Daily Burn Rate</span>
            </div>
            <div className="text-lg font-bold text-slate-100">{burnRate.avgDaily}</div>
            <div className="text-xs text-slate-500 mt-1">Average per day</div>
          </div>

          <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-slate-400">Projected Monthly</span>
            </div>
            <div className="text-lg font-bold text-slate-100">{burnRate.projectedMonthly}</div>
            <div className="text-xs text-slate-500 mt-1">If current rate continues</div>
          </div>

          <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-slate-400">Days Until Reset</span>
            </div>
            <div className="text-lg font-bold text-slate-100">{burnRate.daysUntilReset}</div>
            <div className="text-xs text-slate-500 mt-1">Until monthly reset</div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {usage.isNearLimit && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <p className="text-xs text-yellow-400 font-semibold mb-2">Recommended Actions:</p>
          <ul className="text-xs text-yellow-300/80 space-y-1">
            <li>• Increase polling interval to reduce API calls</li>
            <li>• Consider pausing non-essential data collection</li>
            <li>• Monitor usage closely to avoid hitting the limit</li>
            <li>• Current recommended interval: {(usage.recommendedInterval / 1000).toFixed(0)}s</li>
          </ul>
        </div>
      )}
    </div>
  );
}
