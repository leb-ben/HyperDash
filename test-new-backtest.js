// Quick test to verify new backtest behavior
const testConfig = {
  symbol: "BTC",
  startTime: new Date("2025-12-20").getTime(),
  endTime: new Date("2025-12-21").getTime(),
  config: {
    totalInvestmentUsd: 1000,
    leverage: 10,
    gridSpacing: 1.0,
    aiAggressiveness: "medium",
    aiConfidenceThreshold: 70,
    stopLossPct: 3.0,
    takeProfitPct: 2.0
  }
};

console.log("Testing new backtest behavior...");
console.log("Expected: Should start with 0 positions and only open when price triggers grid levels");

fetch('http://localhost:3001/api/backtest/hamburger/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testConfig)
})
.then(res => res.json())
.then(data => {
  console.log("\nResults:");
  console.log("Total trades:", data.data?.metrics?.totalTrades);
  console.log("Total return:", data.data?.metrics?.totalReturnPct?.toFixed(2) + "%");
  console.log("\nFirst 3 trades:");
  data.data?.trades?.slice(0, 3).forEach((trade, i) => {
    console.log(`${i+1}. ${trade.side} at ${trade.entryPrice.toFixed(2)} - Exit: ${trade.exitReason}`);
  });
})
.catch(err => console.error("Error:", err.message));
