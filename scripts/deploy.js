/**
 * Deployment Script for Trading Bot
 * Sets up PM2, state persistence, and monitoring
 * Run: node scripts/deploy.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logger } from '../src/utils/logger.js';

class Deployer {
  constructor() {
    this.projectDir = process.cwd();
    this.logsDir = path.join(this.projectDir, 'logs');
    this.dataDir = path.join(this.projectDir, 'data');
  }

  async deploy() {
    console.log('🚀 Deploying Trading Bot with State Persistence');
    console.log('='.repeat(60));

    try {
      // Step 1: Create necessary directories
      this.createDirectories();

      // Step 2: Install PM2 globally if not installed
      await this.installPM2();

      // Step 3: Build TypeScript
      await this.buildProject();

      // Step 4: Start services with PM2
      await this.startServices();

      // Step 5: Setup monitoring
      await this.setupMonitoring();

      // Step 6: Save PM2 configuration for auto-start
      await this.setupAutoStart();

      console.log('\n✅ Deployment Complete!');
      console.log('📊 Your bot is now running with:');
      console.log('   • Automatic restart on crashes');
      console.log('   • State persistence every 30 seconds');
      console.log('   • 24/7 monitoring');
      console.log('   • Web dashboard at http://localhost:3000');
      console.log('\n🔧 Management Commands:');
      console.log('   pm2 status                 - Check status');
      console.log('   pm2 logs trading-bot        - View logs');
      console.log('   pm2 restart trading-bot     - Restart bot');
      console.log('   pm2 stop trading-bot        - Stop bot');
      console.log('   pm2 delete trading-bot      - Remove bot');

    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    }
  }

  createDirectories() {
    console.log('📁 Creating directories...');
    
    const dirs = [this.logsDir, this.dataDir];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`   Created: ${dir}`);
      }
    });
  }

  async installPM2() {
    console.log('📦 Checking PM2 installation...');
    
    try {
      execSync('pm2 --version', { stdio: 'pipe' });
      console.log('   ✅ PM2 is already installed');
    } catch (error) {
      console.log('   📥 Installing PM2...');
      execSync('npm install -g pm2', { stdio: 'inherit' });
      console.log('   ✅ PM2 installed');
    }
  }

  async buildProject() {
    console.log('🔨 Building TypeScript...');
    
    try {
      execSync('npx tsc', { stdio: 'inherit', cwd: this.projectDir });
      console.log('   ✅ TypeScript build complete');
    } catch (error) {
      console.log('   ⚠️  TypeScript build failed, using direct execution');
    }
  }

  async startServices() {
    console.log('🚀 Starting services with PM2...');
    
    // Stop existing processes
    try {
      execSync('pm2 delete trading-bot dashboard', { stdio: 'pipe' });
    } catch (error) {
      // Ignore if processes don't exist
    }

    // Start new processes
    execSync('pm2 start ecosystem.config.js', { stdio: 'inherit' });
    
    console.log('   ✅ Trading bot started');
    console.log('   ✅ Dashboard started');
    
    // Wait a moment for services to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Show status
    console.log('\n📊 Service Status:');
    execSync('pm2 status', { stdio: 'inherit' });
  }

  async setupMonitoring() {
    console.log('📈 Setting up monitoring...');
    
    // Create monitoring script
    const monitorScript = `#!/bin/bash
# Trading Bot Monitor
# Checks bot health and sends alerts

BOT_NAME="trading-bot"
LOG_FILE="./logs/monitor.log"

# Check if bot is running
if ! pm2 list | grep -q "$BOT_NAME.*online"; then
  echo "$(date): Bot is not running, restarting..." >> $LOG_FILE
  pm2 restart $BOT_NAME
  echo "$(date): Bot restarted" >> $LOG_FILE
fi

# Check for recent activity (last 5 minutes)
if ! pm2 logs $BOT_NAME --lines 20 --nostream | grep -q "$(date -d '5 minutes ago' '+%Y-%m-%d %H:')"; then
  echo "$(date): No recent activity detected" >> $LOG_FILE
fi

# Check disk space
DISK_USAGE=$(df . | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
  echo "$(date): Disk space critical: ${DISK_USAGE}%" >> $LOG_FILE
fi

# Check memory usage
MEMORY_USAGE=$(pm2 show $BOT_NAME | grep "memory usage" | awk '{print $4}')
echo "$(date): Memory usage: $MEMORY_USAGE" >> $LOG_FILE
`;

    const monitorPath = path.join(this.projectDir, 'scripts', 'monitor.sh');
    fs.writeFileSync(monitorPath, monitorScript);
    
    // Make executable
    try {
      execSync(`chmod +x ${monitorPath}`, { stdio: 'pipe' });
    } catch (error) {
      // Windows doesn't have chmod, that's okay
    }
    
    console.log('   ✅ Monitoring script created');
  }

  async setupAutoStart() {
    console.log('🔄 Setting up auto-start on reboot...');
    
    try {
      execSync('pm2 startup', { stdio: 'inherit' });
      execSync('pm2 save', { stdio: 'inherit' });
      console.log('   ✅ Auto-start configured');
    } catch (error) {
      console.log('   ⚠️  Auto-start setup failed (may need sudo)');
    }
  }

  async getStatus() {
    console.log('📊 Bot Status:');
    console.log('='.repeat(40));
    
    try {
      execSync('pm2 status', { stdio: 'inherit' });
      
      console.log('\n📂 State Persistence:');
      const stateInfo = this.getStateInfo();
      console.log(`   State file exists: ${stateInfo.hasState}`);
      console.log(`   Backup exists: ${stateInfo.backupExists}`);
      if (stateInfo.lastSaved) {
        console.log(`   Last saved: ${new Date(stateInfo.lastSaved).toLocaleString()}`);
      }
      
      console.log('\n🌐 Dashboard: http://localhost:3000');
      
    } catch (error) {
      console.log('❌ Bot is not running');
    }
  }

  getStateInfo() {
    const stateFile = path.join(this.dataDir, 'trading-state.json');
    const backupFile = path.join(this.dataDir, 'trading-state-backup.json');
    
    return {
      hasState: fs.existsSync(stateFile),
      backupExists: fs.existsSync(backupFile),
      lastSaved: fs.existsSync(stateFile) ? fs.statSync(stateFile).mtime.getTime() : null
    };
  }

  async stop() {
    console.log('🛑 Stopping trading bot...');
    
    try {
      execSync('pm2 stop trading-bot dashboard', { stdio: 'inherit' });
      console.log('✅ Services stopped');
    } catch (error) {
      console.log('⚠️  Services were not running');
    }
  }

  async restart() {
    console.log('🔄 Restarting trading bot...');
    
    try {
      execSync('pm2 restart trading-bot dashboard', { stdio: 'inherit' });
      console.log('✅ Services restarted');
      
      // Wait and show status
      await new Promise(resolve => setTimeout(resolve, 3000));
      execSync('pm2 status', { stdio: 'inherit' });
    } catch (error) {
      console.log('❌ Failed to restart services');
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2] || 'deploy';
  const deployer = new Deployer();
  
  switch (command) {
    case 'deploy':
      await deployer.deploy();
      break;
    case 'status':
      await deployer.getStatus();
      break;
    case 'stop':
      await deployer.stop();
      break;
    case 'restart':
      await deployer.restart();
      break;
    default:
      console.log('Usage: node scripts/deploy.js [deploy|status|stop|restart]');
      process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default Deployer;
