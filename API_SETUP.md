# API Setup Guide

This trading bot requires API keys to function properly. Below are the required credentials and where to obtain them.

## Required API Keys

### 1. Cerebras AI API
- **Purpose**: Powers the AI trading assistant and decision-making
- **Environment Variable**: `CEREBRAS_API_KEY`
- **How to Obtain**: 
  1. Visit [Cerebras AI Console](https://console.cerebras.ai/)
  2. Create an account and verify your email
  3. Navigate to API Keys section
  4. Generate a new API key
  5. Copy the key and add it to your `.env` file

### 2. Hyperliquid API
- **Purpose**: Connects to the Hyperliquid exchange for trading
- **Environment Variables**: 
  - `HYPERLIQUID_PRIVATE_KEY`
  -HYPERLIQUID_WALLET_ADDRESS`
- **How to Obtain**:
  1. Install a compatible wallet (e.g., MetaMask) with Hyperliquid network
  2. Create or import your wallet
  3. Export your private key (keep this secure!)
  4. Copy your wallet address
  5. Add both to your `.env` file

### 3. Perplexity API (Optional)
- **Purpose**: Enhanced AI capabilities and web search
- **Environment Variable**: `PERPLEXITY_API_KEY`
- **How to Obtain**:
  1. Visit [Perplexity API Console](https://www.perplexity.ai/settings/api)
  2. Generate an API key
  3. Add to your `.env` file

## Configuration Steps

1. **Copy the environment template**:
   ```bash
   cp .env .env.local
   ```

2. **Edit your `.env` file**:
   ```env
   # Cerebras AI API
   CEREBRAS_API_KEY=your_actual_cerebras_api_key_here

   # Hyperliquid (wallet-based auth)
   HYPERLIQUID_PRIVATE_KEY=your_actual_wallet_private_key_here
   HYPERLIQUID_WALLET_ADDRESS=your_actual_wallet_address_here

   # Optional: Use testnet first
   HYPERLIQUID_TESTNET=true

   # Bot Settings
   LOG_LEVEL=info
   PAPER_TRADING=true
   PERPLEXITY_API_KEY=your_actual_perplexity_api_key_here
   ```

3. **Test Your Configuration**:
   ```bash
   # Test bot connection
   bun run live

   # Test dashboard
   bun run start:dashboard
   ```

## Security Notes

- **NEVER** commit your `.env` file to version control
- **NEVER** share your private keys with anyone
- Consider using environment-specific files (`.env.test`, `.env.prod`)
- Enable testnet mode first before using real funds

## Troubleshooting

### Common Issues

1. **"invalid BytesLike value" Error**
   - Cause: Invalid or placeholder private key
   - Solution: Ensure your `HYPERLIQUID_PRIVATE_KEY` starts with `0x` and is a valid hex string

2. **API Connection Failed**
   - Cause: Invalid API keys or network issues
   - Solution: Verify keys are correct and check network connectivity

3. **Dashboard Shows "Connecting to Trading Bot..."**
   - Cause: Bot API server not running on port 3001
   - Solution: Ensure bot is started before dashboard

### Getting Help

- Check the logs in both terminal windows
- Verify all environment variables are set correctly
- Ensure ports 3001 and 5173 are available

## Next Steps

Once API keys are configured:
1. Run `start-everything.bat` to launch the complete system
2. Open your browser to `http://localhost:5173`
3. Start with paper trading mode to test functionality
4. Gradually move to live trading when comfortable

## Disclaimer

Trading cryptocurrencies involves substantial risk. Always:
- Start with paper trading
- Use only funds you can afford to lose
- Monitor the bot closely during initial runs
- Keep your API keys secure at all times
