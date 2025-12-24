"use client"

import { useState, useEffect, useCallback } from "react"
import { Settings, Play, Pause, RotateCcw, Plus, Save, Download, Upload, RefreshCw, Wifi, WifiOff } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

const DEFAULT_CONFIG: VirtualGridConfig = {
  id: "",
  symbol: "BTC/USD",
  enabled: false,
  centerPrice: 50000,
  gridCount: 20,
  gridSpacingPct: 1.0,
  totalInvestmentUsd: 1000,
  leverage: 10,
  typicalRealPositions: 2,
  maxRealPositions: 4,
  rebalanceThresholdPct: 5,
  minProfitAfterFeesPct: 0.2,
}

export default function VirtualGridPanel() {
  // State
  const [config, setConfig] = useState<VirtualGridConfig>({ ...DEFAULT_CONFIG, id: generateGridId() })
  const [levels, setLevels] = useState<GridLevel[]>([])
  const [currentPrice, setCurrentPrice] = useState<number>(50000)
  const [savedGrids, setSavedGrids] = useState<VirtualGridConfig[]>([])
  const [activeTab, setActiveTab] = useState<string>("configure")
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [selectedGridId, setSelectedGridId] = useState<string | null>(null)

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
  }, [])

  // Generate grid levels based on config
  useEffect(() => {
    if (!config.centerPrice || !config.gridCount || !config.gridSpacingPct) return

    const newLevels: GridLevel[] = []
    const levelsPerSide = Math.floor(config.gridCount / 2)
    const spacingMultiplier = config.gridSpacingPct / 100
    const perLevelSizeUsd = (config.totalInvestmentUsd / config.gridCount) * config.leverage

    // Generate LONG levels (below center)
    for (let i = 1; i <= levelsPerSide; i++) {
      const price = config.centerPrice * Math.pow(1 - spacingMultiplier, i)
      const distanceFromCenter = i
      
      // First 2 levels closest to center are "real"
      const isReal = i <= Math.floor(config.maxRealPositions / 2)
      
      newLevels.push({
        id: `${config.id}_long_${i}`,
        price: Math.round(price * 100) / 100,
        side: "long",
        size: perLevelSizeUsd / price,
        sizeUsd: perLevelSizeUsd,
        isReal,
        status: "pending",
        createdAt: Date.now(),
      })
    }

    // Generate SHORT levels (above center)
    for (let i = 1; i <= levelsPerSide; i++) {
      const price = config.centerPrice * Math.pow(1 + spacingMultiplier, i)
      
      // First 2 levels closest to center are "real"
      const isReal = i <= Math.floor(config.maxRealPositions / 2)
      
      newLevels.push({
        id: `${config.id}_short_${i}`,
        price: Math.round(price * 100) / 100,
        side: "short",
        size: perLevelSizeUsd / price,
        sizeUsd: perLevelSizeUsd,
        isReal,
        status: "pending",
        createdAt: Date.now(),
      })
    }

    newLevels.sort((a, b) => b.price - a.price)
    setLevels(newLevels)
  }, [config])

  // Simulate price updates when grid is enabled
  useEffect(() => {
    if (!config.enabled) return

    const interval = setInterval(async () => {
      if (isBackendConnected) {
        // Try to get real price from backend
        const price = await getCurrentPrice(config.symbol)
        if (price) {
          setCurrentPrice(price)
          return
        }
      }
      
      // Fallback to simulated price
      setCurrentPrice((prev) => {
        const change = (Math.random() - 0.5) * (prev * 0.002) // 0.2% max change
        return Math.round((prev + change) * 100) / 100
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [config.enabled, config.symbol, isBackendConnected])

  // Update real/virtual status based on current price
  useEffect(() => {
    if (!config.enabled || levels.length === 0) return

    setLevels((prevLevels) => {
      const sorted = [...prevLevels].sort((a, b) => {
        const distA = Math.abs(a.price - currentPrice)
        const distB = Math.abs(b.price - currentPrice)
        return distA - distB
      })

      // Find closest levels to current price
      const closestLongs = sorted.filter((l) => l.side === "long").slice(0, Math.floor(config.maxRealPositions / 2))
      const closestShorts = sorted.filter((l) => l.side === "short").slice(0, Math.floor(config.maxRealPositions / 2))
      const realIds = new Set([...closestLongs, ...closestShorts].map((l) => l.id))

      return prevLevels.map((level) => ({
        ...level,
        isReal: realIds.has(level.id),
      }))
    })
  }, [currentPrice, config.enabled, config.maxRealPositions])

  // Handlers
  const handleToggleGrid = async () => {
    setIsLoading(true)
    
    try {
      if (config.enabled) {
        // Stop grid
        if (isBackendConnected) {
          const response = await apiStopGrid(config.id)
          if (!response.success) {
            error("Failed to Stop", response.error || "Unknown error")
            return
          }
        }
        setConfig((prev) => ({ ...prev, enabled: false }))
        success("Grid Stopped", `${config.symbol} grid has been stopped`)
      } else {
        // Start grid
        if (isBackendConnected) {
          const response = await apiStartGrid(config.id)
          if (!response.success) {
            error("Failed to Start", response.error || "Unknown error")
            return
          }
        }
        setConfig((prev) => ({ ...prev, enabled: true }))
        success("Grid Started", `${config.symbol} grid is now active`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRebalance = async () => {
    setIsLoading(true)
    
    try {
      if (isBackendConnected) {
        const response = await apiRebalanceGrid(config.id)
        if (!response.success) {
          error("Rebalance Failed", response.error || "Unknown error")
          return
        }
      }
      
      setConfig((prev) => ({ ...prev, centerPrice: currentPrice }))
      info("Grid Rebalanced", `Center price updated to $${currentPrice.toFixed(2)}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveGrid = () => {
    const saved = saveGridConfig(config)
    if (saved) {
      saveGridLevels(config.id, levels)
      setSavedGrids(loadAllGridConfigs())
      success("Grid Saved", `${config.symbol} configuration saved locally`)
    } else {
      error("Save Failed", "Could not save grid configuration")
    }
  }

  const handleLoadGrid = (gridId: string) => {
    const loadedConfig = loadGridConfig(gridId)
    if (loadedConfig) {
      setConfig(loadedConfig)
      const loadedLevels = loadGridLevels(gridId)
      if (loadedLevels.length > 0) {
        setLevels(loadedLevels)
      }
      setSelectedGridId(gridId)
      setActiveTab("configure")
      info("Grid Loaded", `Loaded ${loadedConfig.symbol} configuration`)
    }
  }

  const handleDeleteGrid = (gridId: string) => {
    if (confirm("Are you sure you want to delete this grid?")) {
      deleteGridConfig(gridId)
      setSavedGrids(loadAllGridConfigs())
      if (selectedGridId === gridId) {
        setConfig({ ...DEFAULT_CONFIG, id: generateGridId() })
        setSelectedGridId(null)
      }
      success("Grid Deleted", "Grid configuration removed")
    }
  }

  const handleNewGrid = () => {
    setConfig({ ...DEFAULT_CONFIG, id: generateGridId() })
    setSelectedGridId(null)
    setActiveTab("configure")
    info("New Grid", "Created new grid configuration")
  }

  const handleExport = () => {
    const data = exportGridData()
    if (data) {
      const blob = new Blob([data], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `grid-backup-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      success("Export Complete", "Grid data exported successfully")
    }
  }

  const handleImport = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const content = event.target?.result as string
          if (importGridData(content)) {
            setSavedGrids(loadAllGridConfigs())
            success("Import Complete", "Grid data imported successfully")
          } else {
            error("Import Failed", "Invalid grid data file")
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleConfigChange = (field: keyof VirtualGridConfig, value: number | string) => {
    setConfig((prev) => ({ ...prev, [field]: value }))
  }

  // Convert saved grids to summary format
  const gridSummaries: GridSummary[] = savedGrids.map((g) => ({
    id: g.id,
    symbol: g.symbol,
    enabled: g.enabled,
    centerPrice: g.centerPrice,
    currentPrice: currentPrice,
    realPositions: g.typicalRealPositions,
    maxRealPositions: g.maxRealPositions,
    totalPnl: 0, // Would come from performance data
    status: g.enabled ? "active" : "inactive",
    createdAt: g.createdAt || Date.now(),
  }))

  // Calculate stats
  const realLongs = levels.filter((l) => l.isReal && l.side === "long").length
  const realShorts = levels.filter((l) => l.isReal && l.side === "short").length
  const minPrice = levels.length > 0 ? Math.min(...levels.map((l) => l.price)) : 0
  const maxPrice = levels.length > 0 ? Math.max(...levels.map((l) => l.price)) : 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Grid Bot</h2>
          <p className="text-muted-foreground">Virtual grid with intelligent position management</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection Status */}
          <Badge variant="outline" className={isBackendConnected ? "border-emerald-500 text-emerald-400" : "border-red-500 text-red-400"}>
            {isBackendConnected ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </>
            )}
          </Badge>
          
          {/* Action Buttons */}
          <Button size="sm" variant="outline" onClick={handleNewGrid}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button size="sm" variant="outline" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configure">Configure</TabsTrigger>
          <TabsTrigger value="visualize">Visualize</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="saved">Saved Grids ({savedGrids.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="configure" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Configuration Panel */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Grid Settings
                    </CardTitle>
                    <CardDescription>Configure your AI grid parameters</CardDescription>
                  </div>
                  {config.id && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {config.id.slice(0, 12)}...
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {/* Symbol */}
                    <div className="space-y-2">
                      <Label htmlFor="symbol">Trading Pair</Label>
                      <Input
                        id="symbol"
                        value={config.symbol}
                        onChange={(e) => handleConfigChange("symbol", e.target.value)}
                        placeholder="BTC/USD"
                        disabled={config.enabled}
                      />
                    </div>

                    {/* Center Price */}
                    <div className="space-y-2">
                      <Label htmlFor="centerPrice">Center Price ($)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="centerPrice"
                          type="number"
                          value={config.centerPrice}
                          onChange={(e) => handleConfigChange("centerPrice", parseFloat(e.target.value) || 0)}
                          disabled={config.enabled}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfigChange("centerPrice", currentPrice)}
                          disabled={config.enabled}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Current: ${currentPrice.toLocaleString()}
                      </p>
                    </div>

                    {/* Grid Count */}
                    <div className="space-y-2">
                      <Label htmlFor="gridCount">Grid Levels (4-100)</Label>
                      <Input
                        id="gridCount"
                        type="number"
                        min="4"
                        max="100"
                        value={config.gridCount}
                        onChange={(e) => handleConfigChange("gridCount", parseInt(e.target.value) || 4)}
                        disabled={config.enabled}
                      />
                      <p className="text-xs text-muted-foreground">
                        {Math.floor(config.gridCount / 2)} longs + {Math.floor(config.gridCount / 2)} shorts
                      </p>
                    </div>

                    {/* Grid Spacing */}
                    <div className="space-y-2">
                      <Label htmlFor="spacing">Grid Spacing (%)</Label>
                      <Input
                        id="spacing"
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="10"
                        value={config.gridSpacingPct}
                        onChange={(e) => handleConfigChange("gridSpacingPct", parseFloat(e.target.value) || 0.1)}
                        disabled={config.enabled}
                      />
                    </div>

                    {/* Total Investment */}
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
                        ~${((config.totalInvestmentUsd / config.gridCount) * config.leverage).toFixed(2)} per level (with leverage)
                      </p>
                    </div>

                    {/* Leverage */}
                    <div className="space-y-2">
                      <Label htmlFor="leverage">Leverage (1-20x)</Label>
                      <Input
                        id="leverage"
                        type="number"
                        min="1"
                        max="20"
                        value={config.leverage}
                        onChange={(e) => handleConfigChange("leverage", parseInt(e.target.value) || 1)}
                        disabled={config.enabled}
                      />
                    </div>

                    {/* Max Real Positions */}
                    <div className="space-y-2">
                      <Label htmlFor="maxReal">Max Real Positions (2-4)</Label>
                      <Input
                        id="maxReal"
                        type="number"
                        min="2"
                        max="4"
                        value={config.maxRealPositions}
                        onChange={(e) => handleConfigChange("maxRealPositions", parseInt(e.target.value) || 2)}
                        disabled={config.enabled}
                      />
                      <p className="text-xs text-muted-foreground">
                        AI maintains only {config.maxRealPositions} active positions
                      </p>
                    </div>

                    {/* Rebalance Threshold */}
                    <div className="space-y-2">
                      <Label htmlFor="rebalance">Rebalance Threshold (%)</Label>
                      <Input
                        id="rebalance"
                        type="number"
                        step="0.5"
                        min="1"
                        max="20"
                        value={config.rebalanceThresholdPct}
                        onChange={(e) => handleConfigChange("rebalanceThresholdPct", parseFloat(e.target.value) || 1)}
                      />
                    </div>

                    {/* Min Profit After Fees */}
                    <div className="space-y-2">
                      <Label htmlFor="minProfit">Min Profit After Fees (%)</Label>
                      <Input
                        id="minProfit"
                        type="number"
                        step="0.05"
                        min="0.05"
                        max="2"
                        value={config.minProfitAfterFeesPct}
                        onChange={(e) => handleConfigChange("minProfitAfterFeesPct", parseFloat(e.target.value) || 0.05)}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4 space-y-2 border-t">
                      <Button
                        className="w-full"
                        onClick={handleToggleGrid}
                        variant={config.enabled ? "destructive" : "default"}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : config.enabled ? (
                          <Pause className="mr-2 h-4 w-4" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        {config.enabled ? "Stop Grid" : "Start Grid"}
                      </Button>

                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={handleRebalance}
                        disabled={!config.enabled || isLoading}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Rebalance to Current
                      </Button>

                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={handleSaveGrid}
                        disabled={isLoading}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save Configuration
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Fee Analysis Panel */}
            <div className="lg:col-span-1">
              <FeeAnalysisPanel config={config} currentPrice={currentPrice} />
            </div>

            {/* Quick Stats */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Grid Summary</CardTitle>
                <CardDescription>Current configuration overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={config.enabled ? "default" : "secondary"}>
                    {config.enabled ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Price Range */}
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Price Range</p>
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-400 font-mono">${minPrice.toLocaleString()}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-blue-400 font-mono">${maxPrice.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    {(((maxPrice - minPrice) / config.centerPrice) * 100).toFixed(1)}% total range
                  </p>
                </div>

                {/* Position Counts */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-emerald-400">{realLongs}</p>
                    <p className="text-xs text-muted-foreground">Real Longs</p>
                  </div>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-400">{realShorts}</p>
                    <p className="text-xs text-muted-foreground">Real Shorts</p>
                  </div>
                </div>

                {/* Virtual Levels */}
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Virtual Levels</span>
                    <span className="font-semibold">{levels.length - realLongs - realShorts}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ready to activate when price moves
                  </p>
                </div>

                {/* Capital Allocation */}
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Capital Allocation</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Active Capital</span>
                      <span className="font-mono text-emerald-400">
                        ${((config.totalInvestmentUsd / config.gridCount) * (realLongs + realShorts)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Reserved Capital</span>
                      <span className="font-mono text-slate-400">
                        ${(config.totalInvestmentUsd - (config.totalInvestmentUsd / config.gridCount) * (realLongs + realShorts)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span>Total Investment</span>
                      <span className="font-mono font-semibold">
                        ${config.totalInvestmentUsd.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Visualize Tab */}
        <TabsContent value="visualize">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Grid Ladder View</CardTitle>
                  <CardDescription>
                    Visual representation of all grid levels
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Current Price</p>
                    <p className="text-2xl font-bold text-yellow-400 font-mono">
                      ${currentPrice.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <GridLadderView
                  levels={levels}
                  currentPrice={currentPrice}
                  centerPrice={config.centerPrice}
                />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GridPerformancePanel levels={levels} gridId={config.id} />
            <FeeAnalysisPanel config={config} currentPrice={currentPrice} />
          </div>
        </TabsContent>

        {/* Saved Grids Tab */}
        <TabsContent value="saved">
          <div className="space-y-4">
            {savedGrids.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Saved Grids</h3>
                  <p className="text-muted-foreground mb-4">
                    Configure and save your first grid to see it here
                  </p>
                  <Button onClick={() => setActiveTab("configure")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Grid
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gridSummaries.map((grid) => (
                  <GridSummaryCard
                    key={grid.id}
                    grid={grid}
                    onStart={(id) => {
                      handleLoadGrid(id)
                      setTimeout(() =>
					                  {gridSummaries.map((grid) => (
                  <GridSummaryCard
                    key={grid.id}
                    grid={grid}
                    onStart={(id) => {
                      handleLoadGrid(id)
                      setTimeout(() => {
                        if (!config.enabled) {
                          handleToggleGrid()
                        }
                      }, 100)
                    }}
                    onStop={(id) => {
                      if (config.id === id && config.enabled) {
                        handleToggleGrid()
                      }
                    }}
                    onConfigure={(id) => {
                      handleLoadGrid(id)
                    }}
                    onDelete={(id) => {
                      handleDeleteGrid(id)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}