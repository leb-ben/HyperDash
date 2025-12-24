import { useState, useRef, useEffect } from 'react'
import { 
  MessageCircle, 
  Send, 
  X,
  Bot,
  User,
  Loader2,
  Minimize2,
  Maximize2,
  Wrench,
  AlertCircle
} from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  toolCalls?: { tool: string; result: string }[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onMinimize: () => void
  isMinimized: boolean
}

const API_BASE = 'http://localhost:3001'

// Sample prompts for users
const SAMPLE_PROMPTS = [
  "Add DOGE to the trading rotation",
  "Remove SOL from tracking",
  "What's my current P&L?",
  "Pause trading for 1 hour",
  "Create a scalping bot for ETH",
  "What tokens am I trading?"
]

export function ChatInterface({ isOpen, onClose, onMinimize, isMinimized }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hi! I'm your trading assistant. I can help you:

• **Add/remove tokens** from the trading rotation
• **Start/stop** the bot or specific strategies
• **Check status** and performance
• **Create new bot sessions** with different strategies
• **Modify settings** on the fly

What would you like to do?`,
      timestamp: Date.now()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [buildMode, setBuildMode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input,
          buildMode,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
        })
      })

      if (res.ok) {
        const data = await res.json()
        const assistantMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: Date.now(),
          toolCalls: data.toolCalls
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error('Failed to get response')
      }
    } catch (e) {
      // Simulate response for demo
      const simulatedResponse = simulateResponse(input)
      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: simulatedResponse.content,
        timestamp: Date.now(),
        toolCalls: simulatedResponse.toolCalls
      }
      setMessages(prev => [...prev, assistantMessage])
    }

    setIsLoading(false)
  }

  // Simulate responses for demo (when API not connected)
  const simulateResponse = (userInput: string): { content: string; toolCalls?: { tool: string; result: string }[] } => {
    const lower = userInput.toLowerCase()
    
    if (lower.includes('add') && (lower.includes('token') || lower.includes('doge') || lower.includes('coin'))) {
      const token = lower.match(/add\s+(\w+)/)?.[1]?.toUpperCase() || 'TOKEN'
      return {
        content: `I've added **${token}** to the trading rotation. The bot will start analyzing it on the next cycle.\n\nCurrent tracked tokens: BTC, ETH, SOL, HYPE, JUP, ${token}`,
        toolCalls: [{ tool: 'addToken', result: `Added ${token} to rotation` }]
      }
    }
    
    if (lower.includes('remove') || lower.includes('stop tracking')) {
      const token = lower.match(/remove\s+(\w+)/)?.[1]?.toUpperCase() || 
                   lower.match(/stop tracking\s+(\w+)/)?.[1]?.toUpperCase() || 'TOKEN'
      return {
        content: `I've removed **${token}** from the trading rotation. Any open positions will be closed.\n\nRemaining tokens: BTC, ETH, HYPE, JUP`,
        toolCalls: [{ tool: 'removeToken', result: `Removed ${token}` }]
      }
    }

    if (lower.includes('p&l') || lower.includes('pnl') || lower.includes('profit') || lower.includes('performance')) {
      return {
        content: `**Current Performance**\n\n• Portfolio Value: **$512.45**\n• 24h P&L: **+$12.45 (+2.49%)**\n• Win Rate: **67.5%**\n• Total Trades: **23**\n\nBest performer: BTC (+4.2%)\nWorst performer: SOL (-1.8%)`,
        toolCalls: [{ tool: 'getPerformance', result: 'Retrieved stats' }]
      }
    }

    if (lower.includes('pause') || lower.includes('stop')) {
      return {
        content: `Bot has been **paused**. Auto-trading is now disabled.\n\nTo resume, just say "start trading" or "resume".`,
        toolCalls: [{ tool: 'pauseBot', result: 'Bot paused' }]
      }
    }

    if (lower.includes('start') || lower.includes('resume')) {
      return {
        content: `Bot has been **started**! Auto-trading is now active.\n\nNext analysis cycle in ~5 minutes.`,
        toolCalls: [{ tool: 'startBot', result: 'Bot started' }]
      }
    }

    if (lower.includes('create') && (lower.includes('bot') || lower.includes('session') || lower.includes('strategy'))) {
      const strategy = lower.includes('scalp') ? 'scalping' : 
                      lower.includes('grid') ? 'grid' : 
                      lower.includes('momentum') ? 'momentum' : 'custom'
      return {
        content: `Creating new bot session with **${strategy}** strategy...\n\n**Build Mode Required**\n\nTo create custom strategies, I need to pause the main bot and enter build mode. This ensures safe configuration without interfering with active trades.\n\nWould you like me to:\n1. Enter build mode (pauses main bot)\n2. Configure alongside running bot (limited options)`,
        toolCalls: []
      }
    }

    if (lower.includes('tokens') || lower.includes('trading what') || lower.includes('what am i trading')) {
      return {
        content: `**Currently Tracked Tokens**\n\n• **BTC** - Max 25%, 3x leverage\n• **ETH** - Max 20%, 3x leverage\n• **SOL** - Max 15%, 3x leverage\n• **HYPE** - Max 10%, 3x leverage\n• **JUP** - Max 10%, 3x leverage\n\nWant me to add or remove any?`,
        toolCalls: [{ tool: 'getTokens', result: 'Listed tokens' }]
      }
    }

    if (lower.includes('build mode')) {
      return {
        content: `**Build Mode** ${buildMode ? 'is currently ACTIVE' : 'is currently OFF'}.\n\nIn build mode:\n• Main bot auto-trading is paused\n• You can safely modify strategies\n• Create new bot sessions\n• Edit configurations\n\nSay "enter build mode" or "exit build mode" to toggle.`,
        toolCalls: []
      }
    }

    return {
      content: `I understand you want to: "${userInput}"\n\nI can help with:\n• Adding/removing tokens\n• Checking performance\n• Starting/stopping the bot\n• Creating new strategies\n\nCould you be more specific about what you'd like to do?`,
      toolCalls: []
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isOpen) return null

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={onMinimize}
          className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-full shadow-lg hover:scale-105 transition-transform"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-1.5 rounded-lg">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold">Trading Assistant</span>
            {buildMode && (
              <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                Build Mode
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setBuildMode(!buildMode)}
            className={`p-1.5 rounded transition-colors ${
              buildMode ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-slate-700 text-slate-400'
            }`}
            title="Toggle Build Mode"
          >
            <Wrench className="w-4 h-4" />
          </button>
          <button
            onClick={onMinimize}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Build Mode Banner */}
      {buildMode && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-400">Build Mode: Auto-trading paused for safe configuration</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              msg.role === 'user' 
                ? 'bg-blue-500/20' 
                : 'bg-gradient-to-br from-purple-500/20 to-pink-500/20'
            }`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
              <div className={`p-3 rounded-xl ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700'
              }`}>
                <div 
                  className="text-sm whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ 
                    __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                  }}
                />
              </div>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {msg.toolCalls.map((tc, i) => (
                    <span key={i} className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                      ✓ {tc.tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-700 p-3 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t border-slate-700">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {SAMPLE_PROMPTS.slice(0, 3).map((prompt, i) => (
            <button
              key={i}
              onClick={() => setInput(prompt)}
              className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded whitespace-nowrap transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything..."
            className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 p-2 rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatInterface
