import { useState, useEffect } from 'react';
import { Bell, BellOff, Volume2, VolumeX, X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface Alert {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

interface AlertSettings {
  soundEnabled: boolean;
  desktopNotifications: boolean;
  tradeAlerts: boolean;
  priceAlerts: boolean;
  systemAlerts: boolean;
}

export default function AlertSystem() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [settings, setSettings] = useState<AlertSettings>(() => {
    const saved = loadAlertSettings();
    return saved || {
      enabled: true,
      soundEnabled: true,
      desktopNotifications: false,
      tradeAlerts: true,
      priceAlerts: true,
      systemAlerts: true
    };
  });
  const [showSettings, setShowSettings] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('alert_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/alerts');
      const data = await response.json();
      if (data.alerts) {
        const newAlerts = data.alerts.filter(
          (alert: Alert) => !alerts.find(a => a.id === alert.id)
        );
        
        if (newAlerts.length > 0) {
          setAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
          
          newAlerts.forEach((alert: Alert) => {
            if (settings.enabled) {
              showAlert(alert);
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  const showAlert = (alert: Alert) => {
    if (settings.soundEnabled) {
      playAlertSound(alert.type);
    }

    if (settings.desktopNotifications && notificationPermission === 'granted') {
      new Notification(alert.title, {
        body: alert.message,
        icon: '/favicon.ico',
        tag: alert.id
      });
    }
  };

  const playAlertSound = (type: string) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = type === 'error' ? 400 : type === 'warning' ? 600 : 800;
    gainNode.gain.value = 0.1;

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        setSettings({ ...settings, desktopNotifications: true });
      }
    }
  };

  const markAsRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };

  const markAllAsRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  };

  const clearAll = () => {
    setAlerts([]);
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'error': return <AlertTriangle className="w-5 h-5 text-red-400" />;
      default: return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-green-500/50 bg-green-500/10';
      case 'warning': return 'border-yellow-500/50 bg-yellow-500/10';
      case 'error': return 'border-red-500/50 bg-red-500/10';
      default: return 'border-blue-500/50 bg-blue-500/10';
    }
  };

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-5 h-5 text-blue-400" />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </div>
          <h3 className="font-semibold">Alerts</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            className={`p-2 rounded-lg ${
              settings.enabled ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-500'
            }`}
            title={settings.enabled ? 'Alerts enabled' : 'Alerts disabled'}
          >
            {settings.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
            className={`p-2 rounded-lg ${
              settings.soundEnabled ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-500'
            }`}
            title={settings.soundEnabled ? 'Sound enabled' : 'Sound disabled'}
          >
            {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-400"
            >
              Mark all read
            </button>
          )}

          {alerts.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-400"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {notificationPermission !== 'granted' && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300">Enable desktop notifications?</span>
            </div>
            <button
              onClick={requestNotificationPermission}
              className="text-xs px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded text-white font-semibold"
            >
              Enable
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-auto">
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No alerts yet</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border ${getAlertColor(alert.type)} ${
                alert.read ? 'opacity-60' : ''
              }`}
              onClick={() => markAsRead(alert.id)}
            >
              <div className="flex items-start gap-3">
                {getAlertIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{alert.title}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{alert.message}</p>
                </div>
                {!alert.read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          {showSettings ? 'Hide' : 'Show'} alert settings
        </button>

        {showSettings && (
          <div className="mt-3 space-y-2">
            <label className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Trade alerts</span>
              <input
                type="checkbox"
                checked={settings.tradeAlerts}
                onChange={(e) => setSettings({ ...settings, tradeAlerts: e.target.checked })}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Price alerts</span>
              <input
                type="checkbox"
                checked={settings.priceAlerts}
                onChange={(e) => setSettings({ ...settings, priceAlerts: e.target.checked })}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span className="text-slate-400">System alerts</span>
              <input
                type="checkbox"
                checked={settings.systemAlerts}
                onChange={(e) => setSettings({ ...settings, systemAlerts: e.target.checked })}
                className="rounded"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
