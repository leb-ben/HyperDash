"use client"

import { useMemo } from "react"
import { AlertTriangle, CheckCircle, AlertCircle, DollarSign, TrendingUp, Calculator, Info } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { VirtualGridConfig, FeeAnalysis, ProfitProjection } from "@/types"

interface FeeAnalysisPanelProps {
  config: VirtualGridConfig
  currentPrice: number
}

// Hyperliquid fee structure (testnet mirrors mainnet)
const TAKER_FEE_PCT = 0.035 // 0.035%
const MAKER_FEE_PCT = 0.01 // 0.01% (can be negative with rebates)
const FUNDING_RATE_AVG_PCT = 0.01 // Average funding rate per 8h

export default function FeeAnalysisPanel({ config, currentPrice }: FeeAnalysisPanelProps) {
  const feeAnalysis: FeeAnalysis = useMemo(() => {
    const perLevelSizeUsd = (config.totalInvestmentUsd / config.gridCount) * config.leverage
    
    // Entry fee (taker) + Exit fee (taker) per level
    const entryFeePerLevel = perLevelSizeUsd * (TAKER_FEE_PCT / 100)
    const exitFeePerLevel = perLevelSizeUsd * (TAKER_FEE_PCT / 100)
    const totalFeesPerRoundTrip = entryFeePerLevel + exitFeePerLevel
    
    // Total fees if entire grid executed
    const totalFeesForFullGrid = totalFeesPerRoundTrip * config.gridCount
    
    // Minimum spacing needed to be profitable after fees
    // Profit per level = sizeUsd * spacingPct - fees
    // Break even: sizeUsd * spacingPct = fees
    // spacingPct = fees / sizeUsd
    const minProfitableSpacingPct = (totalFeesPerRoundTrip / perLevelSizeUsd) * 100
    
    // Add buffer for min profit requirement
    const minSpacingWithBuffer = minProfitableSpacingPct + config.minProfitAfterFeesPct
    
    // Determine status
    let status: "safe" | "warning" | "danger" = "safe"
    if (config.gridSpacingPct < minProfitableSpacingPct) {
      status = "danger"
    } else if (config.gridSpacingPct < minSpacingWithBuffer) {
      status = "warning"
    }
    
    // Break-even movement percentage
    const breakEvenMovementPct = minProfitableSpacingPct
    
    return {
      entryFeePerLevel,
      exitFeePerLevel,
      totalFeesForFullGrid,
      minProfitableSpacingPct,
      currentSpacingPct: config.gridSpacingPct,
      status,
      breakEvenMovementPct,
    }
  }, [config])

  const profitProjection: ProfitProjection = useMemo(() => {
    const perLevelSizeUsd = (config.totalInvestmentUsd / config.gridCount) * config.leverage
    const profitPerTrade = perLevelSizeUsd * (config.gridSpacingPct / 100)
    const feesPerTrade = feeAnalysis.entryFeePerLevel + feeAnalysis.exitFeePerLevel
    const netProfitPerTrade = profitPerTrade - feesPerTrade
    
    // Assume moderate volatility - estimate trades per day based on spacing
    // Tighter spacing = more trades, wider spacing = fewer trades
    const assumedTradesPerDay = Math.max(1, Math.round(10 / config.gridSpacingPct))
    
    const estimatedDailyProfit = netProfitPerTrade * assumedTradesPerDay
    const estimatedWeeklyProfit = estimatedDailyProfit * 7
    const estimatedMonthlyProfit = estimatedDailyProfit * 30
    
    return {
      estimatedDailyProfit,
      estimatedWeeklyProfit,
      estimatedMonthlyProfit,
      assumedVolatilityPct: 2.5, // Assumed daily volatility
      assumedTradesPerDay,
      netAfterFees: netProfitPerTrade,
    }
  }, [config, feeAnalysis])

  const getStatusIcon = () => {
    switch (feeAnalysis.status) {
      case "safe":
        return <CheckCircle className="h-5 w-5 text-emerald-400" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />
      case "danger":
        return <AlertCircle className="h-5 w-5 text-red-400" />
    }
  }

  const getStatusBadge = () => {
    switch (feeAnalysis.status) {
      case "safe":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500">Profitable</Badge>
      case "warning":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500">Marginal</Badge>
      case "danger":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500">Unprofitable</Badge>
    }
  }

  const spacingHealthPct = Math.min(100, (config.gridSpacingPct / (feeAnalysis.minProfitableSpacingPct * 2)) * 100)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Fee Analysis
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Alert */}
        {feeAnalysis.status !== "safe" && (
          <div
            className={`p-3 rounded-lg flex items-start gap-3 ${
              feeAnalysis.status === "danger"
                ? "bg-red-500/10 border border-red-500/50"
                : "bg-yellow-500/10 border border-yellow-500/50"
            }`}
          >
            {getStatusIcon()}
            <div>
              <p className="font-medium">
                {feeAnalysis.status === "danger"
                  ? "Grid spacing too tight!"
                  : "Grid spacing is marginal"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {feeAnalysis.status === "danger"
                  ? `Increase spacing to at least ${feeAnalysis.minProfitableSpacingPct.toFixed(3)}% to break even.`
                  : `Consider increasing spacing to ${(feeAnalysis.minProfitableSpacingPct + config.minProfitAfterFeesPct).toFixed(3)}% for better profits.`}
              </p>
            </div>
          </div>
        )}

        {/* Spacing Health Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Spacing Health</span>
            <span className="font-mono">{config.gridSpacingPct}% / {feeAnalysis.minProfitableSpacingPct.toFixed(3)}% min</span>
          </div>
          <Progress
            value={spacingHealthPct}
            className={`h-2 ${
              feeAnalysis.status === "danger"
                ? "[&>div]:bg-red-500"
                : feeAnalysis.status === "warning"
                ? "[&>div]:bg-yellow-500"
                : "[&>div]:bg-emerald-500"
            }`}
          />
        </div>

        {/* Fee Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Entry Fee/Level
            </div>
            <p className="text-lg font-semibold font-mono">
              ${feeAnalysis.entryFeePerLevel.toFixed(4)}
            </p>
            <p className="text-xs text-muted-foreground">{TAKER_FEE_PCT}% taker</p>
          </div>

          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Exit Fee/Level
            </div>
            <p className="text-lg font-semibold font-mono">
              ${feeAnalysis.exitFeePerLevel.toFixed(4)}
            </p>
            <p className="text-xs text-muted-foreground">{TAKER_FEE_PCT}% taker</p>
          </div>

          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <AlertTriangle className="h-4 w-4" />
              Break-Even Move
            </div>
            <p className="text-lg font-semibold font-mono">
              {feeAnalysis.breakEvenMovementPct.toFixed(3)}%
            </p>
            <p className="text-xs text-muted-foreground">Min price movement</p>
          </div>

          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calculator className="h-4 w-4" />
              Full Grid Fees
            </div>
            <p className="text-lg font-semibold font-mono">
              ${feeAnalysis.totalFeesForFullGrid.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">If all levels execute</p>
          </div>
        </div>

        {/* Profit Projections */}
        <div className="pt-3 border-t border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="font-medium">Profit Projections</span>
            <Info className="h-3 w-3 text-muted-foreground" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-slate-800/30 rounded">
              <p className="text-xs text-muted-foreground">Daily</p>
              <p className={`font-semibold font-mono ${profitProjection.estimatedDailyProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                ${profitProjection.estimatedDailyProfit.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-2 bg-slate-800/30 rounded">
              <p className="text-xs text-muted-foreground">Weekly</p>
              <p className={`font-semibold font-mono ${profitProjection.estimatedWeeklyProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                ${profitProjection.estimatedWeeklyProfit.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-2 bg-slate-800/30 rounded">
              <p className="text-xs text-muted-foreground">Monthly</p>
              <p className={`font-semibold font-mono ${profitProjection.estimatedMonthlyProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                ${profitProjection.estimatedMonthlyProfit.toFixed(2)}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Based on ~{profitProjection.assumedTradesPerDay} trades/day at {profitProjection.assumedVolatilityPct}% volatility
          </p>
        </div>
      </CardContent>
    </Card>
  )
}