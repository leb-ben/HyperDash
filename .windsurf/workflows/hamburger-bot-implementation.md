---
description: Complete autonomous implementation of the Hamburger Bot trading system with Blackbox backtesting integration
---

# Hamburger Bot Implementation Workflow

## Overview
This workflow implements the AI-driven "Hamburger Bot" trading system with 4 real positions and infinite virtual grid monitoring. The approach uses Blackbox-built backtesting for validation instead of paper trading.

## Phase 1: Core Grid Strategy Foundation

### 1.1 Backend Grid Strategy Engine
- Create `src/strategies/hamburgerBot.ts` - Main strategy class with core loop
- Create `src/strategies/virtualGrid.ts` - Infinite virtual grid monitoring
- Create `src/strategies/gridPositionManager.ts` - 4 real position management
- Create `src/types/grid.ts` - Grid-specific type definitions

### 1.2 Basic Configuration System
- Extend `src/config/settings.ts` with hamburger bot configurations
- Add leverage limits per symbol group:
  ```
  40x: BTC, ETH, SOL, XRP
  20x: DOGE, SUI, WLD, LTC, LINK, AVAX, HYPE, TIA, APT, NEAR
  10x: OP, ARB, LDO, TON, JUP, SEI, BNB, DOT
  3x: Stablecoins and new listings
  ```

### 1.3 Risk Management Integration
- Create `src/strategies/gridRiskManager.ts` with hardcoded limits:
  - Max 95% capital utilization
  - Max 60% position bias without strong trend
  - 2-5% stop loss ranges
  - Daily loss thresholds
- Risk checks BEFORE any AI decision execution

## Phase 2: Virtual Grid & Position Management

### 2.1 Virtual Grid Implementation
```typescript
// Core features:
- Infinite virtual level generation (no capital lock)
- Real-time price crossing detection
- Grid spacing (fixed $ or %)
- Memory-efficient state storage
```

### 2.2 Position Management System
```typescript
// Dynamic 2-4 real position rules:
- Starts with 2 real positions during human setup:
  * 1 SHORT position above current price
  * 1 LONG position below current price
- AI dynamically manages between 2 and 4 real positions
- Never more than 4, never less than 2 real positions
- When a real position fills, immediately create new one to maintain coverage
- Market orders only (no limit order lockup)
- Position sizing: (Capital / position_count) * Leverage
- Immediate SL/TP on entry
- AI can cluster positions during rare market conditions (pump/dump)
- Capital tracking for near 100% utilization
```

### 2.3 Order Execution Engine
- Market order execution for real positions (premium paid for flexibility)
- Stop loss/take profit automation
- Position closing for rebalancing (cut losses quickly)
- Fee calculation (always assume taker fees - heavier penalty)
- Immediate rebalancing in trend direction
- No stuck positions - AI can exit anytime

## Phase 3: AI Integration

### 3.1 Signal Integration
- Add Parabolic SAR (SAR) indicator to `src/indicators/` - Primary trend direction
- Add ATR (Average True Range) - Volatility & dynamic grid spacing
- Add Volume Spike Detection - Early pump/dump warning
- Add Rate of Change (ROC) - Panic trigger for violent moves
- Create signal aggregation system with decision hierarchy:
  1. ROC panic trigger → Immediate cluster/flatten
  2. Volume spike → Prepare for movement, tighten risk
  3. SAR trend direction → Position bias (long/short)
  4. ATR volatility → Adjust grid spacing
- Implement trend bias detection based on signal combination

### 3.2 AI Decision Logic
```typescript
// Create `src/core/gridAIEngine.ts` - AI as both brain AND risk manager:
- Analyze virtual level crossings
- Calculate confidence scores
- Decide actions: SHIFT_UP/SHIFT_DOWN/ADD/REMOVE/HOLD/CLOSE_ALL
- Provide reasoning explanations
- Configurable aggressiveness levels
- Risk management integrated (not separate)
- Cut losing positions before they go too deep
- Cluster positions in strong trend direction
- Maintain outer position proximity to price
```

### 3.3 Reactive Rebalancing
- Implement trigger detection system
- Create rebalance decision pipeline
- Add execution confidence thresholds
- Log all AI decisions with reasoning

## Phase 4: Risk Management

### 4.1 Symbol-Specific Limits
```typescript
// Leverage enforcement:
40x: BTC, ETH, SOL, XRP
20x: DOGE, SUI, WLD, LTC, LINK, AVAX, HYPE, TIA, APT, NEAR
10x: OP, ARB, LDO, TON, JUP, SEI, BNB, DOT
3x: Stablecoins and new listings
```

### 4.2 Capital Controls
- Max 95% capital utilization
- Max 60% position bias without strong trend confirmation
- 2-5% stop loss ranges
- Daily loss/drawdown thresholds
- Position size validation

### 4.3 Fee Management
- Taker fee calculation on all trades
- Funding rate impact analysis
- Minimum profit after fees validation
- Cost-benefit analysis for rebalancing

