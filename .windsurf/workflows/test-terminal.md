---
description: Test the xterm.js terminal integration end-to-end
---

# Terminal Integration Test Workflow

## Prerequisites

Ensure no other instances are running:

// turbo
```bash
taskkill /F /IM node.exe 2>nul || echo "No node processes to kill"
```

---

## Step 1: Start Backend

// turbo
```bash
npm run dev
```

Wait for:
- "Terminal WebSocket server started on ws://localhost:3002"
- "API server running on http://localhost:3001"

---

## Step 2: Start Dashboard

// turbo
```bash
cd dashboard && npm run dev
```

Wait for:
- "VITE ready"
- "Local: http://localhost:5173/"

---

## Step 3: Verify Terminal Server

// turbo
```bash
curl -s http://localhost:3001/api/system | findstr /i "bot"
```

Should return bot status JSON.

---

## Step 4: Manual Testing

Open http://localhost:5173 in browser and verify:

1. [ ] Dashboard loads without errors
2. [ ] "Shell Terminal" section is visible
3. [ ] Terminal shows "PowerShell Terminal Connected"
4. [ ] Type `whoami` - should show username
5. [ ] Type `Get-Date` - should show current date
6. [ ] Type `npm --version` - should show npm version
7. [ ] Type `cd ..` then `dir` - should show parent directory

---

## Step 5: Test Bot Commands in Terminal

In the shell terminal:

```powershell
# Navigate to project
cd C:\Coding\LocalTools\Trade_bot

# Check bot status
curl http://localhost:3001/api/bot/status

# View portfolio
curl http://localhost:3001/api/portfolio
```

---

## Step 6: Cleanup

// turbo
```bash
taskkill /F /IM node.exe
```

---

## Expected Results

| Test | Expected |
|------|----------|
| Terminal connects | Green "Connected" message |
| Commands execute | Output displayed in terminal |
| Resize works | Terminal adjusts to container |
| Multiple commands | History maintained |
| Bot API accessible | JSON responses returned |

---

## Common Issues

### Terminal shows "Disconnected"
- Check if terminal server is running on port 3002
- Verify no firewall blocking WebSocket

### Commands not executing
- Ensure PowerShell is available
- Check for PATH issues

### Dashboard not loading
- Clear browser cache
- Check Vite dev server console for errors
