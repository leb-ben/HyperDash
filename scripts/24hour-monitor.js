/**
 * 24-Hour Test Monitor
 * Monitors the aggressive trading test and provides real-time alerts
 * Run: node scripts/24hour-monitor.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class TestMonitor {
  constructor() {
    this.testStartTime = Date.now();
    this.testDuration = 24 * 60 * 60 * 1000; // 24 hours
    this.alertThresholds = {
      maxLossPercent: 30, // Alert if losing more than 30%
      minBalance: 50,     // Alert if balance drops below $50
      maxDowntime: 300000, // Alert if bot is down for more than 5 minutes
      diskSpaceCritical: 90 // Alert if disk usage > 90%
    };
    this.checkInterval = 60000; // Check every minute
    this.lastKnownBalance = 100;
    this.botDowntimeStart = null;
    this.alertsSent = new Set();
  }

  async startMonitoring() {
    console.log('🔍 Starting 24-Hour Trading Test Monitor');
    console.log('='.repeat(60));
    console.log(`⏱️  Test Duration: 24 hours`);
    console.log(`💰 Starting Balance: $100`);
    console.log(`⚠️  Alert Thresholds:`);
    console.log(`   • Max Loss: ${this.alertThresholds.maxLossPercent}%`);
    console.log(`   • Min Balance: $${this.alertThresholds.minBalance}`);
    console.log(`   • Max Downtime: ${this.alertThresholds.maxDowntime / 60000} minutes`);
    console.log(`   • Disk Space: ${this.alertThresholds.diskSpaceCritical}%`);
    console.log('');

    // Start monitoring loop
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.checkInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Monitor stopped by user');
      clearInterval(this.monitoringInterval);
      process.exit(0);
    });
  }

  async performHealthCheck() {
    const now = Date.now();
    const elapsed = now - this.testStartTime;
    const remaining = this.testDuration - elapsed;
    const hoursElapsed = Math.floor(elapsed / (60 * 60 * 1000));
    const hoursRemaining = Math.ceil(remaining / (60 * 60 * 1000));

    try {
      // Check bot status
      const botStatus = this.checkBotStatus();
      
      // Check portfolio state
      const portfolio = this.getPortfolioState();
      
      // Check system resources
      const systemStatus = this.checkSystemResources();
      
      // Display status
      this.displayStatus(hoursElapsed, hoursRemaining, botStatus, portfolio, systemStatus);
      
      // Check for alerts
      await this.checkAlerts(botStatus, portfolio, systemStatus);
      
      // Save monitoring data
      this.saveMonitoringData(hoursElapsed, portfolio, systemStatus);
      
    } catch (error) {
      console.error(`❌ Health check failed: ${error.message}`);
      this.sendAlert('CRITICAL', `Health check failed: ${error.message}`);
    }
  }

  checkBotStatus() {
    try {
      const pm2Output = execSync('pm2 jlist', { encoding: 'utf8' });
      const processes = JSON.parse(pm2Output);
      
      const tradingBot = processes.find(p => p.name === 'trading-bot');
      const dashboard = processes.find(p => p.name === 'dashboard');
      
      const botOnline = tradingBot?.pm2_env?.status === 'online';
      const dashboardOnline = dashboard?.pm2_env?.status === 'online';
      
      if (!botOnline) {
        if (!this.botDowntimeStart) {
          this.botDowntimeStart = Date.now();
        }
      } else {
        this.botDowntimeStart = null;
      }
      
      return {
        botOnline,
        dashboardOnline,
        botUptime: tradingBot?.pm2_env?.pm_uptime || 0,
        botRestarts: tradingBot?.pm2_env?.restart_time || 0,
        dashboardUptime: dashboard?.pm2_env?.pm_uptime || 0,
        downtimeDuration: this.botDowntimeStart ? Date.now() - this.botDowntimeStart : 0
      };
    } catch (error) {
      return {
        botOnline: false,
        dashboardOnline: false,
        error: error.message
      };
    }
  }

  getPortfolioState() {
    try {
      const stateFile = path.join(process.cwd(), 'data', 'trading-state.json');
      
      if (!fs.existsSync(stateFile)) {
        return { error: 'No state file found' };
      }
      
      const stateData = fs.readFileSync(stateFile, 'utf8');
      const state = JSON.parse(stateData);
      
      const portfolio = state.portfolio || {};
      const currentBalance = portfolio.usdtBalance || 100;
      const totalValue = portfolio.totalValueUsdt || currentBalance;
      const profitLoss = totalValue - 100;
      const profitLossPercent = (profitLoss / 100) * 100;
      
      this.lastKnownBalance = totalValue;
      
      return {
        usdtBalance: currentBalance,
        totalValue,
        profitLoss,
        profitLossPercent,
        totalFees: portfolio.totalFeesPaid || 0,
        tradesExecuted: portfolio.tradesExecuted || 0,
        pendingOrders: portfolio.pendingOrdersCount || 0,
        positions: portfolio.positions ? portfolio.positions.size : 0,
        lastSaved: state.lastSaved
      };
    } catch (error) {
      return { error: error.message, lastKnownBalance: this.lastKnownBalance };
    }
  }

  checkSystemResources() {
    try {
      // Check disk space
      const diskUsage = execSync('df -h .', { encoding: 'utf8' });
      const diskLines = diskUsage.split('\n');
      const dataLine = diskLines[diskLines.length - 2]; // Skip header and empty line
      const diskParts = dataLine.split(/\s+/);
      const diskUsagePercent = parseInt(diskParts[diskParts.length - 2].replace('%', ''));
      
      // Check memory usage
      const memUsage = execSync('free -m', { encoding: 'utf8' });
      const memLines = memUsage.split('\n');
      const memParts = memLines[1].split(/\s+/);
      const memUsagePercent = Math.round((parseInt(memParts[2]) / parseInt(memParts[1])) * 100);
      
      return {
        diskUsagePercent,
        memUsagePercent,
        diskCritical: diskUsagePercent > this.alertThresholds.diskSpaceCritical,
        memCritical: memUsagePercent > 90
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  displayStatus(hoursElapsed, hoursRemaining, botStatus, portfolio, systemStatus) {
    console.clear();
    console.log('📊 24-Hour Trading Test Monitor');
    console.log('='.repeat(60));
    console.log(`⏰ Time: ${hoursElapsed}h elapsed, ${hoursRemaining}h remaining`);
    
    // Bot Status
    console.log('\n🤖 Bot Status:');
    console.log(`   Trading Bot: ${botStatus.botOnline ? '🟢 Online' : '🔴 Offline'}`);
    console.log(`   Dashboard: ${botStatus.dashboardOnline ? '🟢 Online' : '🔴 Offline'}`);
    if (botStatus.botOnline) {
      console.log(`   Uptime: ${Math.floor(botStatus.botUptime / 60000)} minutes`);
      console.log(`   Restarts: ${botStatus.botRestarts}`);
    }
    if (botStatus.downtimeDuration > 0) {
      console.log(`   ⚠️  Downtime: ${Math.floor(botStatus.downtimeDuration / 60000)} minutes`);
    }
    
    // Portfolio Status
    if (!portfolio.error) {
      console.log('\n💰 Portfolio:');
      console.log(`   Total Value: $${portfolio.totalValue.toFixed(2)}`);
      console.log(`   P&L: $${portfolio.profitLoss.toFixed(2)} (${portfolio.profitLossPercent.toFixed(2)}%)`);
      console.log(`   Fees Paid: $${portfolio.totalFees.toFixed(2)}`);
      console.log(`   Trades: ${portfolio.tradesExecuted}`);
      console.log(`   Positions: ${portfolio.positions}`);
      console.log(`   Pending: ${portfolio.pendingOrders}`);
      
      // Performance indicator
      const performance = portfolio.profitLossPercent > 0 ? '🟢 Profitable' : 
                         portfolio.profitLossPercent > -10 ? '🟡 Small Loss' : '🔴 Loss';
      console.log(`   Status: ${performance}`);
    } else {
      console.log('\n💰 Portfolio: ❌ Error reading state');
    }
    
    // System Status
    console.log('\n💻 System:');
    console.log(`   Disk: ${systemStatus.diskUsagePercent}% ${systemStatus.diskCritical ? '🔴' : '🟢'}`);
    console.log(`   Memory: ${systemStatus.memUsagePercent}% ${systemStatus.memCritical ? '🔴' : '🟢'}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('Press Ctrl+C to stop monitoring');
  }

  async checkAlerts(botStatus, portfolio, systemStatus) {
    // Bot downtime alert
    if (botStatus.downtimeDuration > this.alertThresholds.maxDowntime) {
      const alertKey = 'bot_downtime';
      if (!this.alertsSent.has(alertKey)) {
        this.sendAlert('CRITICAL', `Bot has been down for ${Math.floor(botStatus.downtimeDuration / 60000)} minutes`);
        this.alertsSent.add(alertKey);
      }
    }
    
    // Portfolio loss alert
    if (!portfolio.error && portfolio.profitLossPercent < -this.alertThresholds.maxLossPercent) {
      const alertKey = 'max_loss';
      if (!this.alertsSent.has(alertKey)) {
        this.sendAlert('CRITICAL', `Portfolio loss exceeded ${this.alertThresholds.maxLossPercent}%: ${portfolio.profitLossPercent.toFixed(2)}%`);
        this.alertsSent.add(alertKey);
      }
    }
    
    // Minimum balance alert
    if (!portfolio.error && portfolio.totalValue < this.alertThresholds.minBalance) {
      const alertKey = 'min_balance';
      if (!this.alertsSent.has(alertKey)) {
        this.sendAlert('CRITICAL', `Balance dropped below $${this.alertThresholds.minBalance}: $${portfolio.totalValue.toFixed(2)}`);
        this.alertsSent.add(alertKey);
      }
    }
    
    // Disk space alert
    if (systemStatus.diskCritical) {
      const alertKey = 'disk_space';
      if (!this.alertsSent.has(alertKey)) {
        this.sendAlert('CRITICAL', `Disk space critical: ${systemStatus.diskUsagePercent}%`);
        this.alertsSent.add(alertKey);
      }
    }
  }

  sendAlert(level, message) {
    const timestamp = new Date().toLocaleString();
    const alert = `[${timestamp}] ${level}: ${message}`;
    
    // Log to console
    console.log(`\n🚨 ${alert}`);
    
    // Save to alert log
    const alertFile = path.join(process.cwd(), 'logs', 'alerts.log');
    fs.appendFileSync(alertFile, alert + '\n');
    
    // You could add webhook/email alerts here
    // await this.sendWebhookAlert(level, message);
  }

  saveMonitoringData(hoursElapsed, portfolio, systemStatus) {
    const monitoringData = {
      timestamp: Date.now(),
      hoursElapsed,
      portfolio: portfolio.error ? null : {
        totalValue: portfolio.totalValue,
        profitLossPercent: portfolio.profitLossPercent,
        tradesExecuted: portfolio.tradesExecuted
      },
      system: {
        diskUsagePercent: systemStatus.diskUsagePercent,
        memUsagePercent: systemStatus.memUsagePercent
      }
    };
    
    const monitoringFile = path.join(process.cwd(), 'logs', '24hour-monitor.json');
    let existingData = [];
    
    if (fs.existsSync(monitoringFile)) {
      try {
        existingData = JSON.parse(fs.readFileSync(monitoringFile, 'utf8'));
      } catch (error) {
        existingData = [];
      }
    }
    
    existingData.push(monitoringData);
    
    // Keep only last 24 hours of data
    const cutoff = Date.now() - (25 * 60 * 60 * 1000);
    const filteredData = existingData.filter(d => d.timestamp > cutoff);
    
    fs.writeFileSync(monitoringFile, JSON.stringify(filteredData, null, 2));
  }
}

// Run monitor if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new TestMonitor();
  monitor.startMonitoring().catch(console.error);
}

export default TestMonitor;
