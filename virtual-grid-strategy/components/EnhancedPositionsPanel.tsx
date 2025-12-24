"use client"

import { useState, useEffect } from "react"
import { X, TrendingUp, TrendingDown, DollarSign, Clock, Zap } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Position } from "@/types"

export default function EnhancedPositionsPanel() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await fetch("http://localhost:3001/api/portfolio")
        const data = await response.json()
        setPositions(data.positions || [])
      } catch (error) {
        console.error("[v0] Failed to fetch positions:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchPositions()
    const interval = setInterval(fetchPositions, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleClosePosition = async (position: Position) => {
    try {
      await fetch("http://localhost:3001/api/trade/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: position.symbol,
          side: position.side === "long" ? "short" : "long",
          size: position.size,
          type: "market",
        }),
      })
    } catch (error) {
      console.error("[v0] Failed to close position:", error)
    }
  }

  const calculateLiquidationDistance = (position: Position): number => {
    const distanceToLiq =
      position.side === "long"
        ? ((position.currentPrice - position.liquidationPrice) / position.currentPrice) * 100
        : ((position.liquidationPrice - position.currentPrice) / position.currentPrice) * 100
    return Math.max(0, Math.min(100, distanceToLiq))
  }

  const getTimeHeld = (entryTime?: number): string => {
    if (!entryTime) return "N/A"
    const elapsed = Date.now() - entryTime
    const hours = Math.floor(elapsed / 3600000)
    const minutes = Math.floor((elapsed % 3600000) / 60000)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">Loading positions...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Positions</CardTitle>
        <CardDescription>Real-time position tracking with P&L</CardDescription>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No active positions</div>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {positions.map((position, index) => {
                const liqDistance = calculateLiquidationDistance(position)
                const isProfitable = position.unrealizedPnl > 0

                return (
                  <div
                    key={`${position.symbol}-${index}`}
                    className={`p-4 rounded-lg border ${
                      isProfitable ? "bg-emerald-500/5 border-emerald-500/30" : "bg-red-500/5 border-red-500/30"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded ${position.side === "long" ? "bg-emerald-500/20" : "bg-red-500/20"}`}
                        >
                          {position.side === "long" ? (
                            <TrendingUp className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-400" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold">{position.symbol}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={position.side === "long" ? "default" : "destructive"}>
                              {position.side.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {position.leverage}x
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleClosePosition(position)}
                        className="hover:bg-red-500/20"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mb-3 p-3 rounded bg-background/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Unrealized P&L</span>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${isProfitable ? "text-green-400" : "text-red-400"}`}>
                            {isProfitable ? "+" : ""}${position.unrealizedPnl.toFixed(2)}
                          </p>
                          <p className={`text-sm ${isProfitable ? "text-green-400" : "text-red-400"}`}>
                            {isProfitable ? "+" : ""}
                            {position.unrealizedPnlPct.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Entry</p>
                        <p className="text-sm font-mono font-semibold">${position.entryPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Current</p>
                        <p className="text-sm font-mono font-semibold">${position.currentPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Liquidation</p>
                        <p className="text-sm font-mono font-semibold text-destructive">
                          ${position.liquidationPrice.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Distance to liquidation</span>
                        <span className={liqDistance < 20 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                          {liqDistance.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={liqDistance} className={liqDistance < 20 ? "bg-red-900/30" : "bg-secondary"} />
                    </div>

                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Held: {getTimeHeld(position.entryTime)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        <span>Margin: ${position.marginUsed.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" className="text-xs bg-transparent" disabled>
                        Set Stop Loss
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs bg-transparent" disabled>
                        Set Take Profit
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
