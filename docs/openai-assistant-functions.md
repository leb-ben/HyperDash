# OpenAI Assistant Functions for Trading Bot

These function definitions can be used when creating a custom OpenAI Assistant to interact with your trading bot via the API.

## Function Definitions (JSON Schema)

```json
[
  {
    "name": "get_portfolio_state",
    "description": "Get current portfolio state including total value, available balance, and all open positions with their P&L",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": []
    }
  },
  {
    "name": "get_market_data",
    "description": "Get current prices, 24h change, and volume for specified trading symbols",
    "parameters": {
      "type": "object",
      "properties": {
        "symbols": {
          "type": "array",
          "items": { "type": "string" },
          "description": "List of symbols to get data for (e.g., ['BTC', 'ETH', 'SOL'])"
        }
      },
      "required": ["symbols"]
    }
  },
  {
    "name": "get_active_signals",
    "description": "Get currently active trading signals with their type, direction, and strength",
    "parameters": {
      "type": "object",
      "properties": {
        "min_strength": {
          "type": "number",
          "description": "Minimum signal strength (0-100) to filter by"
        },
        "symbol": {
          "type": "string",
          "description": "Optional: filter signals for a specific symbol"
        }
      },
      "required": []
    }
  },
  {
    "name": "get_technical_indicators",
    "description": "Get technical analysis indicators for a symbol at a specific timeframe",
    "parameters": {
      "type": "object",
      "properties": {
        "symbol": {
          "type": "string",
          "description": "Trading symbol (e.g., 'BTC')"
        },
        "timeframe": {
          "type": "string",
          "enum": ["5m", "15m", "1h", "4h"],
          "description": "Candle timeframe"
        }
      },
      "required": ["symbol", "timeframe"]
    }
  },
  {
    "name": "place_order",
    "description": "Place a new trading order. USE WITH CAUTION - this executes real trades!",
    "parameters": {
      "type": "object",
      "properties": {
        "symbol": {
          "type": "string",
          "description": "Trading symbol (e.g., 'BTC')"
        },
        "side": {
          "type": "string",
          "enum": ["long", "short"],
          "description": "Position side"
        },
        "size_pct": {
          "type": "number",
          "description": "Position size as percentage of available balance (1-100)"
        },
        "leverage": {
          "type": "number",
          "description": "Leverage multiplier (1-10)"
        },
        "stop_loss": {
          "type": "number",
          "description": "Stop loss price (required)"
        },
        "take_profit": {
          "type": "number",
          "description": "Take profit price (optional)"
        },
        "reason": {
          "type": "string",
          "description": "Reason for the trade (for logging)"
        }
      },
      "required": ["symbol", "side", "size_pct", "stop_loss"]
    }
  },
  {
    "name": "close_position",
    "description": "Close an existing position for a symbol",
    "parameters": {
      "type": "object",
      "properties": {
        "symbol": {
          "type": "string",
          "description": "Symbol of position to close"
        },
        "reason": {
          "type": "string",
          "description": "Reason for closing"
        }
      },
      "required": ["symbol"]
    }
  },
  {
    "name": "get_fee_estimate",
    "description": "Estimate trading fees and slippage for a potential order",
    "parameters": {
      "type": "object",
      "properties": {
        "order_size_usd": {
          "type": "number",
          "description": "Order size in USD"
        },
        "is_market_order": {
          "type": "boolean",
          "description": "True for market order (taker fee), false for limit (maker fee)"
        }
      },
      "required": ["order_size_usd"]
    }
  },
  {
    "name": "get_historical_trades",
    "description": "Get historical trade performance data",
    "parameters": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Number of trades to return (max 100)"
        },
        "symbol": {
          "type": "string",
          "description": "Optional: filter by symbol"
        }
      },
      "required": []
    }
  },
  {
    "name": "control_bot",
    "description": "Start or stop the trading bot",
    "parameters": {
      "type": "object",
      "properties": {
        "action": {
          "type": "string",
          "enum": ["start", "stop", "status"],
          "description": "Bot control action"
        }
      },
      "required": ["action"]
    }
  },
  {
    "name": "update_safety_settings",
    "description": "Update safety/risk management settings",
    "parameters": {
      "type": "object",
      "properties": {
        "max_daily_loss_pct": {
          "type": "number",
          "description": "Maximum daily loss percentage before bot pauses"
        },
        "stop_loss_pct": {
          "type": "number",
          "description": "Global stop loss percentage"
        },
        "enable_global_stop_loss": {
          "type": "boolean",
          "description": "Enable/disable global stop loss"
        }
      },
      "required": []
    }
  }
]
```

## System Prompt for Trading Assistant

```
You are an AI trading assistant for a Hyperliquid perpetual futures trading bot. You have access to real-time market data, portfolio state, and can execute trades.

CRITICAL RULES:
1. NEVER place trades without explicit user confirmation
2. Always check portfolio state before suggesting trades
3. Risk management is paramount - never exceed position limits
4. Always provide reasoning for trading decisions
5. Monitor stop losses and warn about risk

When analyzing markets:
- Check RSI for overbought (>70) / oversold (<30) conditions
- Consider MACD histogram direction and crossovers
- Look at Bollinger Band position (0% = lower, 100% = upper)
- Factor in funding rates for perpetual positions
- Consider volume relative to average

Before any trade:
1. Get current portfolio state
2. Check active signals
3. Get technical indicators
4. Estimate fees
5. Confirm with user

Always prioritize capital preservation over profits.
```

## Example API Mapping

These functions map to your bot's API endpoints:

| Function | Endpoint | Method |
|----------|----------|--------|
| get_portfolio_state | /api/portfolio | GET |
| get_market_data | /api/prices | GET |
| get_active_signals | /api/signals | GET |
| get_technical_indicators | /api/indicators/:symbol/:tf | GET |
| place_order | /api/trade | POST |
| close_position | /api/trade/close | POST |
| get_fee_estimate | /api/fees/estimate | POST |
| get_historical_trades | /api/trades/recent | GET |
| control_bot | /api/bot/start or /api/bot/stop | POST |
| update_safety_settings | /api/safety/config | PUT |

## Usage Notes

1. **Token Sharing Program**: Since you mentioned enabling this, the Assistant will share your conversation context. Good for continuity but be aware of data sharing.

2. **High Reasoning (o1)**: For the trading assistant, using o1's high reasoning is excellent for complex market analysis. The extra reasoning tokens are worth it for financial decisions.

3. **Cost Optimization**: For routine queries (status, prices), use gpt-4o-mini. Reserve o1 for actual trading decisions and complex analysis.
