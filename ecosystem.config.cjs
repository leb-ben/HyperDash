/**
 * PM2 Ecosystem Configuration for Production Deployment
 * Handles process management, auto-restart, and monitoring
 * 
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs
 *   pm2 monit
 *   pm2 stop all
 */

module.exports = {
  apps: [
    {
      name: 'trading-bot-backend',
      script: 'bun',
      args: 'run dev',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      merge_logs: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
    {
      name: 'trading-bot-dashboard',
      script: 'bun',
      args: 'run dev',
      cwd: './dashboard',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '../logs/dashboard-error.log',
      out_file: '../logs/dashboard-out.log',
      log_file: '../logs/dashboard-combined.log',
      time: true,
      merge_logs: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 10000,
      kill_timeout: 5000,
    }
  ]
};
