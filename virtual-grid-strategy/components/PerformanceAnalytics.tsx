"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, Activity, Award, Clock } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface PerformanceData {
  daily: number
  weekly: number
  monthly: number
  totalTrades: number
  winningTrades: number
  avgDuration: number
  bestPerformer: { symbol: string; pnl: number }
  worstPerformer: { symbol: string; pnl: number }
}

export default function PerformanceAnalytics() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily")
  const [performance, setPerformance] = useState<PerformanceData>({
    daily: 0,
    weekly: 0,
    monthly: 0,
    totalTrades: 0,
    winningTrades: 0,
    avgDuration: 0,
    bestPerformer: { symbol: "N/A", pnl: 0 },
    worstPerformer: { symbol: "N/A", pnl: 0 },
  })

  useEffect(() => {
    const mockData: PerformanceData = {
      daily: 125.5,
      weekly: 450.25,
      monthly: 1850.75,
      totalTrades: 45,
      winningTrades: 32,
      avgDuration: 180,
      bestPerformer: { symbol: "BTC/USD", pnl: 250.5 },
      worstPerformer: { symbol: "ETH/USD", pnl: -45.25 },
    }
    setPerformance(mockData)
  }, [])

  const winRate = performance.totalTrades > 0 ? (performance.winningTrades / performance.totalTrades) * 100 : 0

  const currentPnl =
    period === "daily" ? performance.daily : period === "weekly" ? performance.weekly : performance.monthly

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const generateBars = () => {
    const data = [
      { label: "Mon", value: 45, positive: true },
      { label: "Tue", value: -20, positive: false },
      { label: "Wed", value: 80, positive: true },
      { label: "Thu", value: 35, positive: true },
      { label: "Fri", value: -15, positive: false },
      { label: "Sat", value: 60, positive: true },
      { label: "Sun", value: 25, positive: true },
    ]

    const maxValue = Math.max(...data.map((d) => Math.abs(d.value)))

    return (
      <div className="flex items-end justify-between gap-2 h-40 p-4 bg-background/50 rounded-lg">
        {data.map((item, index) => {
          const heightPct = (Math.abs(item.value) / maxValue) * 100
          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-xs font-semibold text-muted-foreground">${Math.abs(item.value)}</div>
              <div
                className={`w-full rounded-t ${item.positive ? "bg-green-500" : "bg-red-500"}`}
                style={{ height: `${heightPct}%` }}
              />
              <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Performance Analytics</CardTitle>
          <CardDescription>Track your trading performance over time</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>

            <div className="mt-6 p-6 rounded-lg bg-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {period.charAt(0).toUpperCase() + period.slice(1)} P&L
                  </p>
                  <p className={`text-4xl font-bold ${currentPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {currentPnl >= 0 ? "+" : ""}${currentPnl.toFixed(2)}
                  </p>
                </div>
                <div className={`p-4 rounded-full ${currentPnl >= 0 ? "bg-green-500/20" : "bg-red-500/20"}`}>
                  {currentPnl >= 0 ? (
                    <TrendingUp className="h-8 w-8 text-green-400" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-red-400" />
                  )}
                </div>
              </div>
            </div>

            <TabsContent value="daily" className="mt-4">
              {generateBars()}
            </TabsContent>
            <TabsContent value="weekly" className="mt-4">
              {generateBars()}
            </TabsContent>
            <TabsContent value="monthly" className="mt-4">
              {generateBars()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{winRate.toFixed(1)}%</span>
                <Badge variant={winRate >= 60 ? "default" : "secondary"}>
                  {performance.winningTrades}/{performance.totalTrades}
                </Badge>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${winRate}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {performance.winningTrades} winning trades out of {performance.totalTrades} total
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trade Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Activity className="h-4 w-4" />
                <span className="text-sm">Total Trades</span>
              </div>
              <span className="text-xl font-bold">{performance.totalTrades}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Avg Duration</span>
              </div>
              <span className="text-xl font-bold">{formatDuration(performance.avgDuration)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-green-400" />
              Best Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold">{performance.bestPerformer.symbol}</p>
              <p className="text-xl text-green-400 font-semibold">+${performance.bestPerformer.pnl.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
              Worst Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold">{performance.worstPerformer.symbol}</p>
              <p className="text-xl text-red-400 font-semibold">${performance.worstPerformer.pnl.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