## Phase 5: State Persistence

### 5.1 Grid State Storage
- Extend `src/storage/` for grid-specific data
- Save real/virtual grid states
- Persistent AI decision logs
- Performance metrics history

### 5.2 Recovery System
- Resume grid on restart
- Reconstruct virtual levels
- Restore AI state
- Validate positions on recovery

## Phase 6: Performance Tracking

### 6.1 Metrics Collection
```typescript
// Track comprehensive metrics:
- Total trades and win rate
- Average hold time
- Capital efficiency (% utilized)
- Realized/unrealized PnL
- Fees paid and funding costs
- Max drawdown and Sharpe ratio
- Exposure breakdown
```

### 6.2 Reporting System
- Real-time performance dashboard
- Historical analysis reports
- AI decision transparency logs
- Trade execution audit trail

## Phase 7: Frontend Integration

### 7.1 Hamburger Bot UI
- Extend `VirtualGridPanel.tsx` for hamburger features
- Add leverage limit enforcement display per symbol group
- AI aggressiveness controls
- Real-time AI decision display with reasoning
- Manual override controls
- Dynamic position clustering visualization
- Signal strength indicators
- Risk management status display

### 7.2 Visualization
- Price-time chart (no candlesticks)
- Real positions (bright green for longs, bright red for shorts)
- Virtual levels (faded green for buys, faded red for sells)
- AI signal overlays (SAR dots, volume spike warnings)
- PnL tooltips on hover
- Dynamic clustering visualization during market conditions
- Current price line with position proximity indicators

## Phase 8: Backtesting Engine (Blackbox)

### 8.1 Prepare for Blackbox Integration
- Create backtest data interfaces
- Implement performance tracking hooks
- Add configuration export/import
- Prepare historical data structures

### 8.2 Testing Infrastructure
- Unit tests for all grid components
- Integration tests for AI decisions
- Risk management validation
- State persistence testing

## Phase 9: Production Readiness

### 9.1 Safety Measures
- Emergency stop mechanisms
- API outage handling
- Network instability resilience
- Rapid market move protection

### 9.2 Monitoring & Alerts
- Grid health monitoring
- Performance deviation alerts
- Risk threshold breaches
- System status indicators

## Implementation Order (No Time Estimates)

### Step 1: Core Strategy
1. Implement virtual grid monitoring
2. Add dynamic 2-4 position management
3. Integrate AI as risk manager (not separate!)
4. Create basic decision loop

### Step 2: AI Integration
1. Add signal indicators
2. Implement AI decision engine
3. Integrate with risk manager
4. Add decision logging

### Step 3: API & UI
1. Create backend endpoints
2. Update frontend components
3. Add visualization features
4. Implement controls

### Step 4: Backtesting
1. Prepare data interfaces
2. Export logic for Blackbox
3. Run validation tests
4. Iterate based on results

### Step 5: Testnet
1. Deploy to testnet
2. Monitor live performance
3. Validate against backtest
4. Prepare for production

## Critical Success Factors

- [ ] AI serves as both brain AND risk manager (integrated, not separate)
- [ ] Dynamic 2-4 real positions (never less than 2, never more than 4)
- [ ] Initial setup: 1 short above, 1 long below price
- [ ] Market order premium for flexibility and quick exits
- [ ] No paper trading - direct to Blackbox backtesting
- [ ] Signal stack: Parabolic SAR + ATR + Volume + ROC (minimal but effective)
- [ ] Infinite virtual monitoring without capital lock
- [ ] Complete decision transparency with reasoning
- [ ] Testnet validation before production

## Blackbox Integration Points

1. **Strategy Logic Export**: Clean separation of core logic for backtesting
2. **Data Interface**: Standardized format for historical data
3. **Parameter Configuration**: Exportable configs for optimization
4. **Performance Metrics**: Consistent metrics between live and backtest
5. **Signal Testing**: Validate SAR/ATR/Volume/ROC effectiveness

## Risk Mitigation

1. **No Paper Trading Bias**: Direct backtesting with real historical data
2. **Heavy Fee Assumption**: Conservative cost estimates
3. **AI-First Risk Management**: AI makes all risk decisions dynamically
4. **Market Order Flexibility**: Never stuck in positions
5. **External Validation**: Blackbox validates our logic independently

## Notes for Autonomous Execution

1. AI is the risk manager - integrate risk checks into AI decision engine
2. All fee calculations must use the heavier rate (taker fees)
3. Backtesting validation is required before testnet deployment
4. Maintain clean separation between strategy logic and execution
5. Log every decision with complete reasoning
6. Validate leverage limits per symbol group
7. Ensure 95% capital utilization target
8. Signal stack must remain minimal (avoid analysis paralysis)
9. Position clustering only during rare market conditions

This workflow prioritizes adaptive AI-driven risk management with minimal but effective signals, maintaining the core hamburger bot principles of capital efficiency and dynamic rebalancing.
