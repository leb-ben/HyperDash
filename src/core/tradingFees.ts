/**
 * Trading Fees & Costs Simulator
 * 
 * Simulates real trading costs for paper trading:
 * - Maker/Taker fees
 * - Slippage (based on order size vs liquidity)
 * - Funding rates (perpetual futures)
 * - Network/gas costs
 */

export interface FeeStructure {
  makerFeePct: number;   // Limit orders
  takerFeePct: number;   // Market orders
  fundingInterval: number; // Hours between funding
  minOrderValue: number;
  withdrawalFeeFixed: number;
  withdrawalFeePct: number;
}

export interface SlippageConfig {
  baseSlippagePct: number;    // Base slippage
  sizeImpactMultiplier: number; // How much size affects slippage
  volatilityMultiplier: number; // How much volatility affects slippage
}

export interface TradeCosts {
  tradingFee: number;
  slippage: number;
  fundingCost: number;
  totalCost: number;
  effectivePrice: number;
  priceImpactPct: number;
}

// Hyperliquid fee structure (as of 2024)
const HYPERLIQUID_FEES: FeeStructure = {
  makerFeePct: 0.02,     // 0.02% maker
  takerFeePct: 0.05,     // 0.05% taker (most paper trades simulate market orders)
  fundingInterval: 8,    // Funding every 8 hours
  minOrderValue: 10,     // $10 minimum
  withdrawalFeeFixed: 1, // $1 flat
  withdrawalFeePct: 0    // No percentage fee on withdrawal
};

const DEFAULT_SLIPPAGE: SlippageConfig = {
  baseSlippagePct: 0.01,      // 0.01% base
  sizeImpactMultiplier: 0.001, // 0.001% per $1000 order size
  volatilityMultiplier: 2     // 2x slippage in volatile markets
};

export class TradingFeesCalculator {
  private fees: FeeStructure;
  private slippage: SlippageConfig;
  
  // Track funding payments per position
  private fundingTracker: Map<string, { lastFunding: number; totalPaid: number }> = new Map();

  constructor(fees: FeeStructure = HYPERLIQUID_FEES, slippage: SlippageConfig = DEFAULT_SLIPPAGE) {
    this.fees = fees;
    this.slippage = slippage;
  }

  /**
   * Calculate all costs for a trade
   */
  calculateTradeCosts(
    orderValue: number,
    side: 'long' | 'short',
    isMarketOrder: boolean = true,
    currentPrice: number,
    volatility: number = 1 // 1 = normal, 2 = high volatility
  ): TradeCosts {
    // Trading fee
    const feeRate = isMarketOrder ? this.fees.takerFeePct : this.fees.makerFeePct;
    const tradingFee = orderValue * (feeRate / 100);

    // Slippage (only for market orders)
    let slippagePct = 0;
    if (isMarketOrder) {
      slippagePct = this.slippage.baseSlippagePct;
      slippagePct += (orderValue / 1000) * this.slippage.sizeImpactMultiplier;
      slippagePct *= (this.slippage.volatilityMultiplier * (volatility - 0.5)); // Scale with volatility
      slippagePct = Math.max(0, Math.min(slippagePct, 1)); // Cap at 1%
    }
    
    const slippageCost = orderValue * (slippagePct / 100);
    
    // Price impact (slippage affects entry price)
    const priceImpact = side === 'long' 
      ? currentPrice * (1 + slippagePct / 100)  // Buying pushes price up
      : currentPrice * (1 - slippagePct / 100); // Selling pushes price down

    return {
      tradingFee,
      slippage: slippageCost,
      fundingCost: 0, // Calculated separately over time
      totalCost: tradingFee + slippageCost,
      effectivePrice: priceImpact,
      priceImpactPct: slippagePct
    };
  }

  /**
   * Calculate funding payment for a position
   * Funding is paid between longs and shorts to keep perp price close to spot
   */
  calculateFunding(
    positionValue: number,
    side: 'long' | 'short',
    fundingRate: number, // Current funding rate (e.g., 0.01 = 0.01%)
    hoursHeld: number
  ): number {
    // Number of funding periods in hold time
    const fundingPeriods = Math.floor(hoursHeld / this.fees.fundingInterval);
    
    if (fundingPeriods === 0) return 0;
    
    // Positive funding = longs pay shorts
    // Negative funding = shorts pay longs
    const payment = positionValue * (fundingRate / 100) * fundingPeriods;
    
    return side === 'long' 
      ? (fundingRate > 0 ? -payment : payment)   // Longs pay if rate positive
      : (fundingRate > 0 ? payment : -payment);  // Shorts receive if rate positive
  }

  /**
   * Update funding tracker for a position
   */
  updateFundingTracker(symbol: string, payment: number): void {
    const current = this.fundingTracker.get(symbol) || { lastFunding: 0, totalPaid: 0 };
    this.fundingTracker.set(symbol, {
      lastFunding: Date.now(),
      totalPaid: current.totalPaid + payment
    });
  }

  /**
   * Get total funding paid for a symbol
   */
  getTotalFundingPaid(symbol: string): number {
    return this.fundingTracker.get(symbol)?.totalPaid || 0;
  }

  /**
   * Calculate withdrawal cost
   */
  calculateWithdrawalCost(amount: number): number {
    return this.fees.withdrawalFeeFixed + (amount * this.fees.withdrawalFeePct / 100);
  }

  /**
   * Get fee structure
   */
  getFeeStructure(): FeeStructure {
    return { ...this.fees };
  }

  /**
   * Simulate realistic fill price with order book depth
   */
  simulateFillPrice(
    midPrice: number,
    orderSizeUsd: number,
    side: 'buy' | 'sell',
    spreadPct: number = 0.02 // Default 0.02% spread
  ): number {
    const halfSpread = spreadPct / 100 / 2;
    
    // Base price depends on side
    const basePrice = side === 'buy'
      ? midPrice * (1 + halfSpread) // Buy at ask
      : midPrice * (1 - halfSpread); // Sell at bid
    
    // Size impact (larger orders get worse fills)
    const sizeImpact = (orderSizeUsd / 100000) * 0.01; // 0.01% per $100k
    
    const fillPrice = side === 'buy'
      ? basePrice * (1 + sizeImpact)
      : basePrice * (1 - sizeImpact);
    
    return fillPrice;
  }
}

export const feesCalculator = new TradingFeesCalculator();
