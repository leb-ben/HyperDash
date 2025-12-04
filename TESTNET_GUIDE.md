# Testnet Trading Guide

This guide helps you transition from paper trading to real testnet trading using Hyperliquid's testnet faucet.

## 🎯 Overview

- **Paper Trading**: Simulated trades with fake money (current mode)
- **Testnet Trading**: Real trades on testnet using test tokens (no real money risk)
- **Live Trading**: Real trades on mainnet with real money (advanced)

## 🚀 Quick Start Testnet Trading

### Step 1: Configure Your Wallet

1. **Get a Testnet Wallet**
   - Use MetaMask or any EVM-compatible wallet
   - Add Hyperliquid Testnet to your wallet:
     - Network Name: Hyperliquid Testnet
     - RPC URL: `https://testnet.hyperliquid.xyz/evm`
     - Chain ID: `996`
     - Symbol: ETH

2. **Export Your Wallet Credentials**
   ```bash
   # In your .env file:
   HYPERLIQUID_PRIVATE_KEY=your_wallet_private_key_here
   HYPERLIQUID_WALLET_ADDRESS=your_wallet_address_here
   ```

### Step 2: Get Test Tokens

1. **Open the Dashboard**: http://localhost:5173
2. **Find the "Testnet Faucet" component** in the right column
3. **Click "Get Test Tokens"** - this opens Hyperliquid's faucet
4. **Connect your wallet** on the faucet page
5. **Request test tokens** (usually 10,000 test USDC)

### Step 3: Enable Testnet Trading

1. **Edit your .env file**:
   ```env
   # Disable paper trading
   PAPER_TRADING=false
   
   # Ensure testnet is enabled
   HYPERLIQUID_TESTNET=true
   ```

2. **Restart the bot**:
   ```bash
   # Stop current bot (Ctrl+C)
   # Restart with:
   node dist/index.js
   ```

3. **Verify in Dashboard**:
   - Testnet Faucet should show "Testnet Active" 
   - Bot mode should display "TESTNET" instead of "PAPER"

## 📊 What Changes in Testnet Mode

### Real Exchange Connection
- Orders go to Hyperliquid's testnet exchange
- Real order book and price feeds
- Actual trade execution with test tokens

### Portfolio Management
- Real testnet wallet balance
- Actual position tracking
- Real fees (but paid with test tokens)

### Risk Management
- Same safety features as paper trading
- Stop losses and take profits work with real positions
- No risk of losing real money

## 🔧 Dashboard Features

### Testnet Faucet Component
- **Status Indicator**: Shows current mode (Paper/Testnet)
- **Wallet Address**: Displays your configured wallet (masked for security)
- **Quick Actions**: 
  - "Get Test Tokens" - Opens faucet
  - "Open Testnet Exchange" - View your positions

### System Status
- Trading mode displays "TESTNET" when active
- Real portfolio value from testnet
- Live position data from exchange

## 🛠️ Troubleshooting

### Common Issues

1. **"Not configured" wallet address**
   - Check `HYPERLIQUID_WALLET_ADDRESS` in .env
   - Ensure address is valid (starts with 0x)

2. **Bot still shows paper mode**
   - Verify `PAPER_TRADING=false` in .env
   - Restart the bot after changing .env

3. **No test tokens received**
   - Ensure you're connected to testnet in your wallet
   - Try the faucet again after a few minutes
   - Check wallet has testnet enabled

4. **Orders not executing**
   - Verify wallet has sufficient test USDC
   - Check bot logs for any error messages
   - Ensure testnet is enabled in .env

### Getting Help

1. **Check Bot Logs**: Look for connection/trading errors
2. **Verify Configuration**: Double-check all .env settings
3. **Testnet Status**: Ensure Hyperliquid testnet is operational

## 📈 Best Practices

### Start Small
- Begin with small position sizes
- Test a few trades before increasing size
- Monitor the bot's behavior closely

### Monitor Performance
- Watch the activity feed for trade decisions
- Check portfolio changes after each cycle
- Review error logs if trades fail

### Security
- Never use mainnet private keys for testnet
- Keep testnet and mainnet wallets separate
- Don't share your private keys

## 🔄 Switching Back to Paper Trading

To return to paper trading:
1. Edit .env: `PAPER_TRADING=true`
2. Restart the bot
3. Dashboard will show "Paper Mode" again

## 🎉 Next Steps

Once comfortable with testnet trading:
1. **Monitor Performance**: Track win rates and profitability
2. **Adjust Parameters**: Fine-tune risk settings
3. **Consider Live Trading**: Only when consistently profitable

---

## 📞 Support

- **Dashboard**: http://localhost:5173
- **Bot API**: http://localhost:3001
- **Testnet Exchange**: https://testnet.hyperliquid.xyz/
- **Faucet**: https://testnet.hyperliquid.xyz/faucet

**Remember**: Testnet trading uses real exchange infrastructure but no real money is at risk. It's the perfect way to test strategies before considering live trading.
