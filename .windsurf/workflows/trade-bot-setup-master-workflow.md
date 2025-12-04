---
description: This is a master workflow for the trading bot, call it a masterflow.
auto_execution_mode: 3
---

# Step 1: Environment Setup
- Ensure Node.js 18+ is accessible for YOU on the system, as the user can confirm that python, node, bun, deno, choco, and several others are all up to date on the windows 10 machine this IDE is hosted in. Note that the perplexity MCP has been added to easily allow for additional knowledge lookup tools and web searching as you need / please
- Navigate to the project directory:
  cd c:/Coding/LocalTools/Trade_bot

# Step 2: Set Environment Variables
- Open the .env file in the project root. If not there create one. 
- Ensure the following variables are set:
  CEREBRAS_API_KEY=your_cerebras_api_key
  HYPERLIQUID_WALLET_ADDRESS=your_wallet_address
  HYPERLIQUID_API_key, setup for this bot plus the intergrated AI.
  PAPER_TRADING=put on ice for now.
  HYPERLIQUID_TESTNET = Currently off, but we will enable it and collect from their faucet then us it for our testing.

# Step 3: Install Dependencies
- In the terminal, run:
  bun install (If I accedentally wrote node or npm anywhere else, assume I mean bun, thats my prefer usage on this windows enviroment... Plus it works with both TS and JS natively making it very handy in this sort of situaition.

######Step0 REMEMBER, TAKE UR TIME, THIS IS NOT A RUSH GO GO GO AS FAS AS YOU CAN. i EXPECT CLAUDE OPUS 5 LEVEL LOGIC AND REASONING FROM YOUR ON THIS PROJECT, THAT MEANS THAT YOU TAKE ADVANTAGE OF ALL THE TOOLS AROUND YOU. tHIS INCLUDES ACCESS TO THE INTERNET AND OTHER AI SERVICES. yOU CAN 100% FEEL FREE TO USE OUR OWN CEREBRAS API TO SETUP A SMALL SCRIPT TO SEND IT BUILDING TASKS YOU DONT WANT TO DO OR WANT HELP WITH SO THAT YOU CAN FOCUS ON PROVIDING THE BEST OF THE BEST POSSIBLE FULLY FUNTIONAL REALLY FOR LAUCH AUTO BOT DASHBOARD, NO UNHANDLED ERRORS.

# Step 4: Start the Dashboard
- In the terminal, run:
  bun run start:dashboard

# Step 5: Start the Bot in Live Mode
- In a separate terminal, run:
  npm run live

# Step 6: Verify Bot Status
- In the terminal, run:
  curl -X POST http://localhost:3001/api/bot/status

# Step 7: Add Live Crypto Prices Display
- Open the file dashboard/src/components/LivePrices.tsx.
- Implement a component to fetch and display live prices for BTC, ETH, SOL, HYPE, JUP.
- Ensure it shows the 24h change. This shouldn't matter if it's been running that long or not, it just matters if there are any balances in the portfolio for the project.

# Step 8: Add AI Chat Interface
- Open the file dashboard/src/components/ChatInterface.tsx.
- Implement the AI chat interface with assistant responses.

# Step 9: Add Full Terminal Component
- Open the file dashboard/src/components/Terminal.tsx.
- Implement the terminal component with command input and history.

# Step 10: Add AI Config Modal
- Open the file dashboard/src/components/AIConfigModal.tsx.
- Implement the modal for model selection and API key configuration.

# Step 11: Add AI Playground Modal
- Open the file dashboard/src/components/AIPlayground.tsx.
- Implement the modal for testing prompts and comparing models.

# Step 12: Add Safety Settings Modal
- Open the file dashboard/src/components/SafetySettings.tsx.
- Implement the modal for stop loss and kill switch settings.

# Step 13: Add Active Signals Display
- Open the file dashboard/src/components/ActiveSignals.tsx.
- Implement a display for active signals with strength bars.

# Step 14: Add Portfolio History Chart
- Open the file dashboard/src/components/PortfolioHistoryChart.tsx.
- Implement an area chart showing portfolio history over time.

# Step 15: Add System Status Panel
- Open the file dashboard/src/components/SystemStatus.tsx.
- Implement a panel showing mode, signals, executions, fees, and errors.

# Step 16: Add Activity Feed
- Open the file dashboard/src/components/ActivityFeed.tsx.
- Implement a real-time activity log for the bot.

# Step 17: Add Bot Start/Stop Control Buttons
- Open the file dashboard/src/components/BotControl.tsx.
- Implement buttons to start and stop the bot.

# Step 18: Fix Realistic Paper Trading
- Open the file src/core/realisticPaperTrader.ts.
- Resolve any circular dependencies properly.

# Step 19: Fix State Persistence
- Open the file src/core/statePersistence.ts.
- Ensure state persistence works for crash recovery.

# Step 20: Create Unified Launcher
- Open the file start-everything.bat.
- Update the script to ensure it opens the browser automatically after starting the bot and dashboard.

# Step 21: Test the Entire System
- Run the unified launcher:
  start-everything.bat
- Verify the dashboard displays real-time data.
- Ensure the bot can execute live trades without errors.
- Monitor the system for any issues or anomalies.

# Step 22: Set Up GitHub Repository
- Open terminal.
- Navigate to the project directory:
  cd c:/Coding/LocalTools/Trade_bot
- Initialize a new Git repository:
  git init
- Add all files to the repository:
  git add .
- Commit the changes:
  git commit -m "Initial commit"
- Create a new repository on GitHub.
- Add the remote repository:
  git remote add origin https://github.com/yourusername/your-repo-name.git
- Push the changes to GitHub:
  git push -u origin master

# Step 23: Final Verification
- Ensure the system runs continuously without errors.
- Verify state persistence and crash recovery.
- Confirm all features work as expected with live data.

# Step 24: Monitor System Performance
- Monitor the bot's performance for at least 24 hours.
- Ensure all trades execute correctly with realistic fees and delays.
- Review the performance metrics and make any necessary adjustments.

# Step 25: Documentation
- Update the DEPLOYMENT_GUIDE.md with any new setup steps or configurations.
- Document any issues encountered and how they were resolved.

# Step 26: Finalize
- Ensure all code changes are committed and pushed to GitHub.
- Confirm the system is ready for live trading.
- Trigger the start of the next workful /audit-workflow