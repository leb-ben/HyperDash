# Headless Server Deployment Guide

This bot is designed to run headless on a server without manual intervention.

## Quick Start (Development)

For local testing with terminal windows:
```bash
start-everything.bat
```

## Production Deployment (Headless)

### Option 1: Simple Headless Mode (Windows)

```bash
start-headless.bat
```

This runs the bot in background mode with logs written to `logs/` directory:
- `logs/backend.log` - Backend trading bot logs
- `logs/dashboard.log` - Dashboard server logs
- `logs/startup.log` - Startup process logs

### Option 2: PM2 Process Manager (Recommended for Linux/Production)

PM2 provides automatic restarts, monitoring, and log management:

```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start ecosystem.config.cjs

# Monitor processes
pm2 monit

# View logs
pm2 logs

# Stop the bot
pm2 stop all

# Restart the bot
pm2 restart all

# Setup auto-start on server reboot
pm2 startup
pm2 save
```

## Port Configuration

The bot uses these ports:
- **3003** - Backend API
- **5173/5174** - Dashboard (auto-selects if port is taken)

Ensure these ports are:
1. Open in your firewall
2. Not used by other applications
3. Accessible from your network (if remote access needed)

## Environment Variables

Required in `.env`:
```env
HYPERLIQUID_PRIVATE_KEY=0x...
HYPERLIQUID_WALLET_ADDRESS=0x...
HYPERLIQUID_TESTNET=true

CEREBRAS_API_KEY=...
```

Optional:
```env
OPENAI_API_KEY=...
PERPLEXITY_API_KEY=...
PAPER_TRADING=false
```

## Monitoring

### Logs Location
- **Headless mode**: `logs/` directory
- **PM2 mode**: `~/.pm2/logs/`

### Health Checks
Monitor backend health:
```bash
curl http://localhost:3003/api/system
```

### Dashboard Access
Access dashboard remotely by:
1. Setting up reverse proxy (nginx/caddy)
2. Using SSH tunnel: `ssh -L 5173:localhost:5173 user@server`
3. Opening firewall port (not recommended for production)

## Auto-Restart on Failure

### PM2 (Recommended)
PM2 automatically restarts on:
- Crashes
- Memory limits exceeded
- Manual restarts
- Server reboots (with `pm2 startup`)

### Windows Service (Alternative)
Use NSSM (Non-Sucking Service Manager):
```bash
# Install NSSM
choco install nssm

# Create service
nssm install TradingBot "C:\path\to\start-headless.bat"
nssm set TradingBot AppDirectory "C:\Coding\LocalTools\Trade_bot"
nssm start TradingBot
```

## Troubleshooting

### Bot won't start
1. Check `.env` exists and has required keys
2. Check ports 3003/5173 are available
3. Check logs in `logs/` directory
4. Verify dependencies: `bun install`

### Dashboard not accessible
1. Check `logs/dashboard.log` for errors
2. Verify port 5173 or 5174 is open
3. Check firewall settings

### Backend crashes
1. Check `logs/backend.log` for errors
2. Verify API keys are valid
3. Check Hyperliquid connection
4. Ensure sufficient funds in wallet

## Security Notes

For production deployment:
1. Use environment variables, never commit `.env`
2. Restrict dashboard access (VPN/SSH tunnel)
3. Use HTTPS with reverse proxy
4. Monitor logs for suspicious activity
5. Keep dependencies updated
6. Use testnet first, then mainnet with small amounts

## Maintenance

### Update the bot
```bash
git pull
bun install
bun run build
pm2 restart all
```

### View performance
```bash
pm2 monit
```

### Backup data
```bash
# Backup trading data
cp -r data/ backups/data-$(date +%Y%m%d)/
```

## Support

Check logs first:
- `logs/backend.log` - Trading logic errors
- `logs/dashboard.log` - UI errors
- `logs/startup.log` - Deployment issues

For issues, provide:
1. Error logs
2. Environment (OS, Node version)
3. Configuration (without private keys)
