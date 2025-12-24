/**
 * Local storage utilities for dashboard persistence
 * Persists trading data, bandwidth usage, and settings between sessions
 */

const STORAGE_KEY = "tradingbot_dashboard_data";
const STORAGE_VERSION = 1;

interface StorageWrapper {
  version: number;
  data: DashboardStorageData;
}

export interface DashboardStorageData {
  bandwidth: {
    daily: Array<{
      date: string;
      used: number;
      limit: number;
    }>;
    lastReset: number;
  };
  trades: Array<{
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    size: number;
    price: number;
    pnl?: number;
    timestamp: number;
    status: 'open' | 'closed';
  }>;
  positions: Array<{
    id: string;
    symbol: string;
    side: 'long' | 'short';
    size: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    timestamp: number;
  }>;
  settings: {
    alerts: {
      enabled: boolean;
      soundEnabled: boolean;
      desktopNotifications: boolean;
      tradeAlerts: boolean;
      priceAlerts: boolean;
      systemAlerts: boolean;
    };
    lastSaved: number;
  };
}

/**
 * Save all dashboard data to localStorage
 */
export function saveDashboardData(data: Partial<DashboardStorageData>): boolean {
  try {
    const existing = loadDashboardData();
    const merged: DashboardStorageData = {
      ...existing,
      ...data,
      settings: {
        ...existing.settings,
        ...data.settings,
        lastSaved: Date.now()
      }
    };
    
    const wrapper: StorageWrapper = {
      version: STORAGE_VERSION,
      data: merged
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapper));
    return true;
  } catch (error) {
    console.error("Failed to save dashboard data:", error);
    return false;
  }
}

/**
 * Load all dashboard data from localStorage
 */
export function loadDashboardData(): DashboardStorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyStorageData();

    const wrapper: StorageWrapper = JSON.parse(raw);

    // Version check for future migrations
    if (wrapper.version !== STORAGE_VERSION) {
      console.warn("Dashboard data version mismatch, may need migration");
      // Future: Add migration logic here
    }

    return wrapper.data;
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
    return createEmptyStorageData();
  }
}

/**
 * Save bandwidth usage data
 */
export function saveBandwidthData(used: number, limit: number): boolean {
  const data = loadDashboardData();
  const today = new Date().toISOString().split('T')[0];
  
  // Find today's data or create new
  const todayIndex = data.bandwidth.daily.findIndex(d => d.date === today);
  if (todayIndex >= 0) {
    data.bandwidth.daily[todayIndex] = { date: today, used, limit };
  } else {
    data.bandwidth.daily.push({ date: today, used, limit });
    // Keep only last 30 days
    if (data.bandwidth.daily.length > 30) {
      data.bandwidth.daily = data.bandwidth.daily.slice(-30);
    }
  }
  
  data.bandwidth.lastReset = Date.now();
  
  return saveDashboardData({ bandwidth: data.bandwidth });
}

/**
 * Load bandwidth usage data
 */
export function loadBandwidthData() {
  const data = loadDashboardData();
  return data.bandwidth;
}

/**
 * Save a trade
 */
export function saveTrade(trade: any): boolean {
  const data = loadDashboardData();
  
  // Check if trade already exists (by ID)
  const existingIndex = data.trades.findIndex(t => t.id === trade.id);
  if (existingIndex >= 0) {
    data.trades[existingIndex] = { ...trade };
  } else {
    data.trades.push({ ...trade, timestamp: Date.now() });
  }
  
  // Keep only last 1000 trades
  if (data.trades.length > 1000) {
    data.trades = data.trades.slice(-1000);
  }
  
  return saveDashboardData({ trades: data.trades });
}

/**
 * Load all trades
 */
export function loadTrades() {
  const data = loadDashboardData();
  return data.trades;
}

/**
 * Save positions
 */
export function savePositions(positions: any[]): boolean {
  const data = loadDashboardData();
  
  // Update positions with current data
  positions.forEach(pos => {
    const existingIndex = data.positions.findIndex(p => p.id === pos.id || p.symbol === pos.symbol);
    if (existingIndex >= 0) {
      data.positions[existingIndex] = { ...pos };
    } else {
      data.positions.push({ ...pos, id: pos.id || `pos_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` });
    }
  });
  
  // Remove positions that no longer exist
  const currentSymbols = positions.map(p => p.symbol);
  data.positions = data.positions.filter(p => currentSymbols.includes(p.symbol));
  
  return saveDashboardData({ positions: data.positions });
}

/**
 * Load all positions
 */
export function loadPositions() {
  const data = loadDashboardData();
  return data.positions;
}

/**
 * Save alert settings
 */
export function saveAlertSettings(settings: any): boolean {
  const data = loadDashboardData();
  data.settings.alerts = { ...data.settings.alerts, ...settings };
  return saveDashboardData({ settings: data.settings });
}

/**
 * Load alert settings
 */
export function loadAlertSettings() {
  const data = loadDashboardData();
  return data.settings.alerts;
}

/**
 * Create empty storage data structure
 */
function createEmptyStorageData(): DashboardStorageData {
  return {
    bandwidth: {
      daily: [],
      lastReset: Date.now()
    },
    trades: [],
    positions: [],
    settings: {
      soundEnabled: true,
      desktopNotifications: false,
      tradeAlerts: true,
      priceAlerts: true,
      systemAlerts: true,
      lastSaved: Date.now()
    }
  };
}

/**
 * Clear all dashboard data from storage
 */
export function clearDashboardData(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error("Failed to clear dashboard data:", error);
    return false;
  }
}

/**
 * Export dashboard data as JSON string (for backup)
 */
export function exportDashboardData(): string | null {
  const data = loadDashboardData();
  return JSON.stringify(data, null, 2);
}

/**
 * Import dashboard data from JSON string (for restore)
 */
export function importDashboardData(jsonString: string): boolean {
  try {
    const data: DashboardStorageData = JSON.parse(jsonString);
    
    // Validate structure
    if (!data.trades || !Array.isArray(data.trades)) {
      throw new Error("Invalid dashboard data structure");
    }
    
    return saveDashboardData(data);
  } catch (error) {
    console.error("Failed to import dashboard data:", error);
    return false;
  }
}

/**
 * Get storage usage info
 */
export function getStorageInfo(): { used: number; available: boolean } {
  const data = localStorage.getItem(STORAGE_KEY);
  return {
    used: data ? new Blob([data]).size : 0,
    available: (() => {
      try {
        const test = "__storage_test__";
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch {
        return false;
      }
    })()
  };
}
