"use client"

import { useState, useEffect, useCallback } from "react"
import { Settings, Play, Pause, RotateCcw, Plus, Save, Download, Upload, RefreshCw, Wifi, WifiOff, TrendingUp, TrendingDown, Activity } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"

import GridLadderView from "@/components/GridLadderView"
import FeeAnalysisPanel from "@/components/FeeAnalysisPanel"
import GridPerformancePanel from "@/components/GridPerformancePanel"
import GridSummaryCard from "@/components/GridSummaryCard"
import ToastContainer from "@/components/ToastContainer"

import { useToast } from "@/hooks/useToast"
import {
  saveGridConfig,
  loadGridConfig,
  loadAllGridConfigs,
  deleteGridConfig,
  saveGridLevels,
  loadGridLevels,
  generateGridId,
  exportGridData,
  importGridData,
} from "@/lib/gridStorage"
import {
  checkBackendHealth,
  getCurrentPrice,
  startGrid as apiStartGrid,
  stopGrid as apiStopGrid,
  rebalanceGrid as apiRebalanceGrid,
} from "@/lib/gridApi"

import type { VirtualGridConfig, GridLevel, GridSummary } from "@/types"

// Hamburger Bot specific configuration
const HAMBURGER_DEFAULT_CONFIG: VirtualGridConfig = {
  id: "",
  symbol: "BTC",
  enabled: false,
  centerPrice: 50000,
  gridCount: 50, // Infinite virtual levels
  gridSpacingPct: 1.0,
  totalInvestmentUsd: 1000,
  leverage: 10,
  typicalRealPositions: 2,
  maxRealPositions: 4,
  rebalanceThresholdPct: 0.5,
  minProfitAfterFeesPct: 0.2,
}

// Leverage limits per symbol group
const LEVERAGE_LIMITS = {
  '40x': ['BTC', 'ETH', 'SOL', 'XRP'],
  '20x': ['DOGE', 'SUI', 'WLD', 'LTC', 'LINK', 'AVAX', 'HYPE', 'TIA', 'APT', 'NEAR'],
  '10x': ['OP', 'ARB', 'LDO', 'TON', 'JUP', 'SEI', 'BNB', 'DOT'],
  '3x': ['USDC', 'USDT', 'STABLE', 'MON', 'LIT', 'XPL']
}

export default function HamburgerGridPanel() {
  // State
  const [config, setConfig] = useState<VirtualGridConfig>({ ...HAMBURGER_DEFAULT_CONFIG, id: generateGridId() })
  const [levels, setLevels] = useState<GridLevel[]>([])
  const [currentPrice, setCurrentPrice] = useState<number>(50000)
  const [savedGrids, setSavedGrids] = useState<VirtualGridConfig[]>([])
  const [activeTab, setActiveTab] = useState<string>("configure")
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [selectedGridId, setSelectedGridId] = useState<string | null>(null)
  
  // Hamburger Bot specific state
  const [aiAggressiveness, setAiAggressiveness] = useState<'low' | 'medium' | 'high'>('medium')
  const [aiConfidence, setAiConfidence] = useState<number>(70)
  const [lastDecision, setLastDecision] = useState<string>('No decisions yet')
  const [decisionReasoning, setDecisionReasoning] = useState<string>('')
  const [signals, setSignals] = useState<{
    parabolicSAR: { value: number; isUptrend: boolean }
    atr: { value: number; multiplier: number }
    volume: { spikeMultiplier: number; isSpike: boolean }
    roc: { value: number; isPanic: boolean }
  }>({
    parabolicSAR: { value: 0, isUptrend: false },
    atr: { value: 0, multiplier: 0 },
    volume: { spikeMultiplier: 0, isSpike: false },
    roc: { value: 0, isPanic: false }
  })

  // Toast notifications
  const { toasts, success, error, warning, info, removeToast } = useToast()

  // Load saved grids on mount
  useEffect(() => {
    const grids = loadAllGridConfigs()
    setSavedGrids(grids)

    // Check backend health
    checkBackendHealth().then((healthy) => {
      setIsBackendConnected(healthy)
      if (!healthy) {
        warning("Backend Offline", "Running in local-only mode. Grid execution disabled.")
      }
    })

    // Load current price
    updateCurrentPrice()
    const interval = setInterval(updateCurrentPrice, 5000)
    return () => clearInterval(interval)
  }, [])

  // Update current price
  const updateCurrentPrice = async () => {
    try {
      const price = await getCurrentPrice(config.symbol)
      if (price) {
        setCurrentPrice(price)
        if (!config.centerPrice || config.centerPrice === 50000) {
          handleConfigChange("centerPrice", price)
        }
      }
    } catch (err) {
      console.error("Failed to fetch price:", err)
    }
  }

  // Generate infinite virtual grid levels
  useEffect(() => {
    if (!config.centerPrice || !config.gridSpacingPct) return

    const newLevels: GridLevel[] = []
    const spacingMultiplier = config.gridSpacingPct / 100
    
    // Generate 25 levels above center (shorts)
    for (let i = 1; i <= 25; i++) {
      const price = config.centerPrice * Math.pow(1 + spacingMultiplier, i)
      newLevels.push({
        id: `virtual_short_${i}`,
        price,
        side: "short",
        size: 0, // Virtual positions have no size
        sizeUsd: 0,
        distanceFromCenter: i,
        isReal: false,
        status: "pending",
        createdAt: Date.now()
      })
    }

    // Generate 25 levels below center (longs)
    for (let i = 1; i <= 25; i++) {
      const price = config.centerPrice * Math.pow(1 - spacingMultiplier, i)
      newLevels.push({
        id: `virtual_long_${i}`,
        price,
        side: "long",
        size: 0,
        sizeUsd: 0,
        distanceFromCenter: -i,
        isReal: false,
        status: "pending",
        createdAt: Date.now()
      })
    }

    // Sort by price
    newLevels.sort((a, b) => b.price - a.price)
    setLevels(newLevels)
  }, [config.centerPrice, config.gridSpacingPct])

  // Handle config changes
  const handleConfigChange = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  // Get max leverage for symbol
  const getMaxLeverage = (symbol: string): number => {
    for (const [tier, symbols] of Object.entries(LEVERAGE_LIMITS)) {
      if (symbols.includes(symbol.toUpperCase())) {
        return parseInt(tier)
      }
    }
    return 3 // Default
  }

  // Validate leverage
  const validateLeverage = (symbol: string, leverage: number): boolean => {
    return leverage <= getMaxLeverage(symbol)
  }

  // Create hamburger bot
  const handleCreateBot = async () => {
    if (!validateLeverage(config.symbol, config.leverage)) {
      error("Invalid Leverage", `Max leverage for ${config.symbol} is ${getMaxLeverage(config.leverage)}x`)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/grid/hamburger/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            ...config,
            aiAggressiveness,
            confidenceThreshold: aiConfidence / 100
          }
        })
      })

      const data = await response.json()
      if (data.success) {
        success("Bot Created", `Hamburger Bot created for ${config.symbol}`)
        setSelectedGridId(data.botId)
      } else {
        error("Creation Failed", data.message || "Failed to create bot")
      }
    } catch (err) {
      error("Network Error", "Failed to connect to backend")
    } finally {
      setIsLoading(false)
    }
  }

  // Start bot
  const handleStartBot = async () => {
    if (!selectedGridId) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/grid/hamburger/${selectedGridId}/start`, {
        method: 'POST'
      })

      const data = await response.json()
      if (data.success) {
        success("Bot Started", "Hamburger Bot is now running")
        setConfig(prev => ({ ...prev, enabled: true }))
      } else {
        error("Start Failed", data.message || "Failed to start bot")
      }
    } catch (err) {
      error("Network Error", "Failed to connect to backend")
    } finally {
      setIsLoading(false)
    }
  }

  // Stop bot
  const handleStopBot = async () => {
    if (!selectedGridId) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/grid/hamburger/${selectedGridId}/stop`, {
        method: 'POST'
      })

      const data = await response.json()
      if (data.success) {
        success("Bot Stopped", "Hamburger Bot has been stopped")
        setConfig(prev => ({ ...prev, enabled: false }))
      } else {
        error("Stop Failed", data.message || "Failed to stop bot")
      }
    } catch (err) {
      error("Network Error", "Failed to connect to backend")
    } finally {
      setIsLoading(false)
    }
  }

  // Manual rebalance
  const handleRebalance = async () => {
    if (!selectedGridId) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/grid/hamburger/${selectedGridId}/rebalance`, {
        method: 'POST'
      })

      const data = await response.json()
      if (data.success) {
        success("Rebalance Triggered", "Manual rebalance executed")
      } else {
        error("Rebalance Failed", data.message || "Failed to rebalance")
      }
    } catch (err) {
      error("Network Error", "Failed to connect to backend")
    } finally {
      setIsLoading(false)
    }
  }

  // Get signal color
  const getSignalColor = (isActive: boolean, isPositive: boolean = true) => {
    if (!isActive) return "bg-gray-500"
    return isPositive ? "bg-green-500" : "bg-red-500"
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hamburger Bot</h1>
          <p className="text-muted-foreground">
            AI-driven grid trading with 2-4 dynamic positions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isBackendConnected ? (
            <Badge variant="default" className="bg-green-500">
              <Wifi className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="destructive">
              <WifiOff className="h-3 w-3 mr-1" />
              Offline
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="configure">Configure</TabsTrigger>
              <TabsTrigger value="signals">Signals</TabsTrigger>
              <TabsTrigger value="positions">Positions</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            {/* Configure Tab */}
            <TabsContent value="configure" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Bot Configuration</CardTitle>
                  <CardDescription>
                    Configure your Hamburger Bot parameters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-4">
                      {/* Symbol */}
                      <div className="space-y-2">
                        <Label htmlFor="symbol">Trading Symbol</Label>
                        <Select
                          value={config.symbol}
                          onValueChange={(value) => handleConfigChange("symbol", value)}
                          disabled={config.enabled}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(LEVERAGE_LIMITS).flatMap(([tier, symbols]) =>
                              symbols.map(symbol => (
                                <SelectItem key={symbol} value={symbol}>
                                  {symbol} (Max {tier}x)
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Investment */}
                      <div className="space-y-2">
                        <Label htmlFor="investment">Total Investment ($)</Label>
                        <Input
                          id="investment"
                          type="number"
                          min="100"
                          value={config.totalInvestmentUsd}
                          onChange={(e) => handleConfigChange("totalInvestmentUsd", parseFloat(e.target.value) || 100)}
                          disabled={config.enabled}
                        />
                        <p className="text-xs text-muted-foreground">
                          Capital efficiency: ~95% utilization
                        </p>
                      </div>

                      {/* Grid Spacing */}
                      <div className="space-y-2">
                        <Label htmlFor="spacing">Grid Spacing (%)</Label>
                        <Slider
                          value={[config.gridSpacingPct]}
                          onValueChange={([value]) => handleConfigChange("gridSpacingPct", value)}
                          min={0.5}
                          max={5}
                          step={0.1}
                          disabled={config.enabled}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          {config.gridSpacingPct}% spacing
                        </p>
                      </div>

                      {/* Leverage */}
                      <div className="space-y-2">
                        <Label htmlFor="leverage">Leverage</Label>
                        <Slider
                          value={[config.leverage]}
                          onValueChange={([value]) => handleConfigChange("leverage", value)}
                          min={1}
                          max={getMaxLeverage(config.symbol)}
                          step={1}
                          disabled={config.enabled}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          {config.leverage}x (Max: {getMaxLeverage(config.symbol)}x)
                        </p>
                      </div>

                      {/* AI Configuration */}
                      <div className="border-t pt-4">
                        <h3 className="text-lg font-semibold mb-4">AI Configuration</h3>
                        
                        {/* Aggressiveness */}
                        <div className="space-y-2 mb-4">
                          <Label>AI Aggressiveness</Label>
                          <Select
                            value={aiAggressiveness}
                            onValueChange={(value: 'low' | 'medium' | 'high') => setAiAggressiveness(value)}
                            disabled={config.enabled}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low - Conservative</SelectItem>
                              <SelectItem value="medium">Medium - Balanced</SelectItem>
                              <SelectItem value="high">High - Aggressive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Confidence Threshold */}
                        <div className="space-y-2">
                          <Label>Confidence Threshold: {aiConfidence}%</Label>
                          <Slider
                            value={[aiConfidence]}
                            onValueChange={([value]) => setAiConfidence(value)}
                            min={50}
                            max={95}
                            step={5}
                            disabled={config.enabled}
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground">
                            Minimum confidence required to execute trades
                          </p>
                        </div>
                      </div>

                      {/* Control Buttons */}
                      <div className="flex gap-2 pt-4">
                        {!selectedGridId ? (
                          <Button
                            onClick={handleCreateBot}
                            disabled={isLoading || !isBackendConnected}
                            className="flex-1"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Bot
                          </Button>
                        ) : (
                          <>
                            <Button
                              onClick={config.enabled ? handleStopBot : handleStartBot}
                              disabled={isLoading || !isBackendConnected}
                              variant={config.enabled ? "destructive" : "default"}
                              className="flex-1"
                            >
                              {config.enabled ? (
                                <>
                                  <Pause className="h-4 w-4 mr-2" />
                                  Stop
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  Start
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={handleRebalance}
                              disabled={isLoading || !config.enabled || !isBackendConnected}
                              variant="outline"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Rebalance
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Signals Tab */}
            <TabsContent value="signals" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>AI Signals</CardTitle>
                  <CardDescription>
                    Real-time signal analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Parabolic SAR */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${signals.parabolicSAR.isUptrend ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="font-medium">Parabolic SAR</p>
                          <p className="text-sm text-muted-foreground">
                            ${signals.parabolicSAR.value.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={signals.parabolicSAR.isUptrend ? "default" : "destructive"}>
                        {signals.parabolicSAR.isUptrend ? "Uptrend" : "Downtrend"}
                      </Badge>
                    </div>

                    {/* Volume Spike */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Activity className={`h-5 w-5 ${signals.volume.isSpike ? 'text-orange-500' : 'text-gray-500'}`} />
                        <div>
                          <p className="font-medium">Volume Spike</p>
                          <p className="text-sm text-muted-foreground">
                            {signals.volume.spikeMultiplier.toFixed(1)}x average
                          </p>
                        </div>
                      </div>
                      <Badge variant={signals.volume.isSpike ? "destructive" : "secondary"}>
                        {signals.volume.isSpike ? "Spike Detected" : "Normal"}
                      </Badge>
                    </div>

                    {/* ROC Panic */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <TrendingUp className={`h-5 w-5 ${signals.roc.isPanic ? 'text-red-500' : 'text-gray-500'}`} />
                        <div>
                          <p className="font-medium">Rate of Change</p>
                          <p className="text-sm text-muted-foreground">
                            {signals.roc.value.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      <Badge variant={signals.roc.isPanic ? "destructive" : "secondary"}>
                        {signals.roc.isPanic ? "Panic!" : "Normal"}
                      </Badge>
                    </div>

                    {/* Last Decision */}
                    <div className="border-t pt-4">
                      <h3 className="font-medium mb-2">Last AI Decision</h3>
                      <p className="text-sm text-muted-foreground mb-2">{lastDecision}</p>
                      {decisionReasoning && (
                        <p className="text-xs text-muted-foreground">
                          Reasoning: {decisionReasoning}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Positions Tab */}
            <TabsContent value="positions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Grid Positions</CardTitle>
                  <CardDescription>
                    Real positions (2-4) and virtual levels
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GridLadderView
                    levels={levels}
                    currentPrice={currentPrice}
                    centerPrice={config.centerPrice}
                    showVirtual={true}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>
                    Track your bot's performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GridPerformancePanel />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Summary Card */}
          <GridSummaryCard
            symbol={config.symbol}
            isRunning={config.enabled}
            totalPositions={2} // Will be updated from API
            activePositions={2} // Will be updated from API
            gridSpacing={config.gridSpacingPct}
            totalInvestment={config.totalInvestmentUsd}
          />

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Position Count</span>
                <span className="font-medium">2-4 Dynamic</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Grid Type</span>
                <span className="font-medium">Infinite Virtual</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Order Type</span>
                <span className="font-medium">Market Only</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Risk Manager</span>
                <span className="font-medium">AI-Driven</span>
              </div>
            </CardContent>
          </Card>

          {/* Fee Analysis */}
          <FeeAnalysisPanel
            gridCount={config.gridCount}
            investment={config.totalInvestmentUsd}
            leverage={config.leverage}
          />
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
