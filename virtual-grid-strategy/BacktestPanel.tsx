/**
 * Backtest Panel for Hamburger Bot
 * GUI for running backtests with real Hyperliquid data
 */

import React, { useState, useEffect } from 'react'
import { Play, Pause, Download, Settings, TrendingUp, AlertCircle } from 'lucide-react'

// Types
interface BacktestConfig {
  symbol: string
  startDate: string
  endDate: string
  initialCapital: number
  leverage: number
  gridSpacing: number
  aggressiveness: 'low' | 'medium' | 'high'
  confidenceThreshold: number
}

interface BacktestResult {
  metrics: {
    totalReturn: number
    totalReturnPct: number
    sharpeRatio: number
    maxDrawdown: number
    winRate: number
    profitFactor: number
    totalTrades: number
    totalFees: number
  }
  trades: Array<{
    entryTime: number
    exitTime: number
    entryPrice: number
    exitPrice: number
    side: 'long' | 'short'
    pnl: number
    exitReason: string
  }>
  equityCurve: Array<{ timestamp: number; equity: number }>
  decisions: Array<{
    action: string
    confidence: number
    reasoning: string
    timestamp: number
  }>
}

interface SymbolInfo {
  name: string
  maxLeverage: number
  isTradable: boolean
}

// Available symbols with their max leverage
const AVAILABLE_SYMBOLS: SymbolInfo[] = [
  // 40x leverage
  { name: 'BTC', maxLeverage: 40, isTradable: true },
  { name: 'ETH', maxLeverage: 40, isTradable: true },
  { name: 'SOL', maxLeverage: 40, isTradable: true },
  { name: 'XRP', maxLeverage: 40, isTradable: true },
  // 20x leverage
  { name: 'DOGE', maxLeverage: 20, isTradable: true },
  { name: 'SUI', maxLeverage: 20, isTradable: true },
  { name: 'WLD', maxLeverage: 20, isTradable: true },
  { name: 'LTC', maxLeverage: 20, isTradable: true },
  { name: 'LINK', maxLeverage: 20, isTradable: true },
  { name: 'AVAX', maxLeverage: 20, isTradable: true },
  { name: 'HYPE', maxLeverage: 20, isTradable: true },
  { name: 'TIA', maxLeverage: 20, isTradable: true },
  { name: 'APT', maxLeverage: 20, isTradable: true },
  { name: 'NEAR', maxLeverage: 20, isTradable: true },
  // 10x leverage
  { name: 'OP', maxLeverage: 10, isTradable: true },
  { name: 'ARB', maxLeverage: 10, isTradable: true },
  { name: 'LDO', maxLeverage: 10, isTradable: true },
  { name: 'TON', maxLeverage: 10, isTradable: true },
  { name: 'BNB', maxLeverage: 10, isTradable: true },
  { name: 'DOT', maxLeverage: 10, isTradable: true },
  // 5x leverage
  { name: 'AAVE', maxLeverage: 5, isTradable: true },
  { name: 'UNI', maxLeverage: 5, isTradable: true },
  // 3x leverage (stablecoins)
  { name: 'USDC', maxLeverage: 3, isTradable: true },
  { name: 'USDT', maxLeverage: 3, isTradable: true }
]

