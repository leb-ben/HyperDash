import { Droplets, ExternalLink, Wallet, AlertCircle } from 'lucide-react'

interface Props {
  walletAddress: string
  isTestnet: boolean
  isPaperTrading: boolean
}

export function TestnetFaucet({ walletAddress, isTestnet, isPaperTrading }: Props) {
  const getTestnetBalance = async () => {
    // This would check the actual testnet balance
    // For now, return a placeholder
    return '0.00'
  }

  const openFaucet = () => {
    // Hyperliquid testnet faucet URL
    window.open('https://testnet.hyperliquid.xyz/faucet', '_blank')
  }

  const openTestnet = () => {
    window.open('https://testnet.hyperliquid.xyz/', '_blank')
  }

  if (!isTestnet) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-semibold">Testnet Mode</span>
        </div>
        <div className="text-xs text-slate-400 text-center py-4">
          Testnet mode is disabled. Enable HYPERLIQUID_TESTNET=true in .env to use testnet features.
        </div>
      </div>
    )
  }

  if (isPaperTrading) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <Droplets className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold">Testnet Faucet</span>
          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full ml-auto">
            Paper Mode
          </span>
        </div>
        <div className="space-y-3">
          <div className="text-xs text-slate-400">
            Currently in paper trading mode. To use real testnet tokens:
          </div>
          <div className="bg-slate-700/30 rounded-lg p-2 text-xs">
            <div className="font-mono text-slate-300 mb-1">1. Set PAPER_TRADING=false in .env</div>
            <div className="font-mono text-slate-300 mb-1">2. Configure your wallet address</div>
            <div className="font-mono text-slate-300">3. Restart the bot</div>
          </div>
          <button 
            onClick={openFaucet}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Visit Faucet (for when ready)
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-3">
        <Droplets className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold">Testnet Faucet</span>
        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full ml-auto">
          Testnet Active
        </span>
      </div>
      
      <div className="space-y-3">
        {/* Wallet Info */}
        <div className="bg-slate-700/30 rounded-lg p-2">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-3 h-3 text-slate-400" />
            <span className="text-xs font-medium text-slate-300">Wallet Address</span>
          </div>
          <div className="text-xs font-mono text-slate-400 break-all">
            {walletAddress || 'Not configured'}
          </div>
        </div>

        {/* Instructions */}
        <div className="text-xs text-slate-400">
          Get test tokens to trade on Hyperliquid testnet:
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button 
            onClick={openFaucet}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
          >
            <Droplets className="w-4 h-4" />
            Get Test Tokens
          </button>
          
          <button 
            onClick={openTestnet}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open Testnet Exchange
          </button>
        </div>

        {/* Status Info */}
        <div className="text-xs text-slate-500 bg-slate-700/20 rounded-lg p-2">
          <div className="font-medium mb-1">After getting tokens:</div>
          <ul className="space-y-0.5">
            <li>• Tokens appear in your testnet wallet</li>
            <li>• Bot will use real testnet for trading</li>
            <li>• No real money at risk</li>
            <li>• Test tokens reset periodically</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default TestnetFaucet
