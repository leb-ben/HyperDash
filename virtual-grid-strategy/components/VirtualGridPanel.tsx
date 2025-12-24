"use client"

import { useState, useEffect } from "react"
import { Settings, Play, Pause, RotateCcw, TrendingUp, TrendingDown, Minus, Zap, DollarSign } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import type { VirtualGridConfig, GridLevel } from "@/types"

export default function VirtualGridPanel() {
  const [config, setConfig] = useState<VirtualGridConfig>({
    id: "GRID_001",
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
  })

  const [levels, setLevels] = useState<GridLevel[]>([])
  const [currentPrice, setCurrentPrice] = useState<number>(50000)
  const [isConfiguring, setIsConfiguring] = useState<boolean>(true)

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
      newLevels.push({
        id: `${config.id}_long_${i}`,
        price: Math.round(price * 100) / 100,
        side: "long",
        size: perLevelSizeUsd / price,
        sizeUsd: perLevelSizeUsd,
        isReal: i <= 2,
        status: "pending",
        createdAt: Date.now(),
      })
    }

    // Generate SHORT levels (above center)
    for (let i = 1; i <= levelsPerSide; i++) {
      const price = config.centerPrice * Math.pow(1 + spacingMultiplier, i)
      newLevels.push({
        id: `${config.id}_short_${i}`,
        price: Math.round(price * 100) / 100,
        side: "short",
        size: perLevelSizeUsd / price,
        sizeUsd: perLevelSizeUsd,
        isReal: i <= 2,
        status: "pending",
        createdAt: Date.now(),
      })
    }

    newLevels.sort((a, b) => b.price - a.price)
    setLevels(newLevels)
  }, [config])

  // Simulate price updates every 5 seconds
  useEffect(() => {
    if (!config.enabled) return

    const interval = setInterval(() => {
      setCurrentPrice((prev) => {
        const change = (Math.random() - 0.5) * 100
        return Math.round((prev + change) * 100) / 100
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [config.enabled])

  const handleToggleGrid = () => {
    setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))
  }

  const handleRebalance = () => {
    setConfig((prev) => ({ ...prev, centerPrice: currentPrice }))
  }

  const getGridLevelColor = (level: GridLevel): string => {
    if (level.isReal && level.status === "filled") {
      return level.side === "long" ? "bg-emerald-500/20 border-emerald-500" : "bg-blue-500/20 border-blue-500"
    }
    if (level.isReal) {
      return level.side === "long" ? "bg-emerald-500/10 border-emerald-500/50" : "bg-blue-500/10 border-blue-500/50"
    }
    return "bg-slate-700/30 border-slate-600/30"
  }

  const getGridLevelIcon = (level: GridLevel) => {
    if (level.isReal && level.status === "filled") {
      return <Zap className="h-3 w-3" />
    }
    if (level.isReal) {
      return level.side === "long" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
    }
    return <Minus className="h-3 w-3" />
  }

  const realLongs = levels.filter((l) => l.isReal && l.side === "long").length
  const realShorts = levels.filter((l) => l.isReal && l.side === "short").length
  const minPrice = levels.length > 0 ? Math.min(...levels.map((l) => l.price)) : 0
  const maxPrice = levels.length > 0 ? Math.max(...levels.map((l) => l.price)) : 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Configuration Panel */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Virtual Grid Setup</CardTitle>
              <CardDescription>Configure AI-driven grid parameters</CardDescription>
            </div>
            <Button
              size="sm"
              variant={isConfiguring ? "default" : "outline"}
              onClick={() => setIsConfiguring(!isConfiguring)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConfiguring ? (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input
                    id="symbol"
                    value={config.symbol}
                    onChange={(e) => setConfig((prev) => ({ ...prev, symbol: e.target.value }))}
                    placeholder="BTC/USD"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="centerPrice">Center Price ($)</Label>
                  <Input
                    id="centerPrice"
                    type="number"
                    value={config.centerPrice}
                    onChange={(e) => setConfig((prev) => ({ ...prev, centerPrice: Number.parseFloat(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gridCount">Grid Count (4-100)</Label>
                  <Input
                    id="gridCount"
                    type="number"
                    min="4"
                    max="100"
                    value={config.gridCount}
                    onChange={(e) => setConfig((prev) => ({ ...prev, gridCount: Number.parseInt(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spacing">Grid Spacing (%)</Label>
                  <Input
                    id="spacing"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={config.gridSpacingPct}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, gridSpacingPct: Number.parseFloat(e.target.value) }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="investment">Total Investment ($)</Label>
                  <Input
                    id="investment"
                    type="number"
                    min="100"
                    value={config.totalInvestmentUsd}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, totalInvestmentUsd: Number.parseFloat(e.target.value) }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leverage">Leverage (1-20x)</Label>
                  <Input
                    id="leverage"
                    type="number"
                    min="1"
                    max="20"
                    value={config.leverage}
                    onChange={(e) => setConfig((prev) => ({ ...prev, leverage: Number.parseInt(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxReal">Max Real Positions</Label>
                  <Input
                    id="maxReal"
                    type="number"
                    min="2"
                    max="4"
                    value={config.maxRealPositions}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, maxRealPositions: Number.parseInt(e.target.value) }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rebalance">Rebalance Threshold (%)</Label>
                  <Input
                    id="rebalance"
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={config.rebalanceThresholdPct}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, rebalanceThresholdPct: Number.parseFloat(e.target.value) }))
                    }
                  />
                </div>

                <div className="pt-4 space-y-2">
                  <Button
                    className="w-full"
                    onClick={handleToggleGrid}
                    variant={config.enabled ? "destructive" : "default"}
                  >
                    {config.enabled ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" />
                        Stop Grid
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Start Grid
                      </>
                    )}
                  </Button>

                  <Button
                    className="w-full bg-transparent"
                    variant="outline"
                    onClick={handleRebalance}
                    disabled={!config.enabled}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Rebalance to Current
                  </Button>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={config.enabled ? "default" : "secondary"}>
                    {config.enabled ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Real Positions</p>
                  <p className="text-lg font-semibold">
                    {realLongs + realShorts} / {config.maxRealPositions}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Longs</p>
                  <p className="text-lg font-semibold text-emerald-400">{realLongs}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Shorts</p>
                  <p className="text-lg font-semibold text-blue-400">{realShorts}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Price Range</p>
                  <p className="text-sm">
                    ${minPrice.toFixed(0)} - ${maxPrice.toFixed(0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Spacing</p>
                  <p className="text-sm">{config.gridSpacingPct}%</p>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <Button
                  className="w-full"
                  onClick={handleToggleGrid}
                  variant={config.enabled ? "destructive" : "default"}
                >
                  {config.enabled ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      Stop Grid
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Start Grid
                    </>
                  )}
                </Button>

                <Button
                  className="w-full bg-transparent"
                  variant="outline"
                  onClick={handleRebalance}
                  disabled={!config.enabled}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Rebalance
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visual Grid Display */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Grid Visualization</CardTitle>
          <CardDescription>
            <span className="text-emerald-400">Green = Real Longs</span>
            {" • "}
            <span className="text-blue-400">Blue = Real Shorts</span>
            {" • "}
            <span className="text-slate-400">Gray = Virtual</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Current Price Indicator */}
            <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-yellow-400" />
                <span className="font-semibold">Current Price</span>
              </div>
              <span className="text-xl font-bold text-yellow-400">${currentPrice.toFixed(2)}</span>
            </div>

            {/* Grid Levels */}
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-1">
                {levels.map((level) => {
                  const distanceFromCurrent = ((level.price - currentPrice) / currentPrice) * 100
                  const isNearCurrent = Math.abs(distanceFromCurrent) < 2

                  return (
                    <div
                      key={level.id}
                      className={`flex items-center justify-between p-2 border rounded ${getGridLevelColor(level)} ${
                        isNearCurrent ? "ring-2 ring-yellow-500/50" : ""
                      } transition-all`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`${level.side === "long" ? "text-emerald-400" : "text-blue-400"}`}>
                          {getGridLevelIcon(level)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold">${level.price.toFixed(2)}</span>
                            {level.isReal && (
                              <Badge variant="outline" className="text-xs">
                                REAL
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {level.side.toUpperCase()} • ${level.sizeUsd.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-medium ${
                            distanceFromCurrent > 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {distanceFromCurrent > 0 ? "+" : ""}
                          {distanceFromCurrent.toFixed(2)}%
                        </p>
                        <p className="text-xs text-muted-foreground">{level.status}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>

            {/* Legend */}
            <div className="pt-3 border-t">
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-emerald-500/20 border border-emerald-500 rounded" />
                  <span>Real Long</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-blue-500/20 border border-blue-500 rounded" />
                  <span>Real Short</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-slate-700/30 border border-slate-600/30 rounded" />
                  <span>Virtual</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Grid rebalances every 5 minutes. Real positions (max {config.maxRealPositions}) are shown with color.
                Virtual positions automatically convert to real when triggered.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
