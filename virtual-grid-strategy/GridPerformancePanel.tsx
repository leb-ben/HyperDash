"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, Activity, Award, Target, Clock, DollarSign } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { GridLevel, GridPerformance } from "@/types"

interface GridPerformancePanelProps {
  levels: GridLevel[]
  gridId: string
}

export default function GridPerformancePanel({ levels, gridId }: GridPerformancePanelProps) {
  const performance: GridPerformance = useMemo(() => {
    const closedLevels = levels.filter((l) => l.status === "closed" && l.pnl !== undefined)
    const filledLevels = levels.filter((l) => l.status === "filled")

    const realizedPnl = closedLevels.reduce((sum, l) => sum + (l.pnl || 0), 0)
    const unrealizedPnl = filledLevels.reduce((sum, l) => sum + (l.pnl || 0), 0)
    const totalPnl = realizedPnl + unrealizedPnl

    const winningTrades = closedLevels.filter((l) => (l.pnl || 0) > 0).length
    const losingTrades = closedLevels.filter((l) => (l.pnl || 0) < 0).length
    const totalTrades = closedLevels.length

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0
    const avgTradeProfit = totalTrades > 0 ? realizedPnl / totalTrades : 0

    // Calculate average trade duration
    const durations = closedLevels
      .filter((l) => l.filledAt && l.closedAt)
      .map((l) => (l.closedAt! - l.filledAt!) / 1000 / 60) // in minutes
    const avgTradeDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0

    // Find best and worst levels
    const sort