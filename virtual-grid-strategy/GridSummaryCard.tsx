"use client"

import { Play, Pause, Settings, Trash2, TrendingUp, TrendingDown, Activity } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { GridSummary } from "@/types"

interface GridSummaryCardProps {
  grid: GridSummary
  onStart: (id: string) => void
  onStop: (id: string) => void
  onConfigure: (id: string) => void
  onDelete: (id: string) => void
}

export default function GridSummaryCard({
  grid,
  onStart,
  onStop,
  onConfigure,
  onDelete,
}: GridSummaryCardProps) {
  const getPnlColor = (pnl: number): string => {
    if (pnl > 0) return "text-emerald-400"
    if (pnl < 0) return "text-red-400"
    return "text-slate-400"
  }

  const getStatusBadge = () => {
    switch (grid.status) {
      case "active":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500">
            <Activity className="h-3 w-3 mr-1 animate-pulse" />
            Active
          </Badge>
        )
      case "inactive":
        return (
          <Badge variant="secondary">
            Inactive
          </Badge>
        )
      case "error":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500">
            Error
          </Badge>
        )
    }
  }

  const priceChange = ((grid.currentPrice - grid.centerPrice) / grid.centerPrice) * 100

  return (
    <Card className="hover:border-slate-600 transition-colors">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">{grid.symbol}</span>
            {getStatusBadge()}
          </div>
          <span className="text-xs text-muted-foreground font-mono">{grid.id}</span>
        </div>

        {/* Price Info */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Center Price</p>
            <p className="font-mono font-semibold">${grid.centerPrice.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current Price</p>
            <div className="flex items-center gap-1">
              <p className="font-mono font-semibold">${grid.currentPrice.toLocaleString()}</p>
              <span className={`text-xs ${priceChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-2 bg-slate-800/50 rounded">
            <p className="text-xs text-muted-foreground">Positions</p>
            <p className="font-semibold">
              {grid.realPositions} / {grid.maxRealPositions}
            </p>
          </div>
          <div className="p-2 bg-slate-800/50 rounded">
            <p className="text-xs text-muted-foreground">Total PnL</p>
            <p className={`font-semibold font-mono ${getPnlColor(grid.totalPnl)}`}>
              {grid.totalPnl >= 0 ? "+" : ""}${grid.totalPnl.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {grid.enabled ? (
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => onStop(grid.id)}
            >
              <Pause className="h-4 w-4 mr-1" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onStart(grid.id)}
            >
              <Play className="h-4 w-4 mr-1" />
              Start
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onConfigure(grid.id)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-400 hover:text-red-300 hover:border-red-400"
            onClick={() => onDelete(grid.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}