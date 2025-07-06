/**
 * Risk calculation algorithms
 * Centralized module for all risk calculation methods
 */

import { StockDataPoint, RiskCalculationConfig } from '@/types/stock-analysis';
import { calculateRollingVolatility, calculateRollingPercentile } from '@/lib/indicators/moving-averages';

// Default configuration
const DEFAULT_CONFIG: Required<RiskCalculationConfig> = {
  algorithm: 'ema-focused',
  emaPeriods: {
    short: 8 * 5,   // 8 weeks in daily data
    medium: 21 * 5  // 21 weeks in daily data
  },
  smaPeriods: {
    short: 50 * 5,     // 50 weeks
    medium: 100 * 5,   // 100 weeks
    long: 200 * 5,     // 200 weeks
    extraLong: 400 * 5 // 400 weeks
  },
  riskThresholds: {
    yellowTerritory: 0.15,    // 15% above 8W EMA
    elevatedTerritory: 0.08,  // 8% above 8W EMA
    nearEMA: -0.05           // 5% below 8W EMA
  }
};

// Get risk color based on risk level
export function getRiskColor(risk: number): string {
  const normalized = Math.max(0, Math.min(1, (risk - 1) / 9));
  
  const colors = [
    { r: 68, g: 1, b: 84 },     // Deep purple (risk 1) - extreme value
    { r: 94, g: 39, b: 139 },   // Medium-dark purple (risk 2.5) - excellent value
    { r: 123, g: 104, b: 238 }, // Medium purple (risk 3.5) - good value  
    { r: 147, g: 132, b: 209 }, // Light purple (risk 4.5) - good buy zone
    { r: 33, g: 145, b: 140 },  // Teal (risk 5.5) - moderate
    { r: 94, g: 201, b: 98 },   // Green (risk 6.5) - moderate-high
    { r: 132, g: 204, b: 22 },  // Yellow-green (risk 7.5) - elevated
    { r: 255, g: 193, b: 7 },   // Golden yellow (risk 8.5) - high risk
    { r: 255, g: 235, b: 59 },  // Bright yellow (risk 9.5) - very high risk
    { r: 255, g: 255, b: 0 },   // Pure bright yellow (risk 10) - extreme risk
  ];
  
  const segments = colors.length - 1;
  const segmentSize = 1 / segments;
  const segment = Math.floor(normalized / segmentSize);
  const localNormalized = (normalized - segment * segmentSize) / segmentSize;
  
  const startColor = colors[Math.min(segment, segments - 1)];
  const endColor = colors[Math.min(segment + 1, segments)];
  
  const r = Math.round(startColor.r + (endColor.r - startColor.r) * localNormalized);
  const g = Math.round(startColor.g + (endColor.g - startColor.g) * localNormalized);
  const b = Math.round(startColor.b + (endColor.b - startColor.b) * localNormalized);
  
  return `rgb(${r}, ${g}, ${b})`;
}

// Get risk level description
export function getRiskDescription(risk: number): { level: string; description: string; color: string } {
  if (risk <= 2) return { 
    level: "Very Low Risk", 
    description: "Extreme undervaluation - historically rare buying opportunity",
    color: getRiskColor(risk)
  };
  if (risk <= 3) return { 
    level: "Low Risk", 
    description: "Below key support levels - good value territory",
    color: getRiskColor(risk)
  };
  if (risk <= 4) return { 
    level: "Low-Moderate Risk", 
    description: "Below historical average - reasonable entry point",
    color: getRiskColor(risk)
  };
  if (risk <= 6) return { 
    level: "Moderate Risk", 
    description: "Fair value range - consider market conditions",
    color: getRiskColor(risk)
  };
  if (risk <= 7) return { 
    level: "Moderate-High Risk", 
    description: "Above historical average - elevated valuation",
    color: getRiskColor(risk)
  };
  if (risk <= 8.5) return { 
    level: "High Risk", 
    description: "Top 25% of historical valuations - proceed with caution",
    color: getRiskColor(risk)
  };
  if (risk <= 9) return { 
    level: "Very High Risk", 
    description: "Top 10% of historical valuations - high risk territory",
    color: getRiskColor(risk)
  };
  return { 
    level: "Extreme Risk", 
    description: "Top 5% of historical deviations - extreme overextension",
    color: getRiskColor(risk)
  };
}

// Main risk calculation function
export function calculateRisk(
  dataPoints: StockDataPoint[],
  config?: Partial<RiskCalculationConfig>
): StockDataPoint[] {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  switch (fullConfig.algorithm) {
    case 'ema-focused':
      return calculateEMAFocusedRisk(dataPoints, fullConfig);
    case 'enhanced':
      return calculateEnhancedRisk(dataPoints, fullConfig);
    case 'simple':
      return calculateSimpleRisk(dataPoints, fullConfig);
    default:
      return calculateEMAFocusedRisk(dataPoints, fullConfig);
  }
}

// EMA-focused risk calculation (default algorithm)
function calculateEMAFocusedRisk(
  dataPoints: StockDataPoint[],
  config: Required<RiskCalculationConfig>
): StockDataPoint[] {
  const currentDate = new Date();
  const thresholds = config.riskThresholds;
  
  return dataPoints.map((point, index) => {
    if (point.sma50 === 0 || point.ema8 === 0 || point.ema21 === 0) {
      return { ...point, risk: 5 }; // Default if no data
    }
    
    // Calculate years from current date for time-based weighting
    const yearsFromNow = (currentDate.getTime() - point.date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const modernWeight = Math.max(0, Math.min(1, (5 - yearsFromNow) / 5)); // 1 = very recent, 0 = old data
    
    // Calculate deviations from key levels
    const dev8EMA = (point.price - point.ema8) / point.ema8;
    const dev21EMA = (point.price - point.ema21) / point.ema21;
    const dev50SMA = (point.price - point.sma50) / point.sma50;
    const dev100SMA = (point.price - point.sma100) / point.sma100;
    const dev200SMA = (point.price - point.sma200) / point.sma200;
    
    let risk: number;
    
    // STEP 1: Determine base risk from EMA position
    if (dev8EMA >= thresholds.yellowTerritory) {
      // Above threshold = YELLOW TERRITORY (Risk 8-10)
      if (dev8EMA >= thresholds.yellowTerritory * 2) {
        risk = 9.5; // Extreme overextension
      } else if (dev8EMA >= thresholds.yellowTerritory * 1.5) {
        risk = 9.0; // Very high overextension  
      } else if (dev8EMA >= thresholds.yellowTerritory * 1.2) {
        risk = 8.5; // High overextension
      } else {
        risk = 8.0; // Moderate overextension
      }
    } else if (dev8EMA >= thresholds.elevatedTerritory) {
      // Elevated territory (Risk 6.5-8)
      const range = thresholds.yellowTerritory - thresholds.elevatedTerritory;
      const position = (dev8EMA - thresholds.elevatedTerritory) / range;
      risk = 6.5 + position * 1.5;
    } else if (dev8EMA >= thresholds.nearEMA) {
      // Near EMA = MODERATE TERRITORY (Risk 5-6.5)
      const range = thresholds.elevatedTerritory - thresholds.nearEMA;
      const position = (dev8EMA - thresholds.nearEMA) / range;
      risk = 5.0 + position * 1.5;
    } else if (dev21EMA >= -0.08) {
      // Near 21W EMA = MODERATE-LOW TERRITORY (Risk 3-5)
      if (dev21EMA >= 0) {
        risk = 4.0 + dev21EMA / 0.08 * 1.0;
      } else {
        risk = 3.0 + (dev21EMA + 0.08) / 0.08 * 1.0;
      }
    } else {
      // Below 21W EMA = LOW RISK TERRITORY (Risk 1-3)
      const deepestDeviation = Math.min(dev50SMA, dev100SMA, dev200SMA);
      
      if (deepestDeviation <= -0.25) {
        risk = 1.0; // Deep purple - extreme value
      } else if (deepestDeviation <= -0.15) {
        risk = 1.5; // Dark purple
      } else if (deepestDeviation <= -0.08) {
        risk = 2.0; // Light purple - excellent opportunity
      } else if (dev50SMA <= -0.03) {
        risk = 2.5; // Blue - good opportunity
      } else {
        risk = 3.0; // Blue-green transition
      }
    }
    
    // STEP 2: Modern time-based adjustments
    if (modernWeight > 0.7) {
      if (risk <= 3) {
        risk -= 0.2; // Make low risk slightly more accessible
      } else if (risk >= 7) {
        risk += 0.1; // Make high risk slightly stricter
      }
    }
    
    // STEP 3: Volatility adjustment
    if (modernWeight > 0.3 && index > 50) {
      const recentPrices = dataPoints.slice(Math.max(0, index - 20), index + 1).map(p => p.price);
      const priceChanges = recentPrices.slice(1).map((price, i) => (price - recentPrices[i]) / recentPrices[i]);
      const volatility = Math.sqrt(priceChanges.reduce((sum, change) => sum + change * change, 0) / priceChanges.length);
      
      if (volatility > 0.06) { // 6%+ daily volatility
        risk -= 0.2;
      } else if (volatility > 0.04) { // 4%+ daily volatility
        risk -= 0.1;
      }
    }
    
    // STEP 4: Trend consistency bonus/penalty
    const trendAlignment = (
      (dev8EMA > 0 ? 1 : -1) + 
      (dev21EMA > 0 ? 1 : -1) + 
      (dev50SMA > 0 ? 1 : -1)
    ) / 3;
    
    if (Math.abs(trendAlignment) > 0.6) {
      risk += trendAlignment * 0.15;
    }
    
    // STEP 5: Final bounds and smoothing
    risk = Math.max(1, Math.min(10, risk));
    
    // Light smoothing to reduce noise
    if (index > 0 && index < dataPoints.length - 1) {
      const prevRisk = dataPoints[index - 1]?.risk || risk;
      risk = risk * 0.8 + prevRisk * 0.2;
    }
    
    return {
      ...point,
      risk: Math.round(risk * 100) / 100
    };
  });
}

// Enhanced risk calculation (more complex, considers more factors)
function calculateEnhancedRisk(
  dataPoints: StockDataPoint[],
  config: Required<RiskCalculationConfig>
): StockDataPoint[] {
  const prices = dataPoints.map(d => d.price);
  const volatilities = calculateRollingVolatility(prices, 65); // 3-month rolling volatility
  
  return dataPoints.map((point, index) => {
    if (index < 130) { // Need at least 6 months of data
      return { ...point, risk: 5 }; // Neutral risk for early points
    }
    
    const dev200 = (point.price - point.sma200) / point.sma200;
    const dev8 = (point.price - point.ema8) / point.ema8;
    const dev21 = (point.price - point.ema21) / point.ema21;
    const vol = volatilities[index];
    
    // Calculate percentiles for context
    const percentile200 = calculateRollingPercentile(dev200, 
      dataPoints.map(d => (d.price - d.sma200) / d.sma200), 
      index, 780 // 3-year window
    );
    
    let baseRisk: number;
    
    // Use percentile-based approach
    if (percentile200 <= 10) {
      baseRisk = 1 + (percentile200 / 10); // Risk 1-2
    } else if (percentile200 <= 30) {
      baseRisk = 2 + ((percentile200 - 10) / 20) * 1.5; // Risk 2-3.5
    } else if (percentile200 <= 50) {
      baseRisk = 3.5 + ((percentile200 - 30) / 20) * 1.5; // Risk 3.5-5
    } else if (percentile200 <= 70) {
      baseRisk = 5 + ((percentile200 - 50) / 20) * 1; // Risk 5-6
    } else if (percentile200 <= 85) {
      baseRisk = 6 + ((percentile200 - 70) / 15) * 1; // Risk 6-7
    } else if (percentile200 <= 95) {
      baseRisk = 7 + ((percentile200 - 85) / 10) * 1; // Risk 7-8
    } else {
      baseRisk = 8 + ((percentile200 - 95) / 5) * 0.5; // Risk 8-8.5
    }
    
    // Volatility adjustment
    const volPercentile = calculateRollingPercentile(vol, volatilities, index, 520);
    if (volPercentile > 80) {
      baseRisk += 0.3;
    } else if (volPercentile < 20) {
      baseRisk -= 0.3;
    }
    
    // Short-term adjustment
    if (dev8 > config.riskThresholds.yellowTerritory) {
      baseRisk = Math.max(baseRisk, 7.5);
    } else if (dev8 < -0.1) {
      baseRisk = Math.min(baseRisk, 4);
    }
    
    const finalRisk = Math.max(1, Math.min(8.5, baseRisk));
    
    return {
      ...point,
      risk: Math.round(finalRisk * 100) / 100
    };
  });
}

// Simple risk calculation (basic approach)
function calculateSimpleRisk(
  dataPoints: StockDataPoint[],
  config: Required<RiskCalculationConfig>
): StockDataPoint[] {
  return dataPoints.map(point => {
    const dev200 = point.sma200 > 0 ? (point.price - point.sma200) / point.sma200 : 0;
    const dev8 = point.ema8 > 0 ? (point.price - point.ema8) / point.ema8 : 0;
    
    let risk: number;
    
    if (dev200 <= 0) {
      risk = 1; // Below 200 SMA = lowest risk
    } else if (dev8 >= 0.3) {
      risk = 10; // 30%+ above 8 EMA = highest risk
    } else {
      // Linear interpolation
      const normalizedRisk = Math.min(dev8 / 0.3, 1);
      risk = 1 + (normalizedRisk * 9);
    }
    
    return {
      ...point,
      risk: Math.round(risk * 100) / 100
    };
  });
} 