export default function BacktestPanel() {
  const [config, setConfig] = useState<BacktestConfig>({
    symbol: 'BTC',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 10000,
    leverage: 10,
    gridSpacing: 1.0,
    aggressiveness: 'medium',
    confidenceThreshold: 70
  })

  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Get max leverage for selected symbol
  const getMaxLeverage = () => {
    const symbol = AVAILABLE_SYMBOLS.find(s => s.name === config.symbol)
    return symbol?.maxLeverage || 3
  }

  // Handle config changes
  const handleConfigChange = (field: keyof BacktestConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }))
    
    // Auto-adjust leverage if it exceeds max
    if (field === 'symbol') {
      const maxLeverage = getMaxLeverage()
      if (config.leverage > maxLeverage) {
        setConfig(prev => ({ ...prev, leverage: maxLeverage }))
      }
    }
  }

  // Run backtest
  const runBacktest = async () => {
    setIsRunning(true)
    setProgress(0)
    setError(null)
    setResult(null)

    try {
      // Call the backtest API
      const response = await fetch('/api/backtest/hamburger/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: config.symbol,
          startTime: new Date(config.startDate).getTime(),
          endTime: new Date(config.endDate).getTime(),
          config: {
            totalInvestmentUsd: config.initialCapital,
            leverage: config.leverage,
            gridSpacing: config.gridSpacing,
            aiAggressiveness: config.aggressiveness,
            aiConfidenceThreshold: config.confidenceThreshold,
            stopLossPct: 3.0,
            takeProfitPct: 2.0
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to run backtest: ${response.statusText}`)
      }

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const data = await response.json()
      
      clearInterval(progressInterval)
      setProgress(100)
      setResult(data)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsRunning(false)
    }
  }

  // Download results
  const downloadResults = () => {
    if (!result) return

    const dataStr = JSON.stringify(result, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `backtest-${config.symbol}-${new Date().toISOString().split('T')[0]}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Hamburger Bot Backtesting</h1>
        <p className="text-gray-600">Test your strategy with real Hyperliquid historical data</p>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          Configuration
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Symbol */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trading Pair
            </label>
            <select
              value={config.symbol}
              onChange={(e) => handleConfigChange('symbol', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isRunning}
            >
              {AVAILABLE_SYMBOLS.map(symbol => (
                <option key={symbol.name} value={symbol.name}>
                  {symbol.name} (Max {symbol.maxLeverage}x)
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={config.startDate}
              onChange={(e) => handleConfigChange('startDate', e.target.value)}
              max={config.endDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isRunning}
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={config.endDate}
              onChange={(e) => handleConfigChange('endDate', e.target.value)}
              min={config.startDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isRunning}
            />
          </div>

          {/* Initial Capital */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial Capital
            </label>
            <input
              type="number"
              value={config.initialCapital}
              onChange={(e) => handleConfigChange('initialCapital', Number(e.target.value))}
              min="100"
              step="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isRunning}
            />
          </div>

          {/* Leverage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leverage (Max: {getMaxLeverage()}x)
            </label>
            <input
              type="number"
              value={config.leverage}
              onChange={(e) => handleConfigChange('leverage', Math.min(Number(e.target.value), getMaxLeverage()))}
              min="1"
              max={getMaxLeverage()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isRunning}
            />
          </div>

          {/* Grid Spacing */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grid Spacing (%)
            </label>
            <input
              type="number"
              value={config.gridSpacing}
              onChange={(e) => handleConfigChange('gridSpacing', Number(e.target.value))}
              min="0.1"
              max="5"
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isRunning}
            />
          </div>

          {/* Aggressiveness */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AI Aggressiveness
            </label>
            <select
              value={config.aggressiveness}
              onChange={(e) => handleConfigChange('aggressiveness', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isRunning}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Confidence Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confidence Threshold (%)
            </label>
            <input
              type="number"
              value={config.confidenceThreshold}
              onChange={(e) => handleConfigChange('confidenceThreshold', Number(e.target.value))}
              min="50"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isRunning}
            />
          </div>
        </div>

        {/* Run Button */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={runBacktest}
            disabled={isRunning}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Running... {progress}%
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Backtest
              </>
            )}
          </button>
          
          {error && (
            <div className="flex items-center text-red-600">
              <AlertCircle className="w-4 h-4 mr-1" />
              {error}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Backtest Results
            </h2>
            <button
              onClick={downloadResults}
              className="flex items-center px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              <Download className="w-4 h-4 mr-1" />
              Download JSON
            </button>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Total Return</div>
              <div className={`text-2xl font-bold ${result.metrics.totalReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(result.metrics.totalReturnPct)}
              </div>
              <div className="text-sm text-gray-500">
                {formatCurrency(result.metrics.totalReturn)}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Sharpe Ratio</div>
              <div className="text-2xl font-bold text-gray-900">
                {result.metrics.sharpeRatio.toFixed(2)}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Max Drawdown</div>
              <div className="text-2xl font-bold text-red-600">
                {formatPercentage(result.metrics.maxDrawdown)}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Win Rate</div>
              <div className="text-2xl font-bold text-gray-900">
                {result.metrics.winRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">
                {result.metrics.totalTrades} trades
              </div>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-sm text-gray-600">Profit Factor</div>
              <div className="text-lg font-semibold">{result.metrics.profitFactor.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Total Fees</div>
              <div className="text-lg font-semibold">{formatCurrency(result.metrics.totalFees)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Final Equity</div>
              <div className="text-lg font-semibold">
                {formatCurrency(config.initialCapital + result.metrics.totalReturn)}
              </div>
            </div>
          </div>

          {/* Recent Trades */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Recent Trades</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Side</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Entry</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Exit</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PnL</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {result.trades.slice(-10).reverse().map((trade, index) => (
                    <tr key={index}>
                      <td className={`px-4 py-2 text-sm font-medium ${trade.side === 'long' ? 'text-green-600' : 'text-red-600'}`}>
                        {trade.side.toUpperCase()}
                      </td>
                      <td className="px-4 py-2 text-sm">${trade.entryPrice.toFixed(4)}</td>
                      <td className="px-4 py-2 text-sm">${trade.exitPrice.toFixed(4)}</td>
                      <td className={`px-4 py-2 text-sm font-medium ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(trade.pnl)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">{trade.exitReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
