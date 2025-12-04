module.exports = {
  apps: [
    {
      name: 'trading-bot',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'info',
        PAPER_TRADING: 'true',
        REALISTIC_PAPER_TRADING: 'true',
        INITIAL_PAPER_BALANCE: '100',
        AGGRESSIVE_TRADING: 'true'
      },
      env_production: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        PAPER_TRADING: 'true',
        REALISTIC_PAPER_TRADING: 'true',
        INITIAL_PAPER_BALANCE: '100',
        AGGRESSIVE_TRADING: 'true'
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'dashboard',
      script: 'dashboard/src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: '3000'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '3000'
      },
      error_file: './logs/dashboard-error.log',
      out_file: './logs/dashboard-out.log',
      log_file: './logs/dashboard-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 3000,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '5s'
    }
  ]
};
