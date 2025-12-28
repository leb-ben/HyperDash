import {
  RSI,
  MACD,
  BollingerBands,
  SMA,
  EMA,
  ATR
} from 'technicalindicators';
import type { OHLCV, Indicators } from '../types/index.js';

// Hamburger Bot indicators
import { ParabolicSAR } from './parabolicSAR.js';
import { ATR as CustomATR } from './atr.js';
import { VolumeSpike } from './volumeSpike.js';
import { ROC } from './roc.js';

export type {
  ParabolicSARResult
} from './parabolicSAR.js';
export type {
  ATRResult
} from './atr.js';
export type {
  VolumeSpikeResult
} from './volumeSpike.js';
export type {
  ROCResult
} from './roc.js';

export { ParabolicSAR, CustomATR, VolumeSpike, ROC };

export function calculateIndicators(candles: OHLCV[], indicatorConfig: any): Indicators {
  if (candles.length < 50) {
    return getEmptyIndicators();
  }

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  // RSI
  const rsiValues = RSI.calculate({
    values: closes,
    period: indicatorConfig.rsi?.period || 14
  });
  const rsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1]! : null;

  // MACD
  const macdValues = MACD.calculate({
    values: closes,
    fastPeriod: indicatorConfig.macd?.fast || 12,
    slowPeriod: indicatorConfig.macd?.slow || 26,
    signalPeriod: indicatorConfig.macd?.signal || 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  const macdLast = macdValues.length > 0 ? macdValues[macdValues.length - 1] : null;
  const macd = macdLast ? {
    value: macdLast.MACD ?? 0,
    signal: macdLast.signal ?? 0,
    histogram: macdLast.histogram ?? 0
  } : null;

  // Bollinger Bands
  const bbValues = BollingerBands.calculate({
    values: closes,
    period: indicatorConfig.bollinger?.period || 20,
    stdDev: indicatorConfig.bollinger?.std_dev || 2
  });
  const bbLast = bbValues.length > 0 ? bbValues[bbValues.length - 1] : null;
  const bollinger = bbLast ? {
    upper: bbLast.upper,
    middle: bbLast.middle,
    lower: bbLast.lower
  } : null;

  // ATR
  const atrValues = ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: indicatorConfig.atr?.period || 14
  });
  const atr = atrValues.length > 0 ? atrValues[atrValues.length - 1]! : null;

  // SMAs
  const sma20Values = SMA.calculate({ values: closes, period: 20 });
  const sma50Values = SMA.calculate({ values: closes, period: 50 });
  const sma20 = sma20Values.length > 0 ? sma20Values[sma20Values.length - 1]! : null;
  const sma50 = sma50Values.length > 0 ? sma50Values[sma50Values.length - 1]! : null;

  // EMAs
  const ema12Values = EMA.calculate({ values: closes, period: 12 });
  const ema26Values = EMA.calculate({ values: closes, period: 26 });
  const ema12 = ema12Values.length > 0 ? ema12Values[ema12Values.length - 1]! : null;
  const ema26 = ema26Values.length > 0 ? ema26Values[ema26Values.length - 1]! : null;

  // Volume Profile (simple comparison to average)
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const currentVolume = volumes[volumes.length - 1]!;
  const volumeProfile: 'high' | 'normal' | 'low' = 
    currentVolume > avgVolume * 1.5 ? 'high' :
    currentVolume < avgVolume * 0.5 ? 'low' : 'normal';

  return {
    rsi,
    macd,
    bollinger,
    atr,
    sma20,
    sma50,
    ema12,
    ema26,
    volumeProfile
  };
}

function getEmptyIndicators(): Indicators {
  return {
    rsi: null,
    macd: null,
    bollinger: null,
    atr: null,
    sma20: null,
    sma50: null,
    ema12: null,
    ema26: null,
    volumeProfile: 'normal'
  };
}

// Determine trend based on indicators
export function analyzeTrend(indicators: Indicators, currentPrice: number): {
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  signals: string[];
} {
  const signals: string[] = [];
  let bullishPoints = 0;
  let bearishPoints = 0;

  // RSI Analysis
  if (indicators.rsi !== null) {
    if (indicators.rsi > 70) {
      bearishPoints += 2;
      signals.push('RSI overbought');
    } else if (indicators.rsi < 30) {
      bullishPoints += 2;
      signals.push('RSI oversold');
    } else if (indicators.rsi > 50) {
      bullishPoints += 1;
    } else {
      bearishPoints += 1;
    }
  }

  // MACD Analysis
  if (indicators.macd) {
    if (indicators.macd.histogram > 0) {
      bullishPoints += 1;
      if (indicators.macd.value > indicators.macd.signal) {
        bullishPoints += 1;
        signals.push('MACD bullish crossover');
      }
    } else {
      bearishPoints += 1;
      if (indicators.macd.value < indicators.macd.signal) {
        bearishPoints += 1;
        signals.push('MACD bearish crossover');
      }
    }
  }

  // Bollinger Band Analysis
  if (indicators.bollinger) {
    if (currentPrice < indicators.bollinger.lower) {
      bullishPoints += 2;
      signals.push('Price below lower Bollinger');
    } else if (currentPrice > indicators.bollinger.upper) {
      bearishPoints += 2;
      signals.push('Price above upper Bollinger');
    }
  }

  // Moving Average Analysis
  if (indicators.sma20 && indicators.sma50) {
    if (currentPrice > indicators.sma20 && indicators.sma20 > indicators.sma50) {
      bullishPoints += 2;
      signals.push('Golden cross setup');
    } else if (currentPrice < indicators.sma20 && indicators.sma20 < indicators.sma50) {
      bearishPoints += 2;
      signals.push('Death cross setup');
    }
  }

  // EMA Analysis
  if (indicators.ema12 && indicators.ema26) {
    if (indicators.ema12 > indicators.ema26) {
      bullishPoints += 1;
    } else {
      bearishPoints += 1;
    }
  }

  // Volume Analysis
  if (indicators.volumeProfile === 'high') {
    signals.push('High volume');
  } else if (indicators.volumeProfile === 'low') {
    signals.push('Low volume');
  }

  const totalPoints = bullishPoints + bearishPoints;
  const strength = totalPoints > 0 
    ? Math.round((Math.abs(bullishPoints - bearishPoints) / totalPoints) * 100)
    : 50;

  let trend: 'bullish' | 'bearish' | 'neutral';
  if (bullishPoints > bearishPoints + 2) {
    trend = 'bullish';
  } else if (bearishPoints > bullishPoints + 2) {
    trend = 'bearish';
  } else {
    trend = 'neutral';
  }

  return { trend, strength, signals };
}

export default { calculateIndicators, analyzeTrend };
