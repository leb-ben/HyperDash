import { useState, useEffect } from 'react'
import { 
  Shield, 
  AlertTriangle, 
  Wallet,
  X,
  Save,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Bell
} from 'lucide-react'

interface SafetyConfig {
  globalStopLossPct: number
  stopLossTimeWindowHours: number
  profitTakePct: number
  profitWithdrawPct: number
  profitTimeWindowHours: number
  withdrawalAddress: string
  withdrawalAddressName: string
  alertOnStopLoss: boolean
  alertOnProfitTake: boolean
  alertWebhookUrl?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

const API_BASE = 'http://localhost:3001'

export function SafetySettings({ isOpen, onClose }: Props) {
  const [config, setConfig] = useState<SafetyConfig>({
    globalStopLossPct: 25,
    stopLossTimeWindowHours: 24,
    profitTakePct: 25,
    profitWithdrawPct: 15,
    profitTimeWindowHours: 24,
    withdrawalAddress: '',
    withdrawalAddressName: '',
    alertOnStopLoss: true,
    alertOnProfitTake: true
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchConfig()
    }
  }, [isOpen])

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/safety/config`)
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      }
    } catch (e) {
      // Use defaults
    }
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/safety/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Safety settings saved!' })
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to connect to API' })
    }
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-red-500 to-orange-500 p-2 rounded-lg">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Safety Settings</h2>
              <p className="text-sm text-slate-400">Portfolio protection & auto-actions</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Message */}
          {message && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {message.text}
              <button onClick={() => setMessage(null)} className="ml-auto">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Global Stop Loss */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-red-400" />
              <h3 className="font-semibold text-red-400">Global Stop Loss (Kill Switch)</h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Automatically stop ALL trading and alert you if portfolio drops below threshold.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Max Loss %</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.globalStopLossPct}
                    onChange={e => setConfig({ ...config, globalStopLossPct: Number(e.target.value) })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                    min="1"
                    max="100"
                  />
                  <span className="text-slate-400">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Time Window</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.stopLossTimeWindowHours}
                    onChange={e => setConfig({ ...config, stopLossTimeWindowHours: Number(e.target.value) })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                    min="1"
                    max="168"
                  />
                  <span className="text-slate-400">hrs</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-red-400 mt-2">
              ⚠️ If portfolio drops {config.globalStopLossPct}% in {config.stopLossTimeWindowHours} hours, bot STOPS immediately.
            </p>
          </div>

          {/* Auto Profit Taking */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold text-green-400">Auto Profit Withdrawal</h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Automatically withdraw profits to your secure wallet when targets are hit.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Trigger at +</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.profitTakePct}
                    onChange={e => setConfig({ ...config, profitTakePct: Number(e.target.value) })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                    min="5"
                    max="500"
                  />
                  <span className="text-slate-400">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Withdraw %</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.profitWithdrawPct}
                    onChange={e => setConfig({ ...config, profitWithdrawPct: Number(e.target.value) })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                    min="1"
                    max="100"
                  />
                  <span className="text-slate-400">%</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-green-400 mt-2">
              ✓ When up {config.profitTakePct}% in 24hrs, withdraw {config.profitWithdrawPct}% of gains.
            </p>
          </div>

          {/* Withdrawal Address */}
          <div className="bg-slate-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold">Secure Withdrawal Address</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Wallet Name</label>
                <input
                  type="text"
                  value={config.withdrawalAddressName}
                  onChange={e => setConfig({ ...config, withdrawalAddressName: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                  placeholder="e.g., Faucet-Sipper1"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">EVM Address</label>
                <input
                  type="text"
                  value={config.withdrawalAddress}
                  onChange={e => setConfig({ ...config, withdrawalAddress: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 font-mono text-sm"
                  placeholder="0x..."
                />
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-slate-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-yellow-400" />
              <h3 className="font-semibold">Alert Settings</h3>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.alertOnStopLoss}
                  onChange={e => setConfig({ ...config, alertOnStopLoss: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span>Alert on stop loss trigger</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.alertOnProfitTake}
                  onChange={e => setConfig({ ...config, alertOnProfitTake: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span>Alert on profit withdrawal</span>
              </label>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Webhook URL (optional)</label>
                <input
                  type="text"
                  value={config.alertWebhookUrl || ''}
                  onChange={e => setConfig({ ...config, alertWebhookUrl: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                  placeholder="https://hooks.slack.com/... or Discord webhook"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Safety Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SafetySettings
