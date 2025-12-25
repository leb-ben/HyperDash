import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react'
import { 
  DollarSign, Brain,
  Zap, Settings, Send, Shield
} from 'lucide-react'
import SafetySettings from './components/SafetySettings.js';
import XTerminal from './components/XTerminal.js';
import BotLogs from './components/BotLogs.js';
import LivePrices from './components/LivePrices.js';
import ActiveSignals from './components/ActiveSignals.js';
import PortfolioHistoryChart from './components/PortfolioHistoryChart.js';
import SystemStatus from './components/SystemStatus.js';
import BotControl from './components/BotControl.js';
import PnLDashboard from './components/PnLDashboard.js';
import BandwidthMonitor from './components/BandwidthMonitor.js';
import RiskSettingsPanel from './components/RiskSettingsPanel.js';
import ManualPositionControl from './components/ManualPositionControl.js';
import LiveAnalysisView from './components/LiveAnalysisView.js';
import PerformanceCharts from './components/PerformanceCharts.js';
import AlertSystem from './components/AlertSystem.js';
import AIConfigModal from './components/AIConfigModal.js';
import SettingsPanel from './components/SettingsPanel.js';
import StrategiesPanel from './components/StrategiesPanel.js';

// Error Boundary to catch runtime errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
          <div className="bg-red-900/50 border border-red-500 rounded-xl p-6 max-w-2xl">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Dashboard Error</h1>
            <p className="text-red-300 mb-4">The dashboard encountered an error:</p>
            <pre className="bg-slate-800 p-4 rounded text-sm text-red-200 overflow-auto">
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 rounded text-white"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Types
interface Position {
  symbol: string
  side: 'long' | 'short'
  size: number
  entryPrice: number
  currentPrice: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  leverage: number
}

interface Signal {
  id: string
  symbol: string
  type: string
  direction: string
  strength: number
  urgency: number
  price: number
  timestamp: number
}

interface ActivityEvent {
  id: string
  timestamp: number
  type: string
  source: string
  message: string
}

