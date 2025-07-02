import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

interface YahooDataPoint {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ProcessedDataPoint {
  date: Date;
  price: number;
  ema8: number;
  ema21: number;
  sma50: number;
  sma100: number;
  sma200: number;
  sma400: number;
  risk: number;
  timestamp: number;
}

// Calculate Simple Moving Average
function calculateSMA(data: number[], period: number): number[] {
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
function calculateEMA(data: number[], period: number): number[] {
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
function calculateRollingVolatility(prices: number[], period: number): number[] {
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
    volatilities.push(Math.sqrt(variance) * Math.sqrt(52)); // Annualized
  }
  
  return volatilities;
}

// Calculate rolling percentile for better context
function calculateRollingPercentile(value: number, array: number[], index: number, window: number = 104): number {
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

// Enhanced risk calculation with multiple factors and time-based adjustments
function calculateEnhancedRisk(
  prices: number[],
  ema8Array: number[],
  ema21Array: number[],
  sma50Array: number[],
  sma200Array: number[]
): number[] {
  
  // Calculate additional technical indicators
  const volatilities = calculateRollingVolatility(prices, 13); // 3-month rolling volatility
  const momentum13 = prices.map((price, i) => i < 13 ? 0 : (price - prices[i - 13]) / prices[i - 13]);
  const momentum26 = prices.map((price, i) => i < 26 ? 0 : (price - prices[i - 26]) / prices[i - 26]);
  
  // Time-based factors: calculate how long price has been elevated
  const elevationDuration: number[] = [];
  const marketRegime: number[] = []; // Bull/bear market indicator
  const peakProximity: number[] = []; // How close to recent peaks
  
  // Pre-calculate all deviations
  const deviations200: number[] = [];
  const deviations8: number[] = [];
  const deviations21: number[] = [];
  const deviations50: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (sma200Array[i] > 0) {
      deviations200.push((prices[i] - sma200Array[i]) / sma200Array[i]);
    } else {
      deviations200.push(0);
    }
    
    if (ema8Array[i] > 0) {
      deviations8.push((prices[i] - ema8Array[i]) / ema8Array[i]);
    } else {
      deviations8.push(0);
    }
    
    if (ema21Array[i] > 0) {
      deviations21.push((prices[i] - ema21Array[i]) / ema21Array[i]);
    } else {
      deviations21.push(0);
    }
    
    if (sma50Array[i] > 0) {
      deviations50.push((prices[i] - sma50Array[i]) / sma50Array[i]);
    } else {
      deviations50.push(0);
    }
    
    // Calculate elevation duration (how long above certain thresholds)
    let duration = 0;
    const currentDev200 = deviations200[i];
    if (currentDev200 > 0.15) { // If 15%+ above 200 SMA
      for (let j = i; j >= 0 && deviations200[j] > 0.15; j--) {
        duration++;
      }
    }
    elevationDuration.push(duration);
    
    // Calculate market regime (rolling 52-week trend)
    let regime = 0;
    if (i >= 52) {
      const yearAgoPrice = prices[i - 52];
      const currentPrice = prices[i];
      const yearReturn = (currentPrice - yearAgoPrice) / yearAgoPrice;
      // Strong bull market = 1, strong bear = -1, neutral = 0
      regime = Math.max(-1, Math.min(1, yearReturn * 2)); // Scale factor
    }
    marketRegime.push(regime);
    
    // Calculate peak proximity (how close to recent highs)
    let peak = 0;
    if (i >= 26) { // Need 6 months of data
      const lookback = Math.min(52, i); // Look back up to 1 year
      const recentHigh = Math.max(...prices.slice(i - lookback, i + 1));
      const currentPrice = prices[i];
      peak = currentPrice / recentHigh; // 1.0 = at peak, lower = further from peak
    }
    peakProximity.push(peak);
  }
  
  const risks: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < 26) { // Need at least 6 months of data
      risks.push(5); // Neutral risk for early points
      continue;
    }
    
    // Core deviation metrics
    const dev200 = deviations200[i];
    const dev8 = deviations8[i];
    const dev21 = deviations21[i];
    const dev50 = deviations50[i];
    const vol = volatilities[i];
    const mom13 = momentum13[i];
    const mom26 = momentum26[i];
    const elevation = elevationDuration[i];
    const regime = marketRegime[i];
    const peak = peakProximity[i];
    
    // Calculate rolling percentiles for context
    const percentile200 = calculateRollingPercentile(dev200, deviations200, i, 156); // 3-year window
    const percentile8 = calculateRollingPercentile(dev8, deviations8, i, 156);
    const percentileVol = calculateRollingPercentile(vol, volatilities, i, 156);
    
    // Time-based adjustment: longer elevation = higher risk, but with diminishing returns
    const timeAdjustment = elevation > 0 ? Math.log(1 + elevation / 10) * 0.3 : 0;
    
    // Market regime adjustment: high risk in bull markets is more dangerous
    const regimeAdjustment = regime > 0.5 ? regime * 0.2 : 0;
    
    // Peak proximity adjustment: being at recent highs with elevated valuations is riskier
    const peakAdjustment = peak > 0.95 && dev200 > 0.2 ? (peak - 0.95) * 10 * 0.5 : 0;
    
    // Extreme elevation adjustment: sustained high elevation gets extra risk
    let extremeElevationAdjustment = 0;
    if (dev200 > 0.5 && elevation > 20) {
      // Very elevated for a long time = bubble risk
      extremeElevationAdjustment = 0.8;
    } else if (dev200 > 0.4 && elevation > 15) {
      extremeElevationAdjustment = 0.6;
    } else if (dev200 > 0.3 && elevation > 10) {
      extremeElevationAdjustment = 0.4;
    }
    
    // Volatility spike adjustment: extreme volatility can indicate crashes vs bubbles
    let volatilityAdjustment = 0;
    if (percentileVol > 95) {
      // Extreme volatility - reduce risk during crashes, maintain during bubbles
      if (dev200 < 0) {
        volatilityAdjustment = -0.5; // Crash scenario - reduce risk
      } else if (dev200 > 0.3) {
        volatilityAdjustment = 0.2; // Bubble volatility - slight increase
      }
    } else if (percentileVol > 75) {
      volatilityAdjustment = 0.1;
    } else if (percentileVol < 25) {
      volatilityAdjustment = -0.2; // Low volatility = lower risk
    }
    
    // Trend strength indicator
    const trendAlignment = (
      (dev8 > 0 ? 1 : -1) + 
      (dev21 > 0 ? 1 : -1) + 
      (dev200 > 0 ? 1 : -1)
    ) / 3; // -1 to 1
    
    // Volatility adjustment factor - reduced during extreme periods
    let volAdjustment = percentileVol > 75 ? 0.3 : (percentileVol < 25 ? -0.3 : 0);
    
    // Momentum factor - reduced impact
    const momentumFactor = (mom13 * 0.7 + mom26 * 0.3) * 1.5;
    
    // Base risk calculation with improved logic
    let baseRisk: number;
    
    // Extreme conditions first - enhanced with 50 week SMA
    if (dev200 <= -0.25 || dev50 <= -0.20) {
      // Deep below 200 SMA OR 20%+ below 50 SMA = very low risk (PRESERVE PURPLE)
      baseRisk = 1 + Math.max(0, Math.max(dev200 + 0.25, dev50 + 0.20) / -0.15); // Risk 1-2
    } else if (dev200 <= -0.15 || dev50 <= -0.15) {
      // Moderately below 200 SMA OR 15%+ below 50 SMA = low risk (PRESERVE PURPLE)
      baseRisk = 2 + Math.max(dev200 + 0.15, dev50 + 0.15) / -0.10 * 1; // Risk 2-3
    } else if (dev200 <= -0.1) {
      // Moderately below 200 SMA = low risk (PRESERVE PURPLE-BLUE)
      baseRisk = 2.5 + (dev200 + 0.1) / -0.15 * 1; // Risk 2.5-3.5
    } else if (dev200 <= 0) {
      // Slightly below 200 SMA = low-moderate risk (PRESERVE GREEN TERRITORY)
      baseRisk = 3.5 + (dev200 / 0.1) * 1; // Risk 3.5-4.5
    } else {
      // Above 200 SMA - Enhanced peak detection for historical accuracy
      if (percentile200 <= 30) {
        baseRisk = 4.5; // Moderate (green territory)
      } else if (percentile200 <= 50) {
        baseRisk = 5 + (percentile200 - 30) / 20 * 0.5; // 5-5.5 (green)
      } else if (percentile200 <= 70) {
        baseRisk = 5.5 + (percentile200 - 50) / 20 * 0.5; // 5.5-6 (green)
      } else if (percentile200 <= 85) {
        baseRisk = 6 + (percentile200 - 70) / 15 * 0.8; // 6-6.8 (enhanced for better peak detection)
      } else if (percentile200 <= 95) {
        baseRisk = 6.8 + (percentile200 - 85) / 10 * 0.6; // 6.8-7.4
      } else {
        // Top 5% - more aggressive for true bubble detection
        const extremePercentile = percentile200;
        if (extremePercentile <= 98) {
          baseRisk = 7.4 + (extremePercentile - 95) / 3 * 0.4; // 7.4-7.8
        } else {
          // Only the most extreme conditions get true yellow (risk 8+)
          baseRisk = 7.8 + (extremePercentile - 98) / 2 * 0.5; // 7.8-8.3
        }
      }
    }
    
    // Short-term adjustment based on 8 EMA - much more conservative
    let shortTermAdjustment = 0;
    if (percentile8 > 98) { // Only top 2% gets significant adjustment
      shortTermAdjustment = (percentile8 - 98) / 2 * 0.3; // Much smaller adjustment
    } else if (percentile8 < 10) {
      shortTermAdjustment = (percentile8 - 10) / 10 * 0.5; // Enhance low risk detection
    }
    
    // Trend alignment adjustment - reduced
    const trendAdjustment = trendAlignment * 0.15;
    
    // Momentum adjustment - much more conservative
    const momentumAdjustment = Math.min(0.4, Math.max(-0.4, momentumFactor)) * 0.3;
    
    // Combine all factors with time-based adjustments
    let finalRisk = baseRisk + shortTermAdjustment + trendAdjustment + momentumAdjustment + volAdjustment + timeAdjustment + regimeAdjustment + peakAdjustment + extremeElevationAdjustment + volatilityAdjustment;
    
    // Apply smoothing to reduce noise
    if (i > 0) {
      finalRisk = finalRisk * 0.75 + risks[i-1] * 0.25; // Increased smoothing
    }
    
    // STRICT BOUNDS: Cap maximum risk at 8.5 to make yellow extremely rare
    finalRisk = Math.max(1, Math.min(8.5, finalRisk));
    
    risks.push(finalRisk);
  }
  
  // Post-processing: Ensure better distribution with yellow being very rare
  const processedRisks = [...risks];
  
  // Calculate percentiles of the risk values themselves
  const sortedRisks = [...risks].sort((a, b) => a - b);
  const riskPercentiles = risks.map(risk => {
    let rank = 0;
    for (let i = 0; i < sortedRisks.length; i++) {
      if (sortedRisks[i] <= risk) rank++;
    }
    return (rank / sortedRisks.length) * 100;
  });
  
  // Redistribute to ensure good spread but cap yellow
  for (let i = 0; i < processedRisks.length; i++) {
    const percentile = riskPercentiles[i];
    let adjustedRisk = processedRisks[i];
    
    // Ensure extreme values distribution
    if (percentile <= 5) {
      adjustedRisk = Math.min(adjustedRisk, 2); // Deep purple
    } else if (percentile <= 15) {
      adjustedRisk = Math.min(adjustedRisk, 3.5); // Purple-blue
    } else if (percentile <= 85) {
      // Keep the middle range (green territory) intact
      adjustedRisk = Math.min(adjustedRisk, 7);
    } else if (percentile >= 98) {
      // Only top 2% gets yellow territory (8+)
      adjustedRisk = Math.max(adjustedRisk, 7.8);
      adjustedRisk = Math.min(adjustedRisk, 8.3); // Cap even the extremes
    } else if (percentile >= 95) {
      // Top 5% gets orange-ish (7-8)
      adjustedRisk = Math.max(adjustedRisk, 7.2);
      adjustedRisk = Math.min(adjustedRisk, 7.8);
    }
    
    processedRisks[i] = adjustedRisk;
  }
  
  return processedRisks;
}

export async function GET(request: NextRequest) {
  try {
    // Calculate date range (about 10 years of daily data)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 10);
    
    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000);
    
    // Use Yahoo Finance API for DAILY data instead of weekly
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/NVDA?period1=${period1}&period2=${period2}&interval=1d`;
    
    console.log('Fetching DAILY data from Yahoo Finance:', yahooUrl);
    
    const response = await axios.get(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const yahooData = response.data;
    
    if (!yahooData.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
      throw new Error('Invalid data structure from Yahoo Finance');
    }
    
    const result = yahooData.chart.result[0];
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const closes = quote.close;
    
    // Filter out null values and create clean daily data arrays
    const cleanData: YahooDataPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        cleanData.push({
          date: timestamps[i] * 1000, // Convert to milliseconds
          open: quote.open[i] || closes[i],
          high: quote.high[i] || closes[i],
          low: quote.low[i] || closes[i],
          close: closes[i],
          volume: quote.volume[i] || 0
        });
      }
    }
    
    if (cleanData.length === 0) {
      throw new Error('No valid price data received');
    }
    
    console.log(`Received ${cleanData.length} daily data points`);
    
    // Extract close prices for calculations
    const closePrices = cleanData.map(d => d.close);
    
    // Calculate weekly-equivalent moving averages but adjusted for daily data
    // Since we have ~5x more data points, multiply periods by 5 to get weekly equivalent
    const ema8 = calculateEMA(closePrices, 8 * 5);    // ~8 weeks in daily data
    const ema21 = calculateEMA(closePrices, 21 * 5);  // ~21 weeks in daily data  
    const sma50 = calculateSMA(closePrices, 50 * 5);  // ~50 weeks in daily data
    const sma100 = calculateSMA(closePrices, 100 * 5); // ~100 weeks in daily data
    const sma200 = calculateSMA(closePrices, 200 * 5); // ~200 weeks in daily data
    const sma400 = calculateSMA(closePrices, 400 * 5); // ~400 weeks in daily data
    
    // Calculate risk using enhanced algorithm (adjusted for daily frequency)
    const riskArray = calculateEnhancedRisk(closePrices, ema8, ema21, sma50, sma200);
    
    // Process data and build final result
    const processedData: ProcessedDataPoint[] = [];
    
    for (let i = 0; i < cleanData.length; i++) {
      processedData.push({
        date: new Date(cleanData[i].date),
        price: closePrices[i],
        ema8: ema8[i],
        ema21: ema21[i],
        sma50: sma50[i],
        sma100: sma100[i],
        sma200: sma200[i],
        sma400: sma400[i],
        risk: Math.round(riskArray[i] * 100) / 100,
        timestamp: cleanData[i].date,
      });
    }
    
    console.log(`Successfully processed ${processedData.length} DAILY data points with enhanced risk algorithm`);
    
    // Calculate some statistics for verification
    const risks = processedData.map(p => p.risk);
    const riskStats = {
      min: Math.min(...risks),
      max: Math.max(...risks),
      avg: risks.reduce((a, b) => a + b, 0) / risks.length,
      distribution: {
        risk1to3: risks.filter(r => r <= 3).length,
        risk4to6: risks.filter(r => r > 3 && r <= 6).length,
        risk7to8: risks.filter(r => r > 6 && r <= 8).length,
        risk9to10: risks.filter(r => r > 8).length,
      }
    };
    
    console.log('Enhanced DAILY risk distribution:', riskStats);
    
    return NextResponse.json({
      data: processedData,
      currentPrice: closePrices[closePrices.length - 1],
      currentRisk: processedData[processedData.length - 1]?.risk || 0,
      source: 'Yahoo Finance Daily (Enhanced Algorithm)',
      riskStats
    });
    
  } catch (error: any) {
    console.error('Error fetching NVDA daily data from Yahoo Finance:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch NVDA daily data from Yahoo Finance',
        details: error.message,
        suggestion: 'Try using the Finnhub endpoint or check your internet connection'
      },
      { status: 500 }
    );
  }
} 