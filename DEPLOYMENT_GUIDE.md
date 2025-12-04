# 🚀 24-Hour Aggressive Trading Test Deployment Guide

This guide will help you deploy the realistic paper trading bot for continuous 24-hour testing with automatic restart and state persistence.

## 📋 Prerequisites

- Node.js 18+ installed
- Windows operating system (this guide is Windows-optimized)
- Administrator privileges for PM2 installation

## 🎯 What This Deployment Provides

- ✅ **Exact USDT Tracking**: Starts with $100, tracks every cent
- ✅ **Real Trading Fees**: Actual fee deductions on every trade
- ✅ **1-Minute Delays**: All trades wait for "confirmations"
- ✅ **Market Order Penalties**: 2x fees for market orders
- ✅ **Automatic Restart**: Bot restarts if it crashes
- ✅ **State Persistence**: Saves state every 30 seconds + after every trade
- ✅ **24/7 Monitoring**: Real-time alerts for issues
- ✅ **Disaster Recovery**: Survives crashes, internet outages, and power failures

## 🛠️ Step 1: Environment Setup

1. **Set Environment Variables** in your `.env` file:
```bash
# Trading Configuration
PAPER_TRADING=true
LIVE_TRADING=false
REALISTIC_PAPER_TRADING=true
INITIAL_PAPER_BALANCE=100
AGGRESSIVE_TRADING=true

# AI Configuration (Cerebras is working)
CEREBRAS_API_KEY=your_cerebras_key_here
PERPLEXITY_API_KEY=your_perplexity_key_here

# Bot Settings
LOG_LEVEL=info
```

2. **Install Dependencies**:
```bash
npm install
```

## 🚀 Step 2: Deploy Bot Services

Run the deployment script to set up PM2 and start services:

```bash
node scripts/deploy.js deploy
```

This will:
- Install PM2 globally
- Create necessary directories (logs/, data/, backups/)
- Build TypeScript
- Start trading bot and dashboard with PM2
- Configure auto-restart on system boot
- Set up monitoring

**Expected Output:**
```
🚀 Deploying Trading Bot with State Persistence
============================================================
📁 Creating directories...
   Created: ./logs
   Created: ./data
📦 Checking PM2 installation...
   ✅ PM2 is already installed
🔨 Building TypeScript...
   ✅ TypeScript build complete
🚀 Starting services with PM2...
   ✅ Trading bot started
   ✅ Dashboard started
📊 Service Status:
┌────┬─────────────────┬──────────┬──────┬───────────┬───────────┬──────────┐
│ id │ name            │ mode     │ ↺    │ status    │ cpu       │ memory   │
├────┼─────────────────┼──────────┼──────┼───────────┼───────────┼──────────┤
│ 0  │ trading-bot     │ fork     │ 0    │ online    │ 0%        │ 80.5mb   │
│ 1  │ dashboard       │ fork     │ 0    │ online    │ 0%        │ 45.2mb   │
└────┴─────────────────┴──────────┴──────┴───────────┴───────────┴──────────┘
✅ Deployment Complete!
```

## 📊 Step 3: Start 24-Hour Monitoring

Open a **new terminal** and start the monitoring:

```bash
node scripts/24hour-monitor-windows.js
```

This provides real-time monitoring with:
- Live portfolio value and P&L
- Bot status and uptime
- System resource usage
- Critical alerts for issues
- Hourly progress updates

**Monitoring Display:**
```
📊 24-Hour Trading Test Monitor (Windows)
============================================================
⏰ Time: 2h elapsed, 22h remaining

🤖 Bot Status:
   Trading Bot: 🟢 Online
   Dashboard: 🟢 Online
   Uptime: 120 minutes
   Restarts: 0

💰 Portfolio:
   Total Value: $102.45
   P&L: $2.45 (2.45%)
   Fees Paid: $1.23
   Trades: 15
   Positions: 2
   Pending: 0
   Status: 🟢 Profitable

💻 System:
   Disk: 45% 🟢
   Memory: 67% 🟢
```

## 🌐 Step 4: Access Dashboard

Open your web browser and navigate to:
```
http://localhost:3000
```

The dashboard provides:
- Real-time trading interface
- Portfolio overview
- Trade history
- AI decision logs
- Terminal commands

## 🔧 Management Commands

### Check Bot Status
```bash
node scripts/deploy.js status
```

### Restart Services
```bash
node scripts/deploy.js restart
```

### Stop Services
```bash
node scripts/deploy.js stop
```

### View Logs
```bash
pm2 logs trading-bot
pm2 logs dashboard
```

### PM2 Management
```bash
pm2 status                 # Check all processes
pm2 restart trading-bot    # Restart just the bot
pm2 stop trading-bot       # Stop just the bot
pm2 delete trading-bot     # Remove bot from PM2
```

## 📈 Understanding the Test

### What Gets Tested
- **Realistic Conditions**: 1-minute delays, real fees, market penalties
- **Aggressive Strategy**: High-frequency trading with market orders
- **Profitability**: After all fees and realistic conditions
- **Risk Management**: How the strategy handles losses

### Expected Timeline
- **Hours 0-6**: High activity as bot establishes positions
- **Hours 6-18**: Steady trading pattern
- **Hours 18-24**: Position management and profit taking

### Success Metrics
- **Profitable**: >$0 after all fees
- **Efficient**: Fee-to-profit ratio < 20%
- **Stable**: No crashes or manual interventions needed

## 🚨 Alert Thresholds

The monitor will alert you if:
- **Bot Downtime**: > 5 minutes offline
- **Excessive Loss**: > 30% portfolio loss
- **Low Balance**: < $50 remaining
- **Disk Space**: > 90% usage
- **Memory**: > 90% usage

## 💾 State Persistence

The bot automatically saves state:
- **Every 30 seconds**: Periodic backup
- **After every trade**: Immediate save
- **On shutdown**: Graceful save

**State includes:**
- USDT balance
- All open positions
- Pending orders with timers
- Complete trade history
- Performance metrics

**Recovery:**
- Automatic restart after crashes
- Complete state restoration
- No lost trades or positions

## 🛠️ Troubleshooting

### Bot Won't Start
```bash
# Check logs
pm2 logs trading-bot --lines 50

# Common issues:
# - Missing API keys in .env
# - Port 3000 already in use
# - TypeScript build errors
```

### State Not Saving
```bash
# Check data directory
ls -la data/

# Verify permissions
icacls data /grant Everyone:F

# Manual state save
node -e "import('./src/core/statePersistence.js').then(m => m.statePersistence.saveState(true))"
```

### Monitoring Issues
```bash
# Windows-specific commands
wmic logicaldisk get size,freespace
wmic OS get TotalVisibleMemorySize,FreePhysicalMemory

# Restart monitoring
node scripts/24hour-monitor-windows.js
```

### Dashboard Not Accessible
```bash
# Check if dashboard is running
pm2 status

# Restart dashboard
pm2 restart dashboard

# Check port usage
netstat -an | findstr :3000
```

## 📁 File Locations

- **Logs**: `./logs/` (PM2 logs, alerts, monitoring data)
- **State**: `./data/trading-state.json` (current state)
- **Backup**: `./data/trading-state-backup.json` (emergency backup)
- **Backups**: `./backups/` (historical state backups)

## 🔄 After 24 Hours

1. **Stop the test**:
   ```bash
   node scripts/deploy.js stop
   ```

2. **Review results**:
   - Check monitoring logs: `logs/24hour-monitor.json`
   - Review trade history in dashboard
   - Analyze profit/loss after fees

3. **Generate report**:
   The monitor automatically saves hourly data and provides a final summary including:
   - Total profit/loss
   - Fee efficiency ratio
   - Trade execution statistics
   - Performance recommendation

## ❓ FAQ

**Q: What if my computer restarts?**
A: PM2 automatically restarts the bot, and state persistence restores everything exactly as it was.

**Q: Can I lose internet during the test?**
A: Yes, the bot will reconnect automatically when internet returns. No state is lost.

**Q: How much disk space does this use?**
A: Approximately 100MB for 24 hours of logs and state backups.

**Q: Can I run multiple tests simultaneously?**
A: Not recommended. Each test uses the same state files and ports.

**Q: What if I need to pause the test?**
A: Use `pm2 pause trading-bot` to pause, then `pm2 resume trading-bot` to continue.

## 🎯 Success Criteria

Your 24-hour test is successful if:
- ✅ Bot runs continuously without manual intervention
- ✅ State is preserved through any crashes or restarts
- ✅ All trades execute with realistic fees and delays
- ✅ Final profit/loss accurately reflects real trading conditions
- ✅ You have complete data for analysis

---

**🚀 Your realistic paper trading bot is now ready for 24-hour testing!**

The system will survive crashes, internet outages, and power failures while maintaining perfect state continuity. Good luck with your aggressive trading test!
