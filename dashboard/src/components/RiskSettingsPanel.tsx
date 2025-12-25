import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface RiskSettings {
  portfolioAllocationPct: number;
  reserveAllocationPct: number;
  minConfidenceToTrade: number;
  highConfidenceThreshold: number;
  maxSinglePositionPct: number;
  maxPositions: number;
  aggressiveness: 'conservative' | 'moderate' | 'aggressive';
  leverageMultiplier: number;
  autoAdjust: boolean;
  performanceWindow: number;
}

interface RiskExplanation {
  setting: string;
  current: any;
  impact: string;
  pros: string[];
  cons: string[];
}

export default function RiskSettingsPanel() {
  const [settings, setSettings] = useState<RiskSettings | null>(null);
  const [explanations, setExplanations] = useState<RiskExplanation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSetting, setSelectedSetting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [settingsRes, explanationsRes] = await Promise.all([
        fetch('/api/risk/settings'),
        fetch('/api/risk/explanations')
      ]);

      if (!settingsRes.ok || !explanationsRes.ok) {
        throw new Error('Risk API error');
      }

      const settingsData = await settingsRes.json();
      const explanationsData = await explanationsRes.json();

      console.log('Risk API response:', settingsData, explanationsData);
      setSettings(settingsData);
      setExplanations(explanationsData.explanations || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch risk settings:', error);
      setLoading(false);
    }
  };

  const handleSettingChange = async (key: keyof RiskSettings, value: any) => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/risk/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting: key,
          value: value,
          reason: 'User adjustment via dashboard'
        })
      });

      if (response.ok) {
        setSettings({ ...settings, [key]: value });
      }
    } catch (error) {
      console.error('Failed to update risk setting:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPreset = async (preset: 'conservative' | 'moderate' | 'aggressive') => {
    setSaving(true);
    try {
      const response = await fetch('/api/risk/presets/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset })
      });

      if (response.ok) {
        await fetchSettings();
      }
    } catch (error) {
      console.error('Failed to apply preset:', error);
    } finally {
      setSaving(false);
    }
  };

  const getExplanation = (setting: string) => {
    return explanations.find(e => e.setting === setting);
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-slate-700 rounded"></div>
            <div className="h-4 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <p className="text-slate-400">Risk settings unavailable</p>
      </div>
    );
  }

  const currentExplanation = selectedSetting ? getExplanation(selectedSetting) : null;

  return (
    <div className="space-y-4">
      {/* Preset Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleApplyPreset('conservative')}
          disabled={saving}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            settings.aggressiveness === 'conservative'
              ? 'bg-blue-500/20 border border-blue-500 text-blue-400'
              : 'bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-600/50'
          } disabled:opacity-50`}
        >
          Conservative
        </button>
        <button
          onClick={() => handleApplyPreset('moderate')}
          disabled={saving}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            settings.aggressiveness === 'moderate'
              ? 'bg-green-500/20 border border-green-500 text-green-400'
              : 'bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-600/50'
          } disabled:opacity-50`}
        >
          Moderate
        </button>
        <button
          onClick={() => handleApplyPreset('aggressive')}
          disabled={saving}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            settings.aggressiveness === 'aggressive'
              ? 'bg-red-500/20 border border-red-500 text-red-400'
              : 'bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-600/50'
          } disabled:opacity-50`}
        >
          Aggressive
        </button>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Portfolio Allocation */}
        <div
          className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4 cursor-pointer hover:border-slate-600 transition-all"
          onClick={() => setSelectedSetting('Portfolio Allocation')}
        >
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-slate-100">Portfolio Allocation</label>
            <span className="text-lg font-bold text-blue-400">{settings.portfolioAllocationPct}%</span>
          </div>
          <input
            type="range"
            min="5"
            max="95"
            value={settings.portfolioAllocationPct}
            onChange={(e) => handleSettingChange('portfolioAllocationPct', parseInt(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>5%</span>
            <span>Reserve: {settings.reserveAllocationPct}%</span>
            <span>95%</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            How much of your portfolio to use for active trading
          </p>
        </div>

        {/* Confidence Threshold */}
        <div
          className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4 cursor-pointer hover:border-slate-600 transition-all"
          onClick={() => setSelectedSetting('Confidence Threshold')}
        >
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-slate-100">Min Confidence</label>
            <span className="text-lg font-bold text-green-400">{(settings.minConfidenceToTrade * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={settings.minConfidenceToTrade}
            onChange={(e) => handleSettingChange('minConfidenceToTrade', parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>10%</span>
            <span>High: {(settings.highConfidenceThreshold * 100).toFixed(0)}%</span>
            <span>100%</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Minimum AI confidence required to execute trades
          </p>
        </div>

        {/* Max Position Size */}
        <div
          className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4 cursor-pointer hover:border-slate-600 transition-all"
          onClick={() => setSelectedSetting('Max Position Size')}
        >
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-slate-100">Max Position Size</label>
            <span className="text-lg font-bold text-purple-400">{settings.maxSinglePositionPct}%</span>
          </div>
          <input
            type="range"
            min="5"
            max="50"
            value={settings.maxSinglePositionPct}
            onChange={(e) => handleSettingChange('maxSinglePositionPct', parseInt(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>5%</span>
            <span>Max Positions: {settings.maxPositions}</span>
            <span>50%</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Maximum percentage of trading capital per position
          </p>
        </div>

        {/* Leverage Multiplier */}
        <div
          className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4 cursor-pointer hover:border-slate-600 transition-all"
          onClick={() => setSelectedSetting('Leverage')}
        >
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-slate-100">Leverage Multiplier</label>
            <span className="text-lg font-bold text-orange-400">{settings.leverageMultiplier.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={settings.leverageMultiplier}
            onChange={(e) => handleSettingChange('leverageMultiplier', parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>0.5x</span>
            <span>Conservative to Aggressive</span>
            <span>2.0x</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Multiplier applied to default leverage (higher = more risk)
          </p>
        </div>
      </div>

      {/* Auto-Adjust Toggle */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-semibold text-slate-100">Auto-Adjust Settings</label>
            <p className="text-xs text-slate-400 mt-1">
              Automatically adjust risk settings based on recent performance
            </p>
          </div>
          <button
            onClick={() => handleSettingChange('autoAdjust', !settings.autoAdjust)}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.autoAdjust ? 'bg-green-500/20 border border-green-500' : 'bg-slate-700 border border-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-slate-100 transition-transform ${
                settings.autoAdjust ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Explanation Panel */}
      {currentExplanation && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-400 mb-2">{currentExplanation.setting}</h4>
              <p className="text-xs text-blue-300/80 mb-3">{currentExplanation.impact}</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-green-400 mb-1">Pros (Increase):</p>
                  <ul className="text-xs text-green-300/80 space-y-1">
                    {currentExplanation.pros.map((pro, i) => (
                      <li key={i}>• {pro}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-400 mb-1">Cons (Increase):</p>
                  <ul className="text-xs text-red-300/80 space-y-1">
                    {currentExplanation.cons.map((con, i) => (
                      <li key={i}>• {con}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedSetting(null)}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
