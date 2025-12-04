#!/usr/bin/env node

/**
 * Unified Launch Script - Starts Trading Bot + Dashboard
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting AI Trading Bot + Dashboard...\n');

// Start the trading bot
console.log('📡 Starting Trading Bot...');
const botProcess = spawn('node', ['--loader', 'ts-node/esm', 'src/index.ts'], {
  cwd: __dirname,
  stdio: 'pipe',
  shell: true
});

botProcess.stdout.on('data', (data) => {
  console.log(`[BOT] ${data.toString().trim()}`);
});

botProcess.stderr.on('data', (data) => {
  console.error(`[BOT ERROR] ${data.toString().trim()}`);
});

// Wait a bit for bot to start, then launch dashboard
setTimeout(() => {
  console.log('\n🌐 Starting Dashboard...');
  
  // Try multiple ways to start the dashboard
  const dashboardCommands = [
    { cmd: 'node', args: ['node_modules/.bin/vite', '--port', '3000'], cwd: path.join(__dirname, 'dashboard') },
    { cmd: 'npx', args: ['vite', '--port', '3000'], cwd: path.join(__dirname, 'dashboard') },
    { cmd: 'npm', args: ['run', 'dev'], cwd: path.join(__dirname, 'dashboard') }
  ];
  
  let dashboardStarted = false;
  
  function tryNextCommand(index = 0) {
    if (index >= dashboardCommands.length || dashboardStarted) return;
    
    const { cmd, args, cwd } = dashboardCommands[index];
    console.log(`Trying: ${cmd} ${args.join(' ')}`);
    
    const dashboardProcess = spawn(cmd, args, {
      cwd,
      stdio: 'pipe',
      shell: true
    });
    
    let output = '';
    
    dashboardProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Local:') || output.includes('localhost:3000')) {
        dashboardStarted = true;
        console.log('\n✅ Dashboard started successfully!');
        console.log('🌐 Open http://localhost:3000 in your browser');
        console.log('\n🎯 Both Bot and Dashboard are now running!');
      }
      console.log(`[DASHBOARD] ${data.toString().trim()}`);
    });
    
    dashboardProcess.stderr.on('data', (data) => {
      console.error(`[DASHBOARD ERROR] ${data.toString().trim()}`);
    });
    
    dashboardProcess.on('close', (code) => {
      if (!dashboardStarted && code !== 0) {
        console.log(`Command failed with code ${code}, trying next...`);
        tryNextCommand(index + 1);
      }
    });
    
    // Give each command 5 seconds to work
    setTimeout(() => {
      if (!dashboardStarted) {
        dashboardProcess.kill();
        tryNextCommand(index + 1);
      }
    }, 5000);
  }
  
  tryNextCommand();
  
}, 3000);

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  botProcess.kill();
  process.exit(0);
});

console.log('⏳ Waiting for services to start...');
