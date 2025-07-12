/**
 * Technical indicators calculation module
 * Centralized location for all moving average and indicator calculations
 */

// Calculate Simple Moving Average
export function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(0);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

// Calculate Exponential Moving Average
export function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      ema.push(data[i]);
    } else {
      ema.push((data[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
    }
  }
  return ema;
}

// Calculate rolling volatility
export function calculateRollingVolatility(prices: number[], period: number): number[] {
  const volatilities: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      volatilities.push(0);
      continue;
    }
    
    const slice = prices.slice(i - period + 1, i + 1);
    const returns = [];
    for (let j = 1; j < slice.length; j++) {
      returns.push((slice[j] - slice[j-1]) / slice[j-1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    volatilities.push(Math.sqrt(variance) * Math.sqrt(252)); // Annualized for daily data
  }
  
  return volatilities;
}

// Calculate rolling percentile for better context
export function calculateRollingPercentile(
  value: number, 
  array: number[], 
  index: number, 
  window: number = 520 // ~2 years for daily data
): number {
  const start = Math.max(0, index - window);
  const slice = array.slice(start, index + 1);
  
  if (slice.length < 10) return 50; // Default to middle if not enough data
  
  const sorted = [...slice].sort((a, b) => a - b);
  let rank = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] <= value) rank++;
  }
  return (rank / sorted.length) * 100;
}

// Calculate Relative Strength Index (RSI)
export function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  
  // Calculate initial average gain/loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  // First RSI value
  rsi.push(0); // No RSI for first price
  
  for (let i = period; i < prices.length; i++) {
    if (i === period) {
      // First RSI calculation
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    } else {
      // Smooth the averages
      avgGain = ((avgGain * (period - 1)) + gains[i - 1]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i - 1]) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  
  // Fill the beginning with 50 (neutral)
  while (rsi.length < prices.length) {
    rsi.unshift(50);
  }
  
  return rsi;
}

// Calculate MACD (Moving Average Convergence Divergence)
export function calculateMACD(
  prices: number[], 
  fastPeriod: number = 12, 
  slowPeriod: number = 26, 
  signalPeriod: number = 9
): { macd: number[], signal: number[], histogram: number[] } {
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);
  
  // MACD line
  const macd = emaFast.map((fast, i) => fast - emaSlow[i]);
  
  // Signal line (EMA of MACD)
  const signal = calculateEMA(macd, signalPeriod);
  
  // Histogram
  const histogram = macd.map((m, i) => m - signal[i]);
  
  return { macd, signal, histogram };
}

// Calculate Bollinger Bands
export function calculateBollingerBands(
  prices: number[], 
  period: number = 20, 
  stdDevMultiplier: number = 2
): { upper: number[], middle: number[], lower: number[] } {
  const middle = calculateSMA(prices, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upper.push(0);
      lower.push(0);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const avg = middle[i];
      const variance = slice.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      
      upper.push(avg + (stdDev * stdDevMultiplier));
      lower.push(avg - (stdDev * stdDevMultiplier));
    }
  }
  
  return { upper, middle, lower };
}

// Calculate Average True Range (ATR) - useful for volatility-based stops
export function calculateATR(
  highs: number[], 
  lows: number[], 
  closes: number[], 
  period: number = 14
): number[] {
  const trueRanges: number[] = [];
  
  // Calculate True Range
  for (let i = 0; i < highs.length; i++) {
    if (i === 0) {
      trueRanges.push(highs[i] - lows[i]);
    } else {
      const highLow = highs[i] - lows[i];
      const highClose = Math.abs(highs[i] - closes[i - 1]);
      const lowClose = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(highLow, highClose, lowClose));
    }
  }
  
  // Calculate ATR using EMA approach
  const atr: number[] = [];
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      atr.push(0);
    } else if (i === period - 1) {
      // First ATR is simple average
      const sum = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
      atr.push(sum / period);
    } else {
      // Subsequent ATR values use smoothing
      atr.push(((atr[i - 1] * (period - 1)) + trueRanges[i]) / period);
    }
  }
  
  return atr;
}

// Helper function to identify support/resistance levels
export function identifySupportResistanceLevels(
  prices: number[], 
  lookback: number = 20, 
  threshold: number = 0.02
): { support: number[], resistance: number[] } {
  const support: number[] = [];
  const resistance: number[] = [];
  
  for (let i = lookback; i < prices.length - lookback; i++) {
    const current = prices[i];
    const leftSlice = prices.slice(i - lookback, i);
    const rightSlice = prices.slice(i + 1, i + lookback + 1);
    
    // Check if it's a local minimum (support)
    if (current <= Math.min(...leftSlice) && current <= Math.min(...rightSlice)) {
      support.push(current);
    }
    
    // Check if it's a local maximum (resistance)
    if (current >= Math.max(...leftSlice) && current >= Math.max(...rightSlice)) {
      resistance.push(current);
    }
  }
  
  // Filter out levels that are too close to each other
  const filteredSupport = filterCloseLevels(support, threshold);
  const filteredResistance = filterCloseLevels(resistance, threshold);
  
  return { support: filteredSupport, resistance: filteredResistance };
}

function filterCloseLevels(levels: number[], threshold: number): number[] {
  if (levels.length === 0) return [];
  
  const sorted = [...levels].sort((a, b) => a - b);
  const filtered = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const lastLevel = filtered[filtered.length - 1];
    const percentDiff = Math.abs(sorted[i] - lastLevel) / lastLevel;
    
    if (percentDiff > threshold) {
      filtered.push(sorted[i]);
    }
  }
  
  return filtered;
} 