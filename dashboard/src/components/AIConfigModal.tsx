import { useState } from 'react'
import { X, Settings, Brain, Sliders } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function AIConfigModal({ isOpen, onClose }: Props) {
  const [selectedProvider, setSelectedProvider] = useState('cerebras')
  const [selectedModel, setSelectedModel] = useState('llama-3.3-70b')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(2048)
  const [riskAggression, setRiskAggression] = useState('moderate')

  if (!isOpen) return null

  const providers = {
    cerebras: {
      name: 'Cerebras',
      models: ['gpt-oss-120b', 'llama-3.3-70b', 'llama3.1-8b', 'qwen-3-235b-a22b-instruct-2507']
    },
    perplexity: {
      name: 'Perplexity',
      models: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online', 'llama-3.1-sonar-huge-128k-online']
    },
    groq: {
      name: 'Groq',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it']
    },
    venice: {
      name: 'Venice AI',
      models: ['llama-3.3-70b', 'llama-3.1-405b', 'qwen2.5-coder-32b-instruct']
    },
    gemini: {
      name: 'Google Gemini',
      models: ['gemini-2.0-flash-exp', 'gemini-2.0-flash-thinking-exp', 'gemini-1.5-pro', 'gemini-1.5-flash']
    }
  }

  const currentModels = providers[selectedProvider as keyof typeof providers]?.models || []

  const riskLevels = [
    { value: 'conservative', label: 'Conservative', description: 'High confidence required (75%+)' },
    { value: 'moderate', label: 'Moderate', description: 'Standard confidence required (65%+)' },
    { value: 'aggressive', label: 'Aggressive', description: 'Lower confidence required (55%+)' },
    { value: 'very_aggressive', label: 'Very Aggressive', description: 'Low confidence required (45%+)' }
  ]

  const handleSave = () => {
    // TODO: Save configuration to backend
    const confidenceThreshold = {
      'conservative': 75,
      'moderate': 65,
      'aggressive': 55,
      'very_aggressive': 45
    }[riskAggression]

    console.log('Saving AI config:', { 
      selectedProvider,
      selectedModel, 
      temperature, 
      maxTokens,
      riskAggression,
      confidenceThreshold
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <span className="font-semibold">AI Configuration</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Brain className="w-4 h-4" />
              AI Provider
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value)
                const newProvider = providers[e.target.value as keyof typeof providers]
                if (newProvider) {
                  setSelectedModel(newProvider.models[0])
                }
              }}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
            >
              {Object.entries(providers).map(([key, provider]) => (
                <option key={key} value={key}>{provider.name}</option>
              ))}
            </select>
          </div>

          {/* Model Selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Settings className="w-4 h-4" />
              Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
            >
              {currentModels.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          {/* Temperature */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Sliders className="w-4 h-4" />
              Temperature: {temperature}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Conservative</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Max Tokens: {maxTokens}
            </label>
            <input
              type="range"
              min="256"
              max="4096"
              step="256"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Short</span>
              <span>Long</span>
            </div>
          </div>

          {/* Risk/Aggression Setting */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Sliders className="w-4 h-4" />
              Risk/Aggression Level
            </label>
            <select
              value={riskAggression}
              onChange={(e) => setRiskAggression(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
            >
              {riskLevels.map(level => (
                <option key={level.value} value={level.value}>
                  {level.label} - {level.description}
                </option>
              ))}
            </select>
            <div className="text-xs text-slate-400 mt-1">
              Note: This affects trade confidence thresholds, not stop loss settings
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  )
}

export default AIConfigModal
