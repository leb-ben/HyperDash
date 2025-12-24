"use client"

import { useState, useEffect } from "react"
import { Bell, Plus, Trash2, DollarSign, TrendingUp } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import type { Alert } from "@/types"

export default function AlertConfigPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newAlert, setNewAlert] = useState<Partial<Alert>>({
    type: "price",
    symbol: "BTC/USD",
    condition: "above",
    threshold: 50000,
    enabled: true,
  })

  useEffect(() => {
    const saved = localStorage.getItem("trading-alerts")
    if (saved) {
      try {
        setAlerts(JSON.parse(saved))
      } catch (error) {
        console.error("[v0] Failed to load alerts:", error)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("trading-alerts", JSON.stringify(alerts))
  }, [alerts])

  const handleAddAlert = () => {
    if (!newAlert.symbol || !newAlert.threshold) return

    const alert: Alert = {
      id: Date.now().toString(),
      type: newAlert.type as "price" | "pnl",
      symbol: newAlert.symbol,
      condition: newAlert.condition as "above" | "below",
      threshold: newAlert.threshold,
      enabled: newAlert.enabled ?? true,
      triggered: false,
    }

    setAlerts((prev) => [...prev, alert])
    setIsAdding(false)
    setNewAlert({
      type: "price",
      symbol: "BTC/USD",
      condition: "above",
      threshold: 50000,
      enabled: true,
    })
  }

  const handleDeleteAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const handleToggleAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Alert Configuration</CardTitle>
            <CardDescription>Set price and P&L alerts</CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsAdding(!isAdding)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Alert
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isAdding && (
          <div className="mb-6 p-4 border rounded-lg bg-slate-800 space-y-4">
            <div className="space-y-2">
              <Label>Alert Type</Label>
              <Select
                value={newAlert.type}
                onValueChange={(v) => setNewAlert((prev) => ({ ...prev, type: v as "price" | "pnl" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Price Alert</SelectItem>
                  <SelectItem value="pnl">P&L Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input
                value={newAlert.symbol}
                onChange={(e) => setNewAlert((prev) => ({ ...prev, symbol: e.target.value }))}
                placeholder="BTC/USD"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select
                  value={newAlert.condition}
                  onValueChange={(v) => setNewAlert((prev) => ({ ...prev, condition: v as "above" | "below" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Above</SelectItem>
                    <SelectItem value="below">Below</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Threshold</Label>
                <Input
                  type="number"
                  value={newAlert.threshold}
                  onChange={(e) => setNewAlert((prev) => ({ ...prev, threshold: Number.parseFloat(e.target.value) }))}
                  placeholder="50000"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={newAlert.enabled}
                  onCheckedChange={(checked) => setNewAlert((prev) => ({ ...prev, enabled: checked }))}
                />
                <Label>Enabled</Label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAddAlert}>
                  Add Alert
                </Button>
              </div>
            </div>
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No alerts configured</p>
            <p className="text-sm mt-1">Add an alert to get notified</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${
                    alert.enabled ? "bg-slate-800 border-slate-700" : "bg-slate-900/50 border-slate-800 opacity-50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded ${alert.type === "price" ? "bg-blue-500/20" : "bg-green-500/20"}`}>
                        {alert.type === "price" ? (
                          <DollarSign className="h-4 w-4 text-blue-400" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-green-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold">{alert.symbol}</h4>
                        <p className="text-sm text-muted-foreground">
                          {alert.type === "price" ? "Price" : "P&L"} {alert.condition} {alert.threshold}
                          {alert.type === "pnl" && "%"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {alert.triggered && (
                        <Badge variant="destructive" className="animate-pulse">
                          Triggered
                        </Badge>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteAlert(alert.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <div className="text-sm text-muted-foreground">
                      {alert.lastTriggered && (
                        <span>Last triggered: {new Date(alert.lastTriggered).toLocaleString()}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{alert.enabled ? "Active" : "Disabled"}</span>
                      <Switch checked={alert.enabled} onCheckedChange={() => handleToggleAlert(alert.id)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
