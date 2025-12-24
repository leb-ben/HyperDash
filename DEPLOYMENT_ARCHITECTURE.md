# Deployment Architecture

## Overview
This trading bot is designed to run on a headless server with full web-based control. All functionality - trading, monitoring, diagnostics, and system administration - is accessible through a web dashboard.

## Architecture Philosophy
**"Building modifications while standing inside the house"** - The dashboard provides complete backend access, allowing you to:
- Monitor all bot activity in real-time
- View live logs and diagnostics
- Execute terminal commands
- Control trading operations
- Modify configurations
- All without SSH access

## Port Structure

### Development (Current Setup)
```
Local Machine:
├── Backend API Server:    localhost:3003
│   ├── Trading bot logic
│   ├── REST API endpoints (/api/*)
│   ├── Real-time data streams
│   └── Bot control endpoints
│
├── Terminal WebSocket:    localhost:3002
│   └── Shell access (PowerShell/Bash)
│
├── Log Stream WebSocket:  localhost:3003
│   └── Real-time log streaming
│
└── Dashboard UI:          localhost:5173 (Vite dev server)
    ├── React frontend
    ├── Trading controls
    ├── Diagnostics viewer (logs)
    ├── Terminal tab
    └── Configuration management
```

### Production Deployment (Single IP, Multiple Services)

**YES - Everything runs on ONE IP address with different ports, unified through a reverse proxy.**

```
your-trading-bot.com (Single IP: xxx.xxx.xxx.xxx)
↓
Reverse Proxy (Nginx/Caddy on port 443 HTTPS)
├── /                    → Dashboard UI (React build)
├── /api/*               → Backend API (proxy to port 3003)
├── /ws/terminal         → Terminal WebSocket (proxy to port 3002)
└── /ws/logs             → Log Stream WebSocket (proxy to port 3003)
```

**No separate IPs needed. No subdomains required. All paths under one domain.**

## How This Works (Analogy)

Think of it like an apartment building:
- **One address** (your-trading-bot.com)
- **Multiple apartments** (different services on different ports)
- **One main entrance** (reverse proxy on port 443)
- **Doorman** (reverse proxy) directs you to the right apartment based on the path

## Production Setup Steps

### 1. Server Setup
```bash
# On your Ubuntu/Debian server
apt update && apt install -y nginx nodejs npm certbot python3-certbot-nginx

# Clone your repo
git clone <your-repo> /opt/trading-bot
cd /opt/trading-bot

# Install dependencies
npm install
cd dashboard && npm install && npm run build
cd ..
```

### 2. Start Backend (PM2 for persistence)
```bash
npm install -g pm2
pm2 start src/index.ts --name trading-bot --interpreter tsx
pm2 save
pm2 startup
```

### 3. Nginx Reverse Proxy Configuration

Create `/etc/nginx/sites-available/trading-bot`:
```nginx
# Upstream definitions
upstream backend_api {
    server 127.0.0.1:3003;
}

upstream terminal_ws {
    server 127.0.0.1:3002;
}

upstream logs_ws {
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name your-trading-bot.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-trading-bot.com;
    
    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-trading-bot.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-trading-bot.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Dashboard UI (React build)
    location / {
        root /opt/trading-bot/dashboard/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Terminal WebSocket
    location /ws/terminal {
        proxy_pass http://terminal_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
    
    # Log Stream WebSocket
    location /ws/logs {
        proxy_pass http://logs_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/trading-bot /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 4. SSL Certificate (Let's Encrypt)
```bash
certbot --nginx -d your-trading-bot.com
```

### 5. Firewall Configuration
```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirects to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw enable
```

## Security Considerations

### Authentication Layer (Add This)
You mentioned wanting login protection. Add this to your dashboard:

1. **Basic Auth** (Quick): Add to Nginx config
```nginx
location / {
    auth_basic "Trading Bot Access";
    auth_basic_user_file /etc/nginx/.htpasswd;
    # ... rest of config
}
```

2. **JWT Auth** (Better): Implement in your React app
   - Login page before dashboard
   - JWT tokens stored in httpOnly cookies
   - Protect all API endpoints with middleware

3. **VPN/Tailscale** (Most Secure): Only accessible via VPN
   - No public exposure
   - Private network access only

## "Warm Swap" vs "Hot Swap" Architecture

Your suggestion of separating concerns is smart. Here's the recommended approach:

### Option A: Single Dashboard (Current)
```
Dashboard (port 5173/443)
├── Trading Tab (live operations)
├── Diagnostics Tab (logs)
├── Terminal Tab (backend access)
└── Settings Tab (configuration)
```
**Pros**: Simple, unified interface
**Cons**: Changes require full app restart

### Option B: Dual Dashboard (Your Warm Swap Idea)
```
Main Trading Dashboard (port 5173/443)
├── Trading operations
├── Portfolio view
├── Signals
└── Basic monitoring

Admin Dashboard (port 5174/444)
├── System diagnostics
├── Log viewer
├── Terminal access
├── Configuration changes
└── Code deployment
```
**Pros**: Can update admin without affecting trading
**Cons**: Two separate UIs to maintain

**Recommendation**: Start with Option A (single dashboard). If you need warm swap capabilities, you can split it later. The architecture supports both without needing separate IPs.

## Network Topology Summary

**Single IP Configuration** (Recommended):
```
Internet
    ↓
Your Server (1 IP: 123.45.67.89)
    ↓
Nginx (Port 443)
    ├─→ Dashboard UI (/)
    ├─→ API (→ localhost:3003)
    ├─→ Terminal WS (→ localhost:3002)
    └─→ Logs WS (→ localhost:3003)
```

**Everything accessible via**: `https://your-trading-bot.com/*`

## Current Status

✅ Backend API serving on port 3003
✅ Terminal WebSocket on port 3002
✅ Log Stream WebSocket on port 3003
✅ Dashboard configured to connect to all services
✅ Startup script launches both backend and frontend
✅ Auto-detection of production vs development URLs

## Next Steps

1. ✅ Run `start-everything.bat` - launches both services
2. ✅ Access dashboard at `http://localhost:5173`
3. Test all tabs (Signals, Bot Diagnostics, Terminal)
4. For production: Follow deployment steps above
5. Add authentication layer
6. Configure domain and SSL

## Questions Answered

**Q: Do services need separate IPs?**
A: No. All services run on one IP with different ports, unified by reverse proxy.

**Q: Can they be on the same IP but different subdomains?**
A: Yes, but not necessary. Paths work better: `/api`, `/ws/terminal`, etc.

**Q: Can I have full backend access from the dashboard?**
A: Yes. The Terminal tab gives you shell access. Diagnostics shows all logs. API endpoints control everything.

**Q: Is this design possible?**
A: Yes. This is exactly how platforms like Portainer, Grafana, and Proxmox work - web-based admin with full backend control.
