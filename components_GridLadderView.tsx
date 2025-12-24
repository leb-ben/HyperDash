"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, Circle, CircleDot, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { GridLevel } from "@/types"

interface GridLadderViewProps {
  levels: GridLevel[]
  currentPrice: number
  centerPrice: number
}

export default function GridLadderView({ levels, currentPrice, centerPrice }: GridLadderViewProps) {
  // Sort levels by price descending (highest at top)
  const sortedLevels = useMemo(() => {
    return [...levels].sort((a, b) => b.price - a.price)
  }, [levels])

  // Find the index where current price would be inserted
  const currentPriceIndex = useMemo(() => {
    for (let i = 0; i < sortedLevels.length; i++) {
      if (currentPrice >= sortedLevels[i].price) {
        return i
      }
    }
    return sortedLevels.length
  }, [sortedLevels, currentPrice])

  // Calculate max distance for opacity scaling
  const maxDistance = useMemo(() => {
    if (sortedLevels.length === 0) return 1
    const prices = sortedLevels.map((l) => l.price)
    return Math.max(
      Math.abs(Math.max(...prices) - currentPrice),
      Math.abs(Math.min(...prices) - currentPrice)
    )
  }, [sortedLevels, currentPrice])

  const getOpacity = (price: number): number => {
    const distance = Math.abs(price - currentPrice)
    const normalizedDistance = distance / maxDistance
    return Math.max(0.3, 1 - normalizedDistance * 0.7)
  }

  const getBarWidth = (level: GridLevel): number => {
    // Real positions get full width, virtual get partial
    if (level.isReal && level.status === "filled") return 100
    if (level.isReal) return 85
    return 60
  }

  const getLevelStyles = (level: GridLevel) => {
    const isShort = level.side === "short"
    const baseColor = isShort ? "blue" : "emerald"
    
    if (level.isReal && level.status === "filled") {
      return {
        bar: `bg-${baseColor}-500`,
        border: `border-${baseColor}-400`,
        text: `text-${baseColor}-300`,
        glow: `shadow-${baseColor}-500/30 shadow-lg`,
      }
    }
    if (level.isReal) {
      return {
        bar: `bg-${baseColor}-500/60`,
        border: `border-${baseColor}-500/50`,
        text: `text-${baseColor}-400`,
        glow: "",
      }
    }
    return {
      bar: `bg-slate-600/40`,
      border: `border-slate-600/30`,
      text: `text-slate-400`,
      glow: "",
    }
  }

  const getStatusIcon = (level: GridLevel) => {
    if (level.isReal && level.status === "filled") {
      return <Zap className="h-3 w-3 text-yellow-400" />
    }
    if (level.isReal) {
      return <CircleDot className="h-3 w-3" />
    }
    return <Circle className="h-3 w-3" />
  }

  const formatPrice = (price: number): string => {
    if (price >= 10000) return price.toFixed(0)
    if (price >= 1000) return price.toFixed(1)
    if (price >= 1) return price.toFixed(2)
    return price.toFixed(4)
  }

  const getDistanceFromCurrent = (price: number): string => {
    const pct = ((price - currentPrice) / currentPrice) * 100
    const sign = pct >= 0 ? "+" : ""
    return `${sign}${pct.toFixed(2)}%`
  }

  return (
    <div className="relative w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-2 text-xs text-muted-foreground">
        <span>Price Level</span>
        <span>Distance</span>
        <span>Size</span>
        <span>Status</span>
      </div>

      {/* Ladder Container */}
      <div className="relative space-y-0.5">
        {sortedLevels.map((level, index) => {
          const styles = getLevelStyles(level)
          const opacity = getOpacity(level.price)
          const barWidth = getBarWidth(level)
          const isAboveCurrent = level.price > currentPrice
          const distanceStr = getDistanceFromCurrent(level.price)

          // Insert current price indicator
          const showCurrentPriceAbove = index === currentPriceIndex

          return (
            <div key={level.id}>
              {/* Current Price Indicator */}
              {showCurrentPriceAbove && (
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-yellow-500 border-dashed" />
                  </div>
                  <div className="relative flex justify-center">
                    <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                      <span>CURRENT</span>
                      <span className="font-mono">${formatPrice(currentPrice)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Grid Level Row */}
              <div
                className={`relative flex items-center h-10 rounded-sm overflow-hidden transition-all duration-300 hover:scale-[1.02] ${styles.glow}`}
                style={{ opacity }}
              >
                {/* Background Bar */}
                <div
                  className={`absolute h-full ${styles.bar} transition-all duration-500`}
                  style={{
                    width: `${barWidth}%`,
                    left: isAboveCurrent ? "auto" : 0,
                    right: isAboveCurrent ? 0 : "auto",
                  }}
                />

                {/* Content */}
                <div className={`relative z-10 flex items-center justify-between w-full px-3 ${styles.text}`}>
                  {/* Price */}
                  <div className="flex items-center gap-2 min-w-[120px]">
                    {level.side === "short" ? (
                      <TrendingDown className="h-4 w-4 text-blue-400" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                    )}
                    <span className="font-mono font-semibold">${formatPrice(level.price)}</span>
                  </div>

                  {/* Distance from current */}
                  <div className={`text-sm font-mono min-w-[80px] text-center ${
                    isAboveCurrent ? "text-blue-400" : "text-emerald-400"
                  }`}>
                    {distanceStr}
                  </div>

                  {/* Size */}
                  <div className="text-sm font-mono min-w-[80px] text-center">
                    ${level.sizeUsd.toFixed(0)}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2 min-w-[100px] justify-end">
                    {getStatusIcon(level)}
                    {level.isReal ? (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          level.status === "filled"
                            ? "border-yellow-500 text-yellow-400"
                            : "border-current"
                        }`}
                      >
                        {level.status === "filled" ? "ACTIVE" : "REAL"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-500">Virtual</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* Show current price at bottom if below all levels */}
        {currentPriceIndex === sortedLevels.length && sortedLevels.length > 0 && (
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-yellow-500 border-dashed" />
            </div>
            <div className="relative flex justify-center">
              <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                <span>CURRENT</span>
                <span className="font-mono">${formatPrice(currentPrice)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-700">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-3 w-8 bg-blue-500 rounded-sm" />
            <span>Short (Above Price)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-8 bg-emerald-500 rounded-sm" />
            <span>Long (Below Price)</span>
          </div>
          <div className="flex items-center gap-2">
            <CircleDot className="h-3 w-3" />
            <span>Real Position</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="h-3 w-3" />
            <span>Virtual</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-3 w-3 text-yellow-400" />
            <span>Filled/Active</span>
          </div>
        </div>
      </div>
    </div>
  )
}