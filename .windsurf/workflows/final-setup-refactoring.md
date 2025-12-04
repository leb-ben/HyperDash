---
description: 
auto_execution_mode: 3
---

# Workflow: Enterprise-Level Setup and Configuration for AI-Driven Crypto Trading Bot

## Step 1: Environment Setup
1.1. Verify Bun Installation:
  - Check Bun version:
    ```sh
    bun --version
    ```
  - If not installed, download and install from:
    [https://bun.sh/](https://bun.sh/)

1.2. Verify Node.js Installation (Fallback):
  - Check Node.js version:
    ```sh
    node -v
    ```
  - If not installed, download and install from:
    [https://nodejs.org/](https://nodejs.org/)

1.3. Navigate to Project Directory:
  - Open terminal.
  - Change to the project directory:
    ```sh
    cd c:/Coding/LocalTools/Trade_bot
    ```

## Step 2: Set Environment Variables
2.1. Configure Environment Variables:
  - Open the `.env` file in the project root. If the file does not exist, create it.
  - Ensure the following variables are set:
    ```env
    CEREBRAS_API_KEY=your_cerebras_api_key
    HYPERLIQUID_API_KEY=your_hyperliquid_api_key
    HYPERLIQUID_WALLET_ADDRESS=your_wallet_address
    PAPER_TRADING=false
    HYPERLIQUID_FAUCET_COLLECTION=true
    HYPERLIQUID_TESTNET=true
    ```
  - Save and close the file.

## Step 3: Install Dependencies
3.1. Install Project Dependencies:
  - In the terminal, run:
    ```sh
    bun install
    ```
  - Wait for the installation to complete and ensure there are no errors.

## Step 4: Start the Dashboard
4.1. Launch the Dashboard:
  - In the terminal, run:
    ```sh
    bun run dev
    ```
  - Wait for the dashboard to start.
  - Open a web browser and navigate to:
    [http://localhost:5173](http://localhost:5173)
  - Verify the dashboard loads without errors.

## Step 5: Start the Bot in Live Mode
5.1. Launch the Bot:
  - Open a new terminal window.
  - Change to the project directory:
    ```sh
    cd c:/Coding/LocalTools/Trade_bot
    ```
  - Run the bot in live mode:
    ```sh
    bun run live
    ```
  - Wait for the bot to start and ensure there are no errors during startup.

## Step 6: Verify Bot Status
6.1. Check Bot Status:
  - In the terminal, run:
    ```sh
    curl -X POST http://localhost:3001/api/bot/status
    ```
  - Verify the response indicates the bot is running.

## Step 7: Add Build Mode for AI Configuration Changes
7.1. Implement Build Mode:
  - Open the file [dashboard/src/components/ChatInterface.tsx](cci:7://file:///c:/Coding/LocalTools/Trade_bot/dashboard/src/components/ChatInterface.tsx:0:0-0:0).
  - Add a state variable to track build mode status.
  - Implement a toggle switch in the UI to enable/disable build mode.
  - Add logic to grant the AI permission to make configuration changes only when build mode is enabled.
  - Save and close the file.
  - Test the build mode functionality in the dashboard.

## Step 8: Remove Dummy Data and Use Real Data
8.1. Replace Dummy Data:
  - Open the file [src/core/dataCollector.ts](cci:7://file:///c:/Coding/LocalTools/Trade_bot/src/core/dataCollector.ts:0:0-0:0).
  - Identify and remove any dummy data.
  - Implement data fetching from real APIs:
    - Replace placeholder data with API calls to fetch real-time data.
    - Ensure `NaN` is displayed when data fetch fails.
  - Save and close the file.

## Step 9: Set Up Hyperliquid API Keys
9.1. Configure Hyperliquid API Key:
  - Open the `.env` file.
  - Ensure the API key for Hyperliquid's exchange is set correctly:
    ```env
    HYPERLIQUID_API_KEY=your_hyperliquid_api_key
    ```
  - Save and close the file.

## Step 10: Configure AI to Collect from Hyperliquid's Faucet
10.1. Implement Faucet Collection:
  - Open the file [src/core/aiEngine.ts](cci:7://file:///c:/Coding/LocalTools/Trade_bot/src/core/aiEngine.ts:0:0-0:0).
  - Implement a function to collect 1000 test coins from Hyperliquid's faucet:
    - Add a method to call the Hyperliquid faucet API.
    - Ensure the function is called at the start of the test run.
  - Save and close the file.
  - Test the faucet collection functionality.

## Step 11: Implement Trade Risk/Aggression Setting
11.1. Add Risk/Aggression Setting:
  - Open the file [dashboard/src/components/AIConfigModal.tsx](cci:7://file:///c:/Coding/LocalTools/Trade_bot/dashboard/src/components/AIConfigModal.tsx:0:0-0:0).
  - Add a setting for trade risk/aggression acceptance:
    - Implement a dropdown or slider to adjust the risk/aggression level.
    - Ensure this setting does not change the stop loss unless manually adjusted.
    - Lower the confidence score threshold based on the risk/aggression setting.
  - Save and close the file.

## Step 12: Improve Confidence Score Calculations
12.1. Enhance Confidence Metrics:
  - Open the file [src/core/aiEngine.ts](cci:7://file:///c:/Coding/LocalTools/Trade_bot/src/core/aiEngine.ts:0:0-0:0).
  - Implement better metrics for calculating confidence scores:
    - Include social media cues and forum news checks as additional signals.
    - Integrate APIs or scraping tools to gather data from these sources.
    - Ensure confidence scores are recalculated using these enhanced metrics.
  - Save and close the file.

## Step 13: Ensure Accurate Confidence Levels
13.1. Adjust Confidence Calculations:
  - Open the file [src/core/executor.ts](cci:7://file:///c:/Coding/LocalTools/Trade_bot/src/core/executor.ts:0:0-0:0).
  - Adjust the confidence level calculations to require a higher threshold for trades:
    - Implement logic to handle confidence levels more accurately.
    - Avoid low-confidence trades based on the improved metrics.
  - Save and close the file.

## Step 14: Test the Entire System
14.1. Run Unified Launcher:
  - Run the unified launcher:
    ```sh
    start-everything.bat
    ```
  - Verify the dashboard displays real-time data.
  - Ensure the bot can execute live trades without errors.
  - Monitor the system for any issues or anomalies.

## Step 15: Set Up GitHub Repository
15.1. Initialize Git Repository:
  - Open terminal.
  - Navigate to the project directory:
    ```sh
    cd c:/Coding/LocalTools/Trade_bot
    ```
  - Initialize a new Git repository:
    ```sh
    git init
    ```
  - Add all files to the repository:
    ```sh
    git add .
    ```
  - Commit the changes:
    ```sh
    git commit -m "Initial commit"
    ```

15.2. Create Remote Repository and Push:
  - Create a new repository on GitHub.
  - Add the remote repository:
    ```sh
    git remote add origin [https://github.com/yourusername/your-repo-name.git](https://github.com/yourusername/your-repo-name.git)
    ```
  - Push the changes to GitHub:
    ```sh
    git push -u origin master
    ```

## Step 16: Final Verification
16.1. Continuous System Verification:
  - Ensure the system runs continuously without errors.
  - Verify state persistence and crash recovery.
  - Confirm all features work as expected with live data.

## Step 17: Monitor System Performance
17.1. Performance Monitoring:
  - Monitor the bot's performance for at least 24 hours:
    - Ensure all trades execute correctly with realistic fees and delays.
    - Review the performance metrics and make any necessary adjustments.

## Step 18: Documentation
18.1. Update Documentation:
  - Update the `DEPLOYMENT_GUIDE.md` with any new setup steps or configurations.
  - Document any issues encountered and how they were resolved.

## Step 19: Finalize
19.1. Final Preparations:
  - Ensure all code changes are committed and pushed to GitHub.
  - Confirm the system is ready for live trading.
  - Notify stakeholders of the successful setup and testing.