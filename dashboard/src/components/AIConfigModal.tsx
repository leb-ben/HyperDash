import { useState } from 'react'
import { X, Settings, Brain, Key, Sliders } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function AIConfigModal({ isOpen, onClose }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState('cerebras-llama3.1-70b')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(2048)
  const [riskAggression, setRiskAggression] = useState('moderate')

  if (!isOpen) return null

  const availableModels = [
    'cerebras-llama3.1-70b',
    'gpt-4',
    'gpt-3.5-turbo',
    'claude-3-sonnet',
    'claude-3-haiku'
  ]

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
      apiKey, 
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
          {/* API Key */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Key className="w-4 h-4" />
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
            />
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
              {availableModels.map(model => (
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
