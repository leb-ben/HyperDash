import VirtualGridPanel from "@/components/VirtualGridPanel"
import EnhancedPositionsPanel from "@/components/EnhancedPositionsPanel"
import PerformanceAnalytics from "@/components/PerformanceAnalytics"
import AlertConfigPanel from "@/components/AlertConfigPanel"

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-100 mb-2">Hyperliquid Testnet Trading Dashboard</h1>
          <p className="text-slate-400">Virtual grid strategy with AI-driven rebalancing</p>
        </div>

        <VirtualGridPanel />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EnhancedPositionsPanel />
          <AlertConfigPanel />
        </div>

        <PerformanceAnalytics />
      </div>
    </main>
  )
}