interface SystemState {
  bot: { running: boolean; cycleCount: number; lastCycleTime: number; mode: string }
  config?: {
    walletAddress: string
    testnet: boolean
    paperTrading: boolean
  }
  portfolio: { totalValue: number; availableBalance: number; positions: Position[] }
  realWallet?: { totalValue: number; availableBalance: number; positions: Position[] }
  mainnetWallet?: { totalValue: number; availableBalance: number; positions: Position[] }
  signals: { active: Signal[]; stats: { totalSignals: number; activeSignals: number } }
  prices: Record<string, { price: number; change24h: number; volume24h: number }>
  executor: { totalExecutions: number; successfulExecutions: number; totalFees: number }
  safety: { globalStopLossEnabled: boolean; stopLossPercentage: number; isKilled: boolean }
  errors: { total: number }
  ai?: { model?: string; models?: any[] }
  activity?: ActivityEvent[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const API_BASE = '/api'

function App() {
  const [system, setSystem] = useState<SystemState | null>(null)
  const [chartData, setChartData] = useState<{time: string; value: number}[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showSafetySettings, setShowSafetySettings] = useState(false)
  const [showAIConfig, setShowAIConfig] = useState(false)
  const [showPositionControl, setShowPositionControl] = useState(false)
  const [activeTab, setActiveTab] = useState<'signals' | 'logs' | 'terminal' | 'pnl' | 'bandwidth' | 'risk' | 'analysis' | 'performance' | 'strategies' | 'settings'>('signals')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('tradingbot_chat_history')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return [{ role: 'assistant', content: 'Hello! I\'m your trading assistant. Try "status", "signals", "positions", or "help" for commands.', timestamp: Date.now() }]
      }
    }
    return [{ role: 'assistant', content: 'Hello! I\'m your trading assistant. Try "status", "signals", "positions", or "help" for commands.', timestamp: Date.now() }]
  })
  const [chatInput, setChatInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Fetch system state
  const fetchSystem = async () => {
    try {
      const res = await fetch(`${API_BASE}/system`)
      if (res.ok) {
        const data = await res.json()
        setSystem(data)
        // Update chart with portfolio value
        setChartData(prev => {
          const newPoint = { time: new Date().toLocaleTimeString(), value: data.portfolio?.totalValue || 0 }
          const updated = [...prev, newPoint].slice(-30)
          return updated
        })
      }
    } catch (e) {
      console.error('Failed to fetch system state:', e)
    }
  }

  // Bot control
  const startBot = async () => {
    try {
      await fetch(`${API_BASE}/bot/start`, { method: 'POST' })
      fetchSystem()
    } catch (e) { console.error(e) }
  }

  const stopBot = async () => {
    try {
      await fetch(`${API_BASE}/bot/stop`, { method: 'POST' })
      fetchSystem()
    } catch (e) { console.error(e) }
  }

  // Chat
  const sendChat = async () => {
    if (!chatInput.trim()) return
    const userMsg: ChatMessage = { role: 'user', content: chatInput, timestamp: Date.now() }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setIsLoading(true)
    
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatInput })
      })
      const data = await res.json()
      const assistantMsg: ChatMessage = { role: 'assistant', content: data.response, timestamp: Date.now() }
      setChatMessages(prev => [...prev, assistantMsg])
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Failed to get response', timestamp: Date.now() }])
    }
    setIsLoading(false)
  }

  // Auto-scroll chat and persist to localStorage
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    localStorage.setItem('tradingbot_chat_history', JSON.stringify(chatMessages))
  }, [chatMessages])

  // Polling
  useEffect(() => {
    fetchSystem()
    const interval = setInterval(() => {
      fetchSystem()
      setCurrentTime(new Date())
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const formatCurrency = (value: number) => `$${value?.toFixed(2) || '0.00'}`

  if (!system) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-400">Connecting to Trading Bot...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Trading Bot</h1>
              <p className="text-slate-400 text-xs">Full Transparency Mode</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Bot Controls */}
            <BotControl 
              isRunning={system.bot.running} 
              onStart={startBot} 
              onStop={stopBot} 
            />

            <button onClick={() => setShowAIConfig(true)} className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm">
              <Settings className="w-4 h-4" />AI Config
            </button>

            <button onClick={() => setShowSafetySettings(true)} className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm">
              <Shield className="w-4 h-4" />Safety
            </button>

            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${system.bot.running ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
              <div className={`w-2 h-2 rounded-full ${system.bot.running ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
              {system.bot.running ? 'RUNNING' : 'STOPPED'}
            </div>

            <div className="text-slate-400 text-sm">{currentTime.toLocaleTimeString()}</div>
          </div>
        </div>
      </header>

      {/* Main Content - 3 Column Layout */}
      <div className="grid grid-cols-12 gap-4 p-4 h-[calc(100vh-80px)]">
        
        {/* Left Column - Portfolio & Positions */}
        <div className="col-span-3 space-y-4 overflow-auto">
          {/* Main Portfolio Card - shows real wallet in live mode */}
          <div className={`rounded-xl p-4 border ${system.bot.mode === 'live' ? 'bg-gradient-to-br from-green-900/30 to-emerald-900/20 border-green-700/30' : 'bg-slate-800/50 border-slate-700/50'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={system.bot.mode === 'live' ? 'text-green-400 text-sm' : 'text-slate-400 text-sm'}>
                {system.bot.mode === 'live' 
                  ? `Live Wallet ${system.config?.testnet ? '(Testnet)' : ''}` 
                  : 'Paper Portfolio'}
              </span>
              <DollarSign className={`w-4 h-4 ${system.bot.mode === 'live' ? 'text-green-500' : 'text-slate-500'}`} />
            </div>
            <div className={`text-2xl font-bold mb-1 ${system.bot.mode === 'live' ? 'text-green-400' : ''}`}>
              {formatCurrency(system.bot.mode === 'live' && system.realWallet ? system.realWallet.totalValue : system.portfolio.totalValue)}
            </div>
            <div className={`text-sm ${system.bot.mode === 'live' ? 'text-green-300/70' : 'text-slate-400'}`}>
              Available: {formatCurrency(system.bot.mode === 'live' && system.realWallet ? system.realWallet.availableBalance : system.portfolio.availableBalance)}
            </div>
          </div>
          
          {/* Mainnet Wallet Card (Real Money) */}
          {system.mainnetWallet && (
            <div className="bg-gradient-to-br from-yellow-900/20 to-amber-900/10 rounded-xl p-4 border border-yellow-700/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-yellow-400 text-sm">Mainnet (Real)</span>
                <DollarSign className="w-4 h-4 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold text-yellow-400 mb-1">{formatCurrency(system.mainnetWallet.totalValue)}</div>
              <div className="text-sm text-yellow-300/70">Available: {formatCurrency(system.mainnetWallet.availableBalance)}</div>
              {system.mainnetWallet.positions.length > 0 && (
                <div className="text-xs text-yellow-400/60 mt-1">{system.mainnetWallet.positions.length} position(s)</div>
              )}
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
              <div className="text-slate-400 text-xs mb-1">Cycle</div>
              <div className="text-lg font-bold text-blue-400">#{system.bot.cycleCount}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
              <div className="text-slate-400 text-xs mb-1">Trades</div>
              <div className="text-lg font-bold">{system.executor.successfulExecutions}</div>
            </div>
          </div>

          {/* Positions */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Open Positions</span>
              <button 
                onClick={() => setShowPositionControl(true)}
                className="text-xs px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded"
              >
                Manage
              </button>
            </div>
            {system.portfolio.positions.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-4">No open positions</div>
            ) : (
              <div className="space-y-2">
                {system.portfolio.positions.map((pos, i) => (
                  <div key={i} className="bg-slate-700/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{pos.symbol}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${pos.side === 'long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {pos.side.toUpperCase()} {pos.leverage}x
                        </span>
                      </div>
                      <span className={`text-sm font-semibold ${pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pos.unrealizedPnl >= 0 ? '+' : ''}{pos.unrealizedPnl?.toFixed(2) || '0.00'}%
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Entry: ${pos.entryPrice?.toFixed(2)} {'->'} ${pos.currentPrice?.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chart */}
          <PortfolioHistoryChart data={chartData} />
        </div>

        {/* Center Column - Tabbed View */}
        <div className="col-span-6 space-y-4 overflow-auto">
          {/* Live Prices */}
          <LivePrices prices={system.prices || {}} />

          {/* Tabbed Interface */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col" style={{ height: 'calc(100vh - 300px)' }}>
            {/* Tab Headers */}
            <div className="flex border-b border-slate-700 overflow-x-auto">
              <button
                onClick={() => setActiveTab('signals')}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'signals'
                    ? 'bg-slate-700/50 text-blue-400 border-b-2 border-blue-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Active Signals
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'logs'
                    ? 'bg-slate-700/50 text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Bot Diagnostics
              </button>
              <button
                onClick={() => setActiveTab('pnl')}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'pnl'
                    ? 'bg-slate-700/50 text-green-400 border-b-2 border-green-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                P&L Tracking
              </button>
              <button
                onClick={() => setActiveTab('bandwidth')}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'bandwidth'
                    ? 'bg-slate-700/50 text-yellow-400 border-b-2 border-yellow-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Bandwidth
              </button>
              <button
                onClick={() => setActiveTab('risk')}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'risk'
                    ? 'bg-slate-700/50 text-purple-400 border-b-2 border-purple-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Risk Settings
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'analysis'
                    ? 'bg-slate-700/50 text-orange-400 border-b-2 border-orange-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Live Analysis
              </button>
              <button
                onClick={() => setActiveTab('performance')}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'performance'
                    ? 'bg-slate-700/50 text-pink-400 border-b-2 border-pink-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Performance
              </button>
              <button
                onClick={() => setActiveTab('terminal')}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'terminal'
                    ? 'bg-slate-700/50 text-green-400 border-b-2 border-green-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Terminal
              </button>
              <button
                onClick={() => setActiveTab('strategies')}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'strategies'
                    ? 'bg-slate-700/50 text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Strategies
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-slate-700/50 text-slate-300 border-b-2 border-slate-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Settings
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'signals' && (
                <div className="h-full overflow-auto p-4">
                  <ActiveSignals signals={system.signals?.active || []} />
                </div>
              )}
              
              {activeTab === 'logs' && (
                <div className="h-full">
                  <BotLogs className="h-full" />
                </div>
              )}

              {activeTab === 'pnl' && (
                <div className="h-full overflow-auto p-4">
                  <PnLDashboard />
                </div>
              )}

              {activeTab === 'bandwidth' && (
                <div className="h-full overflow-auto p-4">
                  <BandwidthMonitor />
                </div>
              )}

              {activeTab === 'risk' && (
                <div className="h-full overflow-auto p-4">
                  <RiskSettingsPanel />
                </div>
              )}

              {activeTab === 'analysis' && (
                <div className="h-full overflow-auto p-4">
                  <LiveAnalysisView />
                </div>
              )}

              {activeTab === 'performance' && (
                <div className="h-full overflow-auto p-4">
                  <PerformanceCharts />
                </div>
              )}
              
              {activeTab === 'terminal' && (
                <div className="h-full p-4">
                  <XTerminal className="h-full" />
                </div>
              )}

              {activeTab === 'strategies' && (
                <div className="h-full overflow-auto p-4">
                  <StrategiesPanel />
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="h-full overflow-auto p-4">
                  <SettingsPanel />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Chat & Controls */}
        <div className="col-span-3 flex flex-col space-y-4">
          {/* System Status */}
          <SystemStatus system={system} />

          {/* Alert System */}
          <AlertSystem />

          {/* Chat Interface */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between p-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold">AI Assistant</span>
              </div>
              <button
                onClick={() => {
                  setChatMessages([{ role: 'assistant', content: 'Chat history cleared. How can I help you?', timestamp: Date.now() }])
                  localStorage.removeItem('tradingbot_chat_history')
                }}
                className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-400"
              >
                Clear
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-2 rounded-lg text-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-500/20 text-blue-100' 
                      : 'bg-slate-700/50 text-slate-200'
                  }`}>
                    <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-700/50 p-2 rounded-lg text-sm text-slate-400">
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            <div className="p-3 border-t border-slate-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                  placeholder="Type a command..."
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <button onClick={sendChat} className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg">
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-1 mt-2">
                {['status', 'signals', 'positions', 'prices'].map(cmd => (
                  <button key={cmd} onClick={() => { setChatInput(cmd); }} 
                    className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded">
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <SafetySettings isOpen={showSafetySettings} onClose={() => setShowSafetySettings(false)} />
      <AIConfigModal isOpen={showAIConfig} onClose={() => setShowAIConfig(false)} />
      {showPositionControl && (
        <ManualPositionControl 
          positions={system.portfolio.positions}
          onClose={() => setShowPositionControl(false)}
          onRefresh={fetchSystem}
        />
      )}
    </div>
  )
}

function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary
