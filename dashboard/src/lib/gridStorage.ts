/**
 * Local storage utilities for grid configurations
 * Persists grid state between sessions
 */

import type { VirtualGridConfig, GridLevel, GridPerformance, GridStorageData } from "@/types"

const STORAGE_KEY = "virtual_grid_data"
const STORAGE_VERSION = 1

interface StorageWrapper {
  version: number
  data: GridStorageData
}

/**
 * Save all grid data to localStorage
 */
export function saveGridData(data: GridStorageData): boolean {
  try {
    const wrapper: StorageWrapper = {
      version: STORAGE_VERSION,
      data: {
        ...data,
        lastSaved: Date.now(),
      },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapper))
    return true
  } catch (error) {
    console.error("Failed to save grid data:", error)
    return false
  }
}

/**
 * Load all grid data from localStorage
 */
export function loadGridData(): GridStorageData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const wrapper: StorageWrapper = JSON.parse(raw)

    // Version check for future migrations
    if (wrapper.version !== STORAGE_VERSION) {
      console.warn("Grid data version mismatch, may need migration")
      // Future: Add migration logic here
    }

    return wrapper.data
  } catch (error) {
    console.error("Failed to load grid data:", error)
    return null
  }
}

/**
 * Save a single grid configuration
 */
export function saveGridConfig(config: VirtualGridConfig): boolean {
  const data = loadGridData() || createEmptyStorageData()
  const existingIndex = data.grids.findIndex((g) => g.id === config.id)

  if (existingIndex >= 0) {
    data.grids[existingIndex] = { ...config, updatedAt: Date.now() }
  } else {
    data.grids.push({ ...config, createdAt: Date.now(), updatedAt: Date.now() })
  }

  return saveGridData(data)
}

/**
 * Load a single grid configuration by ID
 */
export function loadGridConfig(gridId: string): VirtualGridConfig | null {
  const data = loadGridData()
  if (!data) return null
  return data.grids.find((g) => g.id === gridId) || null
}

/**
 * Load all grid configurations
 */
export function loadAllGridConfigs(): VirtualGridConfig[] {
  const data = loadGridData()
  return data?.grids || []
}

/**
 * Delete a grid configuration
 */
export function deleteGridConfig(gridId: string): boolean {
  const data = loadGridData()
  if (!data) return false

  data.grids = data.grids.filter((g) => g.id !== gridId)
  delete data.levels[gridId]
  delete data.performance[gridId]

  return saveGridData(data)
}

/**
 * Save grid levels for a specific grid
 */
export function saveGridLevels(gridId: string, levels: GridLevel[]): boolean {
  const data = loadGridData() || createEmptyStorageData()
  data.levels[gridId] = levels
  return saveGridData(data)
}

/**
 * Load grid levels for a specific grid
 */
export function loadGridLevels(gridId: string): GridLevel[] {
  const data = loadGridData()
  return data?.levels[gridId] || []
}

/**
 * Save performance data for a specific grid
 */
export function saveGridPerformance(gridId: string, performance: GridPerformance): boolean {
  const data = loadGridData() || createEmptyStorageData()
  data.performance[gridId] = performance
  return saveGridData(data)
}

/**
 * Load performance data for a specific grid
 */
export function loadGridPerformance(gridId: string): GridPerformance | null {
  const data = loadGridData()
  return data?.performance[gridId] || null
}

/**
 * Create empty storage data structure
 */
export function createEmptyStorageData(): GridStorageData {
  return {
    grids: [],
    levels: {},
    performance: {},
    lastSaved: Date.now(),
  }
}

/**
 * Clear all grid data from storage
 */
export function clearAllGridData(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch (error) {
    console.error("Failed to clear grid data:", error)
    return false
  }
}

/**
 * Export grid data as JSON string (for backup)
 */
export function exportGridData(): string | null {
  const data = loadGridData()
  if (!data) return null
  return JSON.stringify(data, null, 2)
}

/**
 * Import grid data from JSON string (for restore)
 */
export function importGridData(jsonString: string): boolean {
  try {
    const data: GridStorageData = JSON.parse(jsonString)
    
    // Validate structure
    if (!data.grids || !Array.isArray(data.grids)) {
      throw new Error("Invalid grid data structure")
    }
    
    return saveGridData(data)
  } catch (error) {
    console.error("Failed to import grid data:", error)
    return false
  }
}

/**
 * Generate a unique grid ID
 */
export function generateGridId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `GRID_${timestamp}_${random}`.toUpperCase()
}

/**
 * Check if storage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const test = "__storage_test__"
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Get storage usage info
 */
export function getStorageInfo(): { used: number; available: boolean } {
  const data = localStorage.getItem(STORAGE_KEY)
  return {
    used: data ? new Blob([data]).size : 0,
    available: isStorageAvailable(),
  }
}