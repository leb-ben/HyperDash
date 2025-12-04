import { useState, useEffect } from 'react'
import { 
  Brain, 
  Zap, 
  ChevronDown, 
  ChevronRight,
  Settings,
  Key,
  Check,
  X,
  Cpu,
  Sparkles
} from 'lucide-react'

interface AIModel {
  id: string
  name: string
  contextWindow: number
  tier: 'production' | 'preview'
  limits: {
    requestsPerMinute: number
    requestsPerHour: number
    requestsPerDay: number
    tokensPerMinute: number
  }
}

interface AIProvider {
  id: string
  name: string
  baseURL: string
  models: AIModel[]
  configured?: boolean
}

interface ModelConfig {
  providerId: string
  modelId: string
}

interface AIConfig {
  executor: ModelConfig
  planner: ModelConfig | null
  currentDirective: any
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfigChange?: () => void
}

const API_BASE = 'http://localhost:3001'

export function AIModelManager({ isOpen, onClose, onConfigChange }: Props) {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null)
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [selectedExecutor, setSelectedExecutor] = useState<{ providerId: string; modelId: string } | null>(null)
  const [selectedPlanner, setSelectedPlanner] = useState<{ providerId: string; modelId: string } | null>(null)
  const [plannerEnabled, setPlannerEnabled] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState<{ providerId: string; key: string }>({ providerId: '', key: '' })
  const [showApiKeyInput, setShowApiKeyInput] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchProviders()
      fetchAiConfig()
    }
  }, [isOpen])

  const fetchProviders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/providers`)
      const data = await res.json()
      setProviders(data.providers || [])
    } catch (e) {
      // Use default providers if API not available
      setProviders([
        {
          id: 'cerebras',
          name: 'Cerebras',
          baseURL: 'https://api.cerebras.ai/v1',
          configured: true,
          models: [
            { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', contextWindow: 65536, tier: 'production', limits: { requestsPerMinute: 30, requestsPerHour: 900, requestsPerDay: 14400, tokensPerMinute: 64000 } },
            { id: 'gpt-oss-120b', name: 'GPT-OSS 120B', contextWindow: 65536, tier: 'production', limits: { requestsPerMinute: 30, requestsPerHour: 900, requestsPerDay: 14400, tokensPerMinute: 64000 } },
            { id: 'llama3.1-8b', name: 'Llama 3.1 8B', contextWindow: 8192, tier: 'production', limits: { requestsPerMinute: 30, requestsPerHour: 900, requestsPerDay: 14400, tokensPerMinute: 60000 } },
            { id: 'qwen-3-32b', name: 'Qwen 3 32B', contextWindow: 65536, tier: 'production', limits: { requestsPerMinute: 30, requestsPerHour: 900, requestsPerDay: 14400, tokensPerMinute: 64000 } },
            { id: 'qwen-3-235b-a22b-instruct-2507', name: 'Qwen 3 235B (Preview)', contextWindow: 65536, tier: 'preview', limits: { requestsPerMinute: 30, requestsPerHour: 900, requestsPerDay: 1440, tokensPerMinute: 64000 } },
            { id: 'zai-glm-4.6', name: 'ZAI-GLM 4.6 (Preview)', contextWindow: 64000, tier: 'preview', limits: { requestsPerMinute: 10, requestsPerHour: 100, requestsPerDay: 100, tokensPerMinute: 60000 } }
          ]
        },
        {
          id: 'openai',
          name: 'OpenAI',
          baseURL: 'https://api.openai.com/v1',
          configured: false,
          models: [
            { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, tier: 'production', limits: { requestsPerMinute: 500, requestsPerHour: 10000, requestsPerDay: 100000, tokensPerMinute: 150000 } },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, tier: 'production', limits: { requestsPerMinute: 500, requestsPerHour: 10000, requestsPerDay: 100000, tokensPerMinute: 200000 } },
            { id: 'o1-preview', name: 'o1 Preview (Reasoning)', contextWindow: 128000, tier: 'preview', limits: { requestsPerMinute: 20, requestsPerHour: 100, requestsPerDay: 500, tokensPerMinute: 30000 } }
          ]
        },
        {
          id: 'anthropic',
          name: 'Anthropic',
          baseURL: 'https://api.anthropic.com/v1',
          configured: false,
          models: [
            { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, tier: 'production', limits: { requestsPerMinute: 50, requestsPerHour: 1000, requestsPerDay: 10000, tokensPerMinute: 80000 } },
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, tier: 'production', limits: { requestsPerMinute: 50, requestsPerHour: 1000, requestsPerDay: 10000, tokensPerMinute: 80000 } }
          ]
        },
        {
          id: 'google',
          name: 'Google (Gemini)',
          baseURL: 'https://generativelanguage.googleapis.com/v1beta',
          configured: false,
          models: [
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, tier: 'production', limits: { requestsPerMinute: 60, requestsPerHour: 1000, requestsPerDay: 10000, tokensPerMinute: 100000 } },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, tier: 'production', limits: { requestsPerMinute: 60, requestsPerHour: 1000, requestsPerDay: 10000, tokensPerMinute: 100000 } }
          ]
        }
      ])
    }
  }

  const fetchAiConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/config`)
      const data = await res.json()
      setAiConfig(data)
      if (data.executor) {
        setSelectedExecutor({ providerId: data.executor.providerId, modelId: data.executor.modelId })
      }
      if (data.planner) {
        setSelectedPlanner({ providerId: data.planner.providerId, modelId: data.planner.modelId })
        setPlannerEnabled(true)
      }
    } catch (e) {
      // Default config
      setSelectedExecutor({ providerId: 'cerebras', modelId: 'llama-3.3-70b' })
    }
  }

  const saveApiKey = async (providerId: string, key: string) => {
    try {
      await fetch(`${API_BASE}/api/ai/apikey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, apiKey: key })
      })
      setMessage({ type: 'success', text: `API key saved for ${providerId}` })
      setShowApiKeyInput(null)
      fetchProviders()
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save API key' })
    }
  }

  const saveExecutorModel = async () => {
    if (!selectedExecutor) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/ai/executor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedExecutor)
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Executor model updated!' })
        onConfigChange?.()
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || 'Failed to update' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to connect to API' })
    }
    setSaving(false)
  }

  const savePlannerModel = async () => {
    setSaving(true)
    try {
      if (!plannerEnabled) {
        await fetch(`${API_BASE}/api/ai/planner`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: false })
        })
        setMessage({ type: 'success', text: 'Planner disabled' })
      } else if (selectedPlanner) {
        const res = await fetch(`${API_BASE}/api/ai/planner`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(selectedPlanner)
        })
        if (res.ok) {
          setMessage({ type: 'success', text: 'Planner model configured!' })
        } else {
          const data = await res.json()
          setMessage({ type: 'error', text: data.error || 'Failed to update' })
        }
      }
      onConfigChange?.()
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to connect to API' })
    }
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">AI Model Manager</h2>
              <p className="text-sm text-slate-400">Configure planner and executor models</p>
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
              {message.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              {message.text}
              <button onClick={() => setMessage(null)} className="ml-auto">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Architecture Explanation */}
          <div className="bg-slate-700/30 rounded-xl p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              Dual-Model Architecture
            </h3>
            <p className="text-sm text-slate-400">
              <strong className="text-purple-400">Planner</strong> (smart model) sets high-level strategy every 15min.{' '}
              <strong className="text-blue-400">Executor</strong> (fast model) makes tactical decisions every cycle, following planner directives.
            </p>
          </div>

          {/* Executor Model */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold">Executor Model (Fast)</h3>
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Every 5min</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {providers.map(provider => (
                <div key={provider.id} className="space-y-2">
                  <button
                    onClick={() => setExpandedProvider(expandedProvider === `exec-${provider.id}` ? null : `exec-${provider.id}`)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      selectedExecutor?.providerId === provider.id 
                        ? 'border-blue-500 bg-blue-500/10' 
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      <span>{provider.name}</span>
                      {provider.configured && <Check className="w-3 h-3 text-green-400" />}
                    </div>
                    {expandedProvider === `exec-${provider.id}` ? 
                      <ChevronDown className="w-4 h-4" /> : 
                      <ChevronRight className="w-4 h-4" />
                    }
                  </button>
                  
                  {expandedProvider === `exec-${provider.id}` && (
                    <div className="pl-4 space-y-1">
                      {!provider.configured && (
                        <div className="flex gap-2 mb-2">
                          <input
                            type="password"
                            placeholder="Enter API key..."
                            className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                            value={showApiKeyInput === provider.id ? apiKeyInput.key : ''}
                            onChange={e => {
                              setShowApiKeyInput(provider.id)
                              setApiKeyInput({ providerId: provider.id, key: e.target.value })
                            }}
                          />
                          <button
                            onClick={() => saveApiKey(provider.id, apiKeyInput.key)}
                            className="px-2 py-1 bg-blue-600 rounded text-sm hover:bg-blue-500"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {provider.models.map(model => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedExecutor({ providerId: provider.id, modelId: model.id })}
                          className={`w-full text-left p-2 rounded text-sm transition-colors ${
                            selectedExecutor?.modelId === model.id && selectedExecutor?.providerId === provider.id
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'hover:bg-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{model.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              model.tier === 'production' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {model.tier}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {(model.contextWindow / 1000).toFixed(0)}K ctx • {model.limits.requestsPerMinute} req/min
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={saveExecutorModel}
              disabled={saving || !selectedExecutor}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save Executor Model'}
            </button>
          </div>

          {/* Planner Model */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold">Planner Model (Smart)</h3>
                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">Every 15min</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-slate-400">Enable</span>
                <button
                  onClick={() => setPlannerEnabled(!plannerEnabled)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    plannerEnabled ? 'bg-purple-500' : 'bg-slate-600'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                    plannerEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </label>
            </div>

            {plannerEnabled && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {providers.map(provider => (
                    <div key={provider.id} className="space-y-2">
                      <button
                        onClick={() => setExpandedProvider(expandedProvider === `plan-${provider.id}` ? null : `plan-${provider.id}`)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          selectedPlanner?.providerId === provider.id 
                            ? 'border-purple-500 bg-purple-500/10' 
                            : 'border-slate-600 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4" />
                          <span>{provider.name}</span>
                          {provider.configured && <Check className="w-3 h-3 text-green-400" />}
                        </div>
                        {expandedProvider === `plan-${provider.id}` ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </button>
                      
                      {expandedProvider === `plan-${provider.id}` && (
                        <div className="pl-4 space-y-1">
                          {provider.models.map(model => (
                            <button
                              key={model.id}
                              onClick={() => setSelectedPlanner({ providerId: provider.id, modelId: model.id })}
                              className={`w-full text-left p-2 rounded text-sm transition-colors ${
                                selectedPlanner?.modelId === model.id && selectedPlanner?.providerId === provider.id
                                  ? 'bg-purple-500/20 text-purple-400'
                                  : 'hover:bg-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{model.name}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  model.tier === 'production' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                  {model.tier}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={savePlannerModel}
                  disabled={saving || !selectedPlanner}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Planner Model'}
                </button>
              </>
            )}

            {!plannerEnabled && (
              <p className="text-sm text-slate-500 italic">
                Planner disabled - executor will make all decisions independently.
              </p>
            )}
          </div>

          {/* Current Directive */}
          {aiConfig?.currentDirective && (
            <div className="bg-slate-700/30 rounded-xl p-4">
              <h3 className="font-semibold mb-2">Current Planner Directive</h3>
              <div className="text-sm space-y-1">
                <p><span className="text-slate-400">Market:</span> {aiConfig.currentDirective.marketRegime}</p>
                <p><span className="text-slate-400">Risk:</span> {aiConfig.currentDirective.riskTolerance}</p>
                <p><span className="text-slate-400">Strategy:</span> {aiConfig.currentDirective.strategy}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AIModelManager
