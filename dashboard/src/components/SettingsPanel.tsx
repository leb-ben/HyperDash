import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Globe, Bell, Database, Shield } from 'lucide-react';

interface GeneralSettings {
  refreshInterval: number;
  theme: 'dark' | 'light';
  compactMode: boolean;
  showNotifications: boolean;
  soundEnabled: boolean;
  autoStartBot: boolean;
  proxyEnabled: boolean;
  apiCallsOverProxy: boolean;
}

const DEFAULT_SETTINGS: GeneralSettings = {
  refreshInterval: 3000,
  theme: 'dark',
  compactMode: false,
  showNotifications: true,
  soundEnabled: false,
  autoStartBot: false,
  proxyEnabled: true,
  apiCallsOverProxy: false,
};

export default function SettingsPanel() {
  const [settings, setSettings] = useState<GeneralSettings>(() => {
    const saved = localStorage.getItem('dashboard_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('dashboard_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('dashboard_settings');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold">General Settings</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              saved ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400'
            }`}
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Dashboard Settings */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          Dashboard
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Refresh Interval</div>
              <div className="text-xs text-slate-400">How often to fetch updates</div>
            </div>
            <select
              value={settings.refreshInterval}
              onChange={(e) => setSettings({ ...settings, refreshInterval: Number(e.target.value) })}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
            >
              <option value={1000}>1 second</option>
              <option value={3000}>3 seconds</option>
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Compact Mode</div>
              <div className="text-xs text-slate-400">Reduce spacing for more content</div>
            </div>
            <button
              onClick={() => setSettings({ ...settings, compactMode: !settings.compactMode })}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.compactMode ? 'bg-purple-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.compactMode ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-yellow-400" />
          Notifications
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Show Notifications</div>
              <div className="text-xs text-slate-400">Display alerts and updates</div>
            </div>
            <button
              onClick={() => setSettings({ ...settings, showNotifications: !settings.showNotifications })}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.showNotifications ? 'bg-purple-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.showNotifications ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Sound Effects</div>
              <div className="text-xs text-slate-400">Play sounds for important events</div>
            </div>
            <button
              onClick={() => setSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.soundEnabled ? 'bg-purple-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Proxy Settings */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-green-400" />
          Proxy & Network
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Proxy Enabled</div>
              <div className="text-xs text-slate-400">Route traffic through proxy</div>
            </div>
            <button
              onClick={() => setSettings({ ...settings, proxyEnabled: !settings.proxyEnabled })}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.proxyEnabled ? 'bg-purple-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.proxyEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">API Calls Over Proxy</div>
              <div className="text-xs text-slate-400">Send API requests through proxy (uses bandwidth)</div>
            </div>
            <button
              onClick={() => setSettings({ ...settings, apiCallsOverProxy: !settings.apiCallsOverProxy })}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.apiCallsOverProxy ? 'bg-purple-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.apiCallsOverProxy ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Bot Settings */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          Bot Behavior
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Auto-Start Bot</div>
              <div className="text-xs text-slate-400">Start trading on page load</div>
            </div>
            <button
              onClick={() => setSettings({ ...settings, autoStartBot: !settings.autoStartBot })}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.autoStartBot ? 'bg-purple-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.autoStartBot ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
