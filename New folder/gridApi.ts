/**
 * API utilities for grid bot backend communication
 * Handles all HTTP requests to the trading backend
 */

import type { VirtualGridConfig, GridLevel, GridPerformance, Position } from "@/types"

// Default to localhost for development
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: number
}

interface GridStatusResponse {
  gridId: string
  enabled: boolean
  currentPrice: number
  levels: GridLevel[]
  realPositions: Position[]
  performance: GridPerformance
}

interface CreateGridRequest {
  config: VirtualGridConfig
}

interface UpdateGridRequest {
  gridId: string
  updates: Partial<VirtualGridConfig>
}

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        timestamp: Date.now(),
      }
    }

    const data = await response.json()
    return {
      success: true,
      data,
      timestamp: Date.now(),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return {
      success: false,
      error: `Network error: ${message}`,
      timestamp: Date.now(),
    }
  }
}

/**
 * Health check - verify backend is running
 */
export async function checkBackendHealth(): Promise<boolean> {
  const response = await apiFetch<{ status: string }>("/health")
  return response.success && response.data?.status === "ok"
}

/**
 * Get current price for a symbol
 */
export async function getCurrentPrice(symbol: string): Promise<number | null> {
  const response = await apiFetch<{ price: number }>(`/api/price/${encodeURIComponent(symbol)}`)
  return response.success ? response.data?.price || null : null
}

/**
 * Get all prices
 */
export async function getAllPrices(): Promise<Record<string, number>> {
  const response = await apiFetch<Record<string, { price: number }>>("/api/prices")
  if (!response.success || !response.data) return {}
  
  const prices: Record<string, number> = {}
  for (const [symbol, data] of Object.entries(response.data)) {
    prices[symbol] = data.price
  }
  return prices
}

/**
 * Create a new grid bot
 */
export async function createGrid(config: VirtualGridConfig): Promise<ApiResponse<GridStatusResponse>> {
  return apiFetch<GridStatusResponse>("/api/grid/create", {
    method: "POST",
    body: JSON.stringify({ config }),
  })
}

/**
 * Start a grid bot
 */
export async function startGrid(gridId: string): Promise<ApiResponse<GridStatusResponse>> {
  return apiFetch<GridStatusResponse>(`/api/grid/${gridId}/start`, {
    method: "POST",
  })
}

/**
 * Stop a grid bot
 */
export async function stopGrid(gridId: string): Promise<ApiResponse<GridStatusResponse>> {
  return apiFetch<GridStatusResponse>(`/api/grid/${gridId}/stop`, {
    method: "POST",
  })
}

/**
 * Get grid status
 */
export async function getGridStatus(gridId: string): Promise<ApiResponse<GridStatusResponse>> {
  return apiFetch<GridStatusResponse>(`/api/grid/${gridId}/status`)
}

/**
 * Update grid configuration
 */
export async function updateGrid(
  gridId: string,
  updates: Partial<VirtualGridConfig>
): Promise<ApiResponse<GridStatusResponse>> {
  return apiFetch<GridStatusResponse>(`/api/grid/${gridId}/update`, {
    method: "PATCH",
    body: JSON.stringify({ updates }),
  })
}

/**
 * Delete a grid bot
 */
export async function deleteGrid(gridId: string): Promise<ApiResponse<{ deleted: boolean }>> {
  return apiFetch<{ deleted: boolean }>(`/api/grid/${gridId}`, {
    method: "DELETE",
  })
}

/**
 * Rebalance grid to current price
 */
export async function rebalanceGrid(gridId: string): Promise<ApiResponse<GridStatusResponse>> {
  return apiFetch<GridStatusResponse>(`/api/grid/${gridId}/rebalance`, {
    method: "POST",
  })
}

/**
 * Get all active grids
 */
export async function getAllGrids(): Promise<ApiResponse<GridStatusResponse[]>> {
  return apiFetch<GridStatusResponse[]>("/api/grids")
}

/**
 * Get grid performance history
 */
export async function getGridPerformanceHistory(
  gridId: string,
  days: number = 7
): Promise<ApiResponse<GridPerformance[]>> {
  return apiFetch<GridPerformance[]>(`/api/grid/${gridId}/performance?days=${days}`)
}

/**
 * Get current positions from exchange
 */
export async function getPositions(): Promise<ApiResponse<Position[]>> {
  return apiFetch<Position[]>("/api/positions")
}

/**
 * Get account balance
 */
export async function getAccountBalance(): Promise<ApiResponse<{
  totalValue: number
  availableBalance: number
  marginUsed: number
}>> {
  return apiFetch("/api/account/balance")
}

/**
 * Sync grid state with backend
 * Useful after reconnection or page refresh
 */
export async function syncGridState(gridId: string): Promise<ApiResponse<GridStatusResponse>> {
  return apiFetch<GridStatusResponse>(`/api/grid/${gridId}/sync`, {
    method: "POST",
  })
}

/**
 * WebSocket connection for real-time updates
 */
export function createGridWebSocket(
  gridId: string,
  onMessage: (data: GridStatusResponse) => void,
  onError?: (error: Event) => void,
  onClose?: () => void
): WebSocket | null {
  try {
    const wsUrl = API_BASE_URL.replace("http", "ws")
    const ws = new WebSocket(`${wsUrl}/ws/grid/${gridId}`)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e)
      }
    }

    ws.onerror = (error) => {
      console.error("WebSocket error:", error)
      onError?.(error)
    }

    ws.onclose = () => {
      console.log("WebSocket closed")
      onClose?.()
    }

    return ws
  } catch (error) {
    console.error("Failed to create WebSocket:", error)
    return null
  }
}

/**
 * Check if backend supports a specific feature
 */
export async function checkFeatureSupport(feature: string): Promise<boolean> {
  const response = await apiFetch<{ features: string[] }>("/api/features")
  return response.success && response.data?.features.includes(feature) || false
}