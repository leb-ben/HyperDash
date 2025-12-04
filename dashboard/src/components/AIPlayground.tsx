import { useState, useEffect } from 'react'
import { 
  Beaker, 
  Sliders, 
  Play, 
  RotateCcw,
  ChevronDown,
  Loader2,
  Copy,
  Check,
  Sparkles,
  Brain,
  Zap,
  X
} from 'lucide-react'

interface AIProvider {
  id: string
  name: string
  models: {
    id: string
    name: string
    supportsReasoning?: boolean
    reasoningLevels?: string[]
  }[]
}

interface TestResult {
  provider: string
  model: string
  response: string
  tokens: { prompt: number; completion: number; total: number }
  latencyMs: number
  cost?: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

const PROVIDERS: AIProvider[] = [
  {
    id: 'cerebras',
    name: 'Cerebras',
    models: [
      { id: 'llama-3.3-70b', name: 'Llama 3.3 70B' },
      { id: 'llama3.1-8b', name: 'Llama 3.1 8B' },
      { id: 'qwen-3-32b', name: 'Qwen 3 32B' }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      { id: 'o1', name: 'o1 (Reasoning)', supportsReasoning: true, reasoningLevels: ['low', 'medium', 'high'] },
      { id: 'o1-mini', name: 'o1 Mini', supportsReasoning: true, reasoningLevels: ['low', 'medium', 'high'] }
    ]
  }
]

const SAMPLE_PROMPTS = [
  {
    name: 'Market Analysis',
    prompt: `BTC is at $97,500, up 2.3% in 24h. RSI(14) is 68, MACD histogram is positive.
ETH is at $3,650, up 1.8%. RSI is 72 (overbought).
Portfolio: $10,000 total, $5,000 in USDC, $3,000 in BTC long (2x), $2,000 in ETH long (3x).
What should we do?`
  },
  {
    name: 'Risk Assessment',
    prompt: `Current positions:
- BTC Long 3x: Entry $95,000, Current $94,200, -2.5% unrealized
- SOL Long 5x: Entry $230, Current $218, -5.2% unrealized
Daily loss is 3.5%. Should we cut losses or hold?`
  },
  {
    name: 'Signal Interpretation',
    prompt: `Signals detected:
- BTC: RSI oversold (28), Bollinger lower band touch, MACD bullish crossover
- ETH: RSI neutral (52), high volume spike, funding rate -0.02%
Which signals are actionable?`
  }
]

const API_BASE = '/api'

export function AIPlayground({ isOpen, onClose }: Props) {
  // Provider & Model
  const [selectedProvider, setSelectedProvider] = useState('cerebras')
  const [selectedModel, setSelectedModel] = useState('llama-3.3-70b')
  
  // Parameters
  const [temperature, setTemperature] = useState(0.3)
  const [topP, setTopP] = useState(0.9)
  const [maxTokens, setMaxTokens] = useState(1000)
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('high')
  
  // Test
  const [systemPrompt, setSystemPrompt] = useState('You are an expert crypto trading AI. Analyze the market data and provide recommendations in clear, concise format.')
  const [userPrompt, setUserPrompt] = useState(SAMPLE_PROMPTS[0].prompt)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])
  const [copied, setCopied] = useState(false)

  const currentProvider = PROVIDERS.find(p => p.id === selectedProvider)
  const currentModel = currentProvider?.models.find(m => m.id === selectedModel)
  const supportsReasoning = currentModel?.supportsReasoning

  // Update model when provider changes
  useEffect(() => {
    const provider = PROVIDERS.find(p => p.id === selectedProvider)
    if (provider && provider.models.length > 0) {
      setSelectedModel(provider.models[0].id)
    }
  }, [selectedProvider])

  const runTest = async () => {
    setIsLoading(true)
    const startTime = Date.now()
    
    try {
      const res = await fetch(`${API_BASE}/ai/playground`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          systemPrompt,
          userPrompt,
          parameters: {
            temperature: supportsReasoning ? undefined : temperature,
            top_p: supportsReasoning ? undefined : topP,
            max_tokens: maxTokens,
            reasoning_effort: supportsReasoning ? reasoningEffort : undefined
          }
        })
      })
      
      const data = await res.json()
      const latencyMs = Date.now() - startTime
      
      const result: TestResult = {
        provider: currentProvider?.name || selectedProvider,
        model: currentModel?.name || selectedModel,
        response: data.response || data.error || 'No response',
        tokens: data.usage || { prompt: 0, completion: 0, total: 0 },
        latencyMs,
        cost: data.cost
      }
      
      setResults(prev => [result, ...prev].slice(0, 10))
    } catch (e) {
      const result: TestResult = {
        provider: currentProvider?.name || selectedProvider,
        model: currentModel?.name || selectedModel,
        response: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`,
        tokens: { prompt: 0, completion: 0, total: 0 },
        latencyMs: Date.now() - startTime
      }
      setResults(prev => [result, ...prev].slice(0, 10))
    }
    
    setIsLoading(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-green-500 to-cyan-500 p-2 rounded-lg">
              <Beaker className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">AI Playground</h2>
              <p className="text-sm text-slate-400">Test prompts and parameters across providers</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - Configuration */}
            <div className="space-y-5">
              {/* Provider & Model Selection */}
              <div className="bg-slate-700/30 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Brain className="w-4 h-4 text-purple-400" />
                  Provider & Model
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Provider</label>
                    <div className="relative">
                      <select
                        value={selectedProvider}
                        onChange={e => setSelectedProvider(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer"
                      >
                        {PROVIDERS.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Model</label>
                    <div className="relative">
                      <select
                        value={selectedModel}
                        onChange={e => setSelectedModel(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer"
                      >
                        {currentProvider?.models.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Parameters */}
              <div className="bg-slate-700/30 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sliders className="w-4 h-4 text-blue-400" />
                  Parameters
                </div>

                {supportsReasoning ? (
                  // Reasoning model parameters
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-400">Reasoning Effort</span>
                      <span className="text-cyan-400 font-medium">{reasoningEffort}</span>
                    </div>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high'] as const).map(level => (
                        <button
                          key={level}
                          onClick={() => setReasoningEffort(level)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                            reasoningEffort === level
                              ? 'bg-cyan-500 text-white'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      o1 models use reasoning tokens. Higher effort = better results but more tokens.
                      <strong className="text-cyan-400"> Always use 'high' for trading decisions!</strong>
                    </p>
                  </div>
                ) : (
                  // Standard parameters
                  <>
                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-400">Temperature</span>
                        <span className="text-blue-400 font-mono">{temperature.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.05"
                        value={temperature}
                        onChange={e => setTemperature(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-600 rounded-full appearance-none cursor-pointer accent-blue-500"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>Deterministic</span>
                        <span>Creative</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-400">Top P (Nucleus Sampling)</span>
                        <span className="text-purple-400 font-mono">{topP.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={topP}
                        onChange={e => setTopP(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-600 rounded-full appearance-none cursor-pointer accent-purple-500"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>Focused</span>
                        <span>Diverse</span>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">Max Tokens</span>
                    <span className="text-green-400 font-mono">{maxTokens}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="4000"
                    step="100"
                    value={maxTokens}
                    onChange={e => setMaxTokens(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-600 rounded-full appearance-none cursor-pointer accent-green-500"
                  />
                </div>
              </div>

              {/* Sample Prompts */}
              <div className="flex gap-2 flex-wrap">
                {SAMPLE_PROMPTS.map((sample, i) => (
                  <button
                    key={i}
                    onClick={() => setUserPrompt(sample.prompt)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs transition-colors"
                  >
                    {sample.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column - Prompts & Results */}
            <div className="space-y-4">
              {/* System Prompt */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">System Prompt</label>
                <textarea
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  className="w-full h-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
                  placeholder="System instructions..."
                />
              </div>

              {/* User Prompt */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">User Prompt (Market Data)</label>
                <textarea
                  value={userPrompt}
                  onChange={e => setUserPrompt(e.target.value)}
                  className="w-full h-32 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="Enter market data or question..."
                />
              </div>

              {/* Run Button */}
              <button
                onClick={runTest}
                disabled={isLoading || !userPrompt.trim()}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-400 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Running Test...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Run Test
                  </>
                )}
              </button>

              {/* Results */}
              {results.length > 0 && (
                <div className="space-y-3 max-h-64 overflow-auto">
                  {results.map((result, i) => (
                    <div key={i} className="bg-slate-700/50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-yellow-400" />
                          <span className="font-medium text-sm">{result.provider} / {result.model}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{result.latencyMs}ms</span>
                          <span>{result.tokens.total} tokens</span>
                          {result.cost && <span className="text-green-400">${result.cost.toFixed(4)}</span>}
                          <button onClick={() => copyToClipboard(result.response)} className="hover:text-white">
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono bg-slate-800/50 rounded-lg p-3 max-h-40 overflow-auto">
                        {result.response}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <span>Tip: For trading, use low temperature (0.1-0.3) for consistency</span>
          <button 
            onClick={() => setResults([])}
            className="flex items-center gap-1 hover:text-white"
          >
            <RotateCcw className="w-3 h-3" />
            Clear Results
          </button>
        </div>
      </div>
    </div>
  )
}

export default AIPlayground
