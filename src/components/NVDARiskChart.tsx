'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { format } from 'date-fns';

// Dynamically import Chart.js components to avoid SSR issues
import dynamic from 'next/dynamic';

// Chart.js imports that are safe for SSR
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale,
  LogarithmicScale,
  ChartOptions,
} from 'chart.js';

// Dynamic import for components that need window
const Scatter = dynamic(() => import('react-chartjs-2').then((mod) => mod.Scatter), {
  ssr: false,
});

// Chart.js registration state
let chartJsInitialized = false;

interface DataPoint {
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

interface RiskStats {
  min: number;
  max: number;
  avg: number;
  distribution: {
    risk1to3: number;
    risk4to6: number;
    risk7to8: number;
    risk9to10: number;
  };
}

interface APIResponse {
  data: DataPoint[];
  currentPrice: number;
  currentRisk: number;
  source?: string;
  riskStats?: RiskStats;
}

// Professional color mapping function
const getRiskColor = (risk: number): string => {
  const normalized = Math.max(0, Math.min(1, (risk - 1) / 9));
  
  const colors = [
    { r: 68, g: 1, b: 84 },     // Deep purple (risk 1) - extreme value
    { r: 94, g: 39, b: 139 },   // Medium-dark purple (risk 2.5) - excellent value
    { r: 123, g: 104, b: 238 }, // Medium purple (risk 3.5) - good value  
    { r: 147, g: 132, b: 209 }, // Light purple (risk 4.5) - good buy zone
    { r: 33, g: 145, b: 140 },  // Teal (risk 5.5) - moderate (REVERTED)
    { r: 94, g: 201, b: 98 },   // Green (risk 6.5) - moderate-high (REVERTED)
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
};

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

// Load historical data from CSV file with pre-calculated risk levels
async function loadHistoricalDataFromCSV(): Promise<DataPoint[]> {
  try {
    const response = await fetch('/nvda-historical-data.csv');
    const csvText = await response.text();
    
    const lines = csvText.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    const dataLines = lines.slice(1); // Skip header
    
    const historicalData = dataLines.map(line => {
      const [dateStr, priceStr, timestampStr, ema8Str, ema21Str, sma50Str, sma100Str, sma200Str, sma400Str, riskStr] = line.split(',');
      
      // Parse values, providing defaults for missing or invalid data
      const price = parseFloat(priceStr) || 0;
      const timestamp = parseInt(timestampStr) || 0;
      const ema8 = parseFloat(ema8Str) || 0;
      const ema21 = parseFloat(ema21Str) || 0;
      const sma50 = parseFloat(sma50Str) || 0;
      const sma100 = parseFloat(sma100Str) || 0;
      const sma200 = parseFloat(sma200Str) || 0;
      const sma400 = parseFloat(sma400Str) || 0;
      const risk = parseFloat(riskStr) || 5;
      
      return {
        date: new Date(dateStr),
        price,
        timestamp,
        ema8,
        ema21,
        sma50,
        sma100,
        sma200,
        sma400,
        risk
      };
    }).filter(item => !isNaN(item.price) && item.price > 0); // Filter out invalid data
    
    console.log(`✅ Loaded ${historicalData.length} pre-calculated data points from CSV`);
    return historicalData;
  } catch (error) {
    console.error('Error loading historical CSV data:', error);
    return [];
  }
}

// Process dataset efficiently - only calculate EMAs/SMAs/risk for new data points
function processOptimizedDataset(data: DataPoint[]): DataPoint[] {
  if (data.length === 0) return [];
  
  // Sort by date to ensure proper order
  const sortedData = data.sort((a, b) => a.timestamp - b.timestamp);
  
  // Find the last point that needs calculation (has EMAs/SMAs/risk = 0 or undefined)
  let lastCalculatedIndex = -1;
  for (let i = sortedData.length - 1; i >= 0; i--) {
    if (sortedData[i].ema8 > 0 && sortedData[i].ema21 > 0 && sortedData[i].risk > 0) {
      lastCalculatedIndex = i;
      break;
    }
  }
  
  // If all data is pre-calculated, return as-is
  if (lastCalculatedIndex === sortedData.length - 1) {
    console.log('✅ All data pre-calculated, no processing needed');
    return sortedData;
  }
  
  // Only calculate for points after the last calculated index
  const pointsToCalculate = sortedData.length - lastCalculatedIndex - 1;
  console.log(`⚡ Calculating EMAs/SMAs/risk for ${pointsToCalculate} new data points`);
  
  // Extract prices for moving average calculations
  const prices = sortedData.map(d => d.price);
  
  // Calculate moving averages for the entire dataset (we need full history for accuracy)
  const ema8 = calculateEMA(prices, 8 * 5);    // ~8 weeks in daily data
  const ema21 = calculateEMA(prices, 21 * 5);  // ~21 weeks in daily data  
  const sma50 = calculateSMA(prices, 50 * 5);  // ~50 weeks in daily data
  const sma100 = calculateSMA(prices, 100 * 5); // ~100 weeks in daily data
  const sma200 = calculateSMA(prices, 200 * 5); // ~200 weeks in daily data
  const sma400 = calculateSMA(prices, 400 * 5); // ~400 weeks in daily data
  
  // Update only the new/changed data points
  const updatedData = sortedData.map((point, index) => {
    if (index <= lastCalculatedIndex) {
      // Keep pre-calculated values
      return point;
    } else {
      // Calculate new values
      return {
        ...point,
        ema8: ema8[index],
        ema21: ema21[index],
        sma50: sma50[index],
        sma100: sma100[index],
        sma200: sma200[index],
        sma400: sma400[index],
        risk: 5, // Will be calculated next
      };
    }
  });
  
  // Calculate risk for the entire dataset (risk calculation needs full context)
  const dataWithRisk = calculateEMAFocusedRisk(updatedData);
  
  return dataWithRisk;
}

// Process complete dataset with EMAs, SMAs, and risk calculation (fallback for non-CSV data)
function processCompleteDataset(rawData: {date: Date, price: number, timestamp: number}[]): DataPoint[] {
  if (rawData.length === 0) return [];
  
  // Sort by date to ensure proper order
  const sortedData = rawData.sort((a, b) => a.timestamp - b.timestamp);
  const prices = sortedData.map(d => d.price);
  
  // Calculate weekly-equivalent moving averages adjusted for daily data  
  // Since we have ~5x more data points, multiply periods by 5 to get weekly equivalent
  const ema8 = calculateEMA(prices, 8 * 5);    // ~8 weeks in daily data
  const ema21 = calculateEMA(prices, 21 * 5);  // ~21 weeks in daily data  
  const sma50 = calculateSMA(prices, 50 * 5);  // ~50 weeks in daily data
  const sma100 = calculateSMA(prices, 100 * 5); // ~100 weeks in daily data
  const sma200 = calculateSMA(prices, 200 * 5); // ~200 weeks in daily data
  const sma400 = calculateSMA(prices, 400 * 5); // ~400 weeks in daily data
  
  // Create processed data points
  const processedData: DataPoint[] = sortedData.map((item, index) => ({
    date: item.date,
    price: item.price,
    ema8: ema8[index],
    ema21: ema21[index],
    sma50: sma50[index],
    sma100: sma100[index],
    sma200: sma200[index],
    sma400: sma400[index],
    risk: 5, // Will be calculated next
    timestamp: item.timestamp,
  }));
  
  // Apply EMA-focused risk algorithm
  const dataWithRisk = calculateEMAFocusedRisk(processedData);
  
  return dataWithRisk;
}

// Get risk level description
const getRiskDescription = (risk: number): { level: string; description: string; color: string } => {
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
};

// Calculate risk with EMA-focused approach - rare yellow, realistic purple zones
const calculateEMAFocusedRisk = (dataPoints: DataPoint[]): DataPoint[] => {
  const currentDate = new Date();
  
  return dataPoints.map((point, index) => {
    if (point.sma50 === 0 || point.ema8 === 0 || point.ema21 === 0) return { ...point, risk: 5 }; // Default if no data
    
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
    
    // STEP 1: Determine base risk from EMA position (this sets the primary risk level)
    if (dev8EMA >= 0.15) {
      // 15%+ above 8W EMA = YELLOW TERRITORY (Risk 8-10) - Made more sensitive
      if (dev8EMA >= 0.30) {
        risk = 9.5; // Extreme overextension
      } else if (dev8EMA >= 0.22) {
        risk = 9.0; // Very high overextension  
      } else if (dev8EMA >= 0.18) {
        risk = 8.5; // High overextension
      } else {
        risk = 8.0; // Moderate overextension
      }
    } else if (dev8EMA >= 0.08) {
      // 8-15% above 8W EMA = ELEVATED TERRITORY (Risk 6.5-8)
      if (dev8EMA >= 0.12) {
        // 12-15% above 8W EMA: More aggressive scaling toward 8
        risk = 7.5 + (dev8EMA - 0.12) / 0.03 * 0.5; // 7.5-8.0
      } else {
        // 8-12% above 8W EMA: Moderate scaling
        risk = 6.5 + (dev8EMA - 0.08) / 0.04 * 1.0; // 6.5-7.5
      }
    } else if (dev8EMA >= -0.05) {
      // Near 8W EMA = MODERATE TERRITORY (Risk 5-6.5)
      risk = 5.0 + (dev8EMA + 0.05) / 0.13 * 1.5; // 5.0-6.5
    } else if (dev21EMA >= -0.08) {
      // Near 21W EMA = MODERATE-LOW TERRITORY (Risk 3-5)
      if (dev21EMA >= 0) {
        risk = 4.0 + dev21EMA / 0.08 * 1.0; // 4.0-5.0
      } else {
        risk = 3.0 + (dev21EMA + 0.08) / 0.08 * 1.0; // 3.0-4.0
      }
    } else {
      // Below 21W EMA = LOW RISK TERRITORY (Risk 1-3) - Use deep SMAs
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
    
    // STEP 2: Modern time-based adjustments (lighter adjustments)
    if (modernWeight > 0.7) {
      // Recent data: slightly more generous on low risk, slightly stricter on high risk
      if (risk <= 3) {
        risk -= 0.2; // Make low risk slightly more accessible
      } else if (risk >= 7) {
        risk += 0.1; // Make high risk slightly stricter
      }
    }
    
    // STEP 3: Volatility adjustment (opportunities in chaos)
    if (modernWeight > 0.3 && index > 50) {
      const recentPrices = dataPoints.slice(Math.max(0, index - 20), index + 1).map(p => p.price);
      const priceChanges = recentPrices.slice(1).map((price, i) => (price - recentPrices[i]) / recentPrices[i]);
      const volatility = Math.sqrt(priceChanges.reduce((sum, change) => sum + change * change, 0) / priceChanges.length);
      
      // High volatility = slight risk discount (but smaller adjustment)
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
    
    // When all averages align, slightly adjust risk
    if (Math.abs(trendAlignment) > 0.6) {
      risk += trendAlignment * 0.15; // Small trend adjustment
    }
    
    // STEP 5: Final bounds and smoothing
    risk = Math.max(1, Math.min(10, risk));
    
    // Light smoothing to reduce noise
    if (index > 0 && index < dataPoints.length - 1) {
      const prevRisk = dataPoints[index - 1]?.risk || risk;
      risk = risk * 0.8 + prevRisk * 0.2; // Light smoothing
    }
    
    return {
      ...point,
      risk: Math.round(risk * 100) / 100
    };
  });
};

// Current Risk Assessment Card
const CurrentRiskAssessment = ({ currentRisk, currentPrice }: { currentRisk: number; currentPrice: number }) => {
  const riskInfo = getRiskDescription(currentRisk);
  
  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-4 md:p-6 shadow-2xl border border-gray-600">
        <div className="text-center">
        <h2 className="text-lg md:text-2xl font-bold text-white mb-1 md:mb-2">
            Current Risk Assessment
          </h2>
        <h3 className="text-sm md:text-lg text-gray-300 mb-3 md:mb-4">
            NVIDIA ($NVDA) (${currentPrice.toFixed(2)})
          </h3>
          
        <div className="flex items-center justify-center gap-4 md:gap-8 mb-3 md:mb-4">
            <div className="text-center">
              <div 
              className="text-4xl md:text-6xl font-bold mb-1 md:mb-2"
                style={{ color: riskInfo.color }}
              >
                {currentRisk.toFixed(1)}
              </div>
            <div className="text-sm md:text-lg text-gray-400">Risk Score</div>
            </div>
            
            <div className="text-center">
              <div 
              className="text-lg md:text-2xl font-bold mb-1 md:mb-2"
                style={{ color: riskInfo.color }}
              >
                {riskInfo.level}
              </div>
            <div className="text-xs md:text-sm text-gray-300 max-w-xs">
                {riskInfo.description}
              </div>
            </div>
          </div>
          
          <div className="relative w-full max-w-md mx-auto">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          <div className="h-3 md:h-4 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-500 rounded-full"
                style={{ 
                  width: `${(currentRisk / 10) * 100}%`,
                  background: currentRisk <= 4 
                    ? `linear-gradient(90deg, rgb(68,1,84), ${riskInfo.color})` // Purple progression for 1-4
                    : currentRisk <= 7 
                    ? `linear-gradient(90deg, rgb(68,1,84), rgb(147,132,209), ${riskInfo.color})` // Purple to current for 5-7
                    : `linear-gradient(90deg, rgb(68,1,84), rgb(147,132,209), rgb(94,201,98), ${riskInfo.color})` // Full progression for 8-10
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Very Low</span>
              <span>Moderate</span>
              <span>Very High</span>
          </div>
          
          {/* Risk Level Scale */}
          <div className="mt-4 pt-3 border-t border-gray-600">
            <div className="text-xs text-gray-400 text-center mb-2">Risk Level Scale</div>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                <div key={level} className="text-center">
                  <div
                    className="w-4 h-4 rounded-full shadow-sm border border-gray-600 mb-1"
                    style={{ backgroundColor: getRiskColor(level) }}
                    title={`Risk Level ${level}`}
                  />
                  <div className="text-xs text-gray-400">{level}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-400 text-center mt-2">
              Purple (1-4): Excellent to Good Value • Green (5-7): Moderate Risk • Yellow (8-10): High Risk
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Risk Algorithm Explanation Component
const RiskAlgorithmExplanation = ({ riskStats }: { riskStats?: RiskStats }) => {
  return (
    <div className="mb-6 bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-lg font-semibold mb-4 text-white">🔬 EMA-Focused Risk Algorithm - Rare Yellow, Realistic Entry Zones</h3>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-md font-semibold text-blue-400 mb-2">EMA-Focused Risk Levels:</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• <strong>Yellow Risk (8-10):</strong> 15%+ above 8W EMA = overextension (more sensitive)</li>
            <li>• <strong>Green Risk (5-7):</strong> 8-15% above 8W EMA to near 8W EMA = moderate</li>
            <li>• <strong>Purple Risk (3-4):</strong> Around 21W EMA = good buy zone</li>
            <li>• <strong>Deep Purple Risk (1-3):</strong> Below 50W-200W SMAs = excellent value</li>
            <li>• <strong>Smart Volatility:</strong> High volatility = opportunity discount</li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-md font-semibold text-green-400 mb-2">Why EMA-Focused Works:</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• <strong>Realistic Entries:</strong> 21W EMA area = solid buying opportunity</li>
            <li>• <strong>Sensitive Yellow:</strong> 15%+ overextension triggers high risk warnings</li>
            <li>• <strong>EMA Responsiveness:</strong> Faster reaction to trend changes</li>
            <li>• <strong>Deep Value Preserved:</strong> SMA touches still show as purple</li>
            <li>• <strong>Trend Aware:</strong> Considers short and long-term alignment</li>
            <li>• <strong>Growth Stock Optimized:</strong> Perfect for NVDA's dynamics</li>
          </ul>
        </div>
      </div>
      
      {riskStats && (
        <div className="mt-4">
          <h4 className="text-md font-semibold text-purple-400 mb-2">Current Distribution:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-gray-700 rounded p-2 text-center">
              <div className="text-green-400 font-semibold">{riskStats.distribution.risk1to3}</div>
              <div className="text-gray-300">Low (1-3)</div>
            </div>
            <div className="bg-gray-700 rounded p-2 text-center">
              <div className="text-yellow-400 font-semibold">{riskStats.distribution.risk4to6}</div>
              <div className="text-gray-300">Moderate (4-6)</div>
            </div>
            <div className="bg-gray-700 rounded p-2 text-center">
              <div className="text-orange-400 font-semibold">{riskStats.distribution.risk7to8}</div>
              <div className="text-gray-300">High (7-8)</div>
            </div>
            <div className="bg-gray-700 rounded p-2 text-center">
              <div className="text-red-400 font-semibold">{riskStats.distribution.risk9to10}</div>
              <div className="text-gray-300">Extreme (8+)</div>
            </div>
          </div>
          <div className="text-center mt-2 text-sm text-gray-400">
            Average Risk: <span className="font-semibold text-white">{riskStats.avg.toFixed(1)}</span>
          </div>
        </div>
      )}
      
      <div className="mt-4 p-3 bg-gradient-to-r from-gray-700 to-gray-600 rounded text-xs text-gray-300">
        <strong>🎯 EMA Philosophy:</strong> This algorithm makes yellow territory more sensitive by requiring 15%+ overextension above 
        the 8-week EMA. Around 21W EMA = good buy zone (purple), around 8W EMA = moderate risk (green), 
        deep SMA touches = excellent value (purple). Designed for realistic modern market entry and exit signals.
      </div>
    </div>
  );
};

// Professional risk legend component
const RiskLegend = () => {
  const riskLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  return (
    <div className="mb-4 md:mb-6">
      <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3 text-white">Risk Level Scale</h3>
      <div className="bg-gray-800 rounded-lg p-3 md:p-4 shadow-lg">
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-300 font-medium">Low Risk</span>
            <span className="text-xs text-gray-300 font-medium">High Risk</span>
          </div>
          <div className="flex gap-1 mb-2">
            {riskLevels.map((level) => (
              <div key={level} className="flex-1 text-center">
                <div
                  className="w-full h-5 rounded shadow-sm border border-gray-600 mb-1"
                  style={{ backgroundColor: getRiskColor(level) }}
                  title={`Risk Level ${level}`}
                />
                <div className="text-xs text-gray-400">{level}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400 text-center">
            Deep Purple (1): Bottom 5% • Bright Yellow (10): Top 5%
          </div>
        </div>
        
        <div className="hidden md:flex items-center justify-between">
        <span className="text-sm text-gray-300 font-medium">Low Risk</span>
        <div className="flex gap-1 mx-4">
          {riskLevels.map((level) => (
            <div key={level} className="text-center">
              <div
                className="w-6 h-6 rounded shadow-sm border border-gray-600 mb-1"
                style={{ backgroundColor: getRiskColor(level) }}
                title={`Risk Level ${level}`}
              />
              <div className="text-xs text-gray-400">{level}</div>
            </div>
          ))}
        </div>
        <span className="text-sm text-gray-300 font-medium">High Risk</span>
      </div>
        <div className="hidden md:block mt-2 text-xs text-gray-400 text-center">
        <p>Risk levels based on historical percentiles • Deep Purple (1): Bottom 5% • Bright Yellow (10): Top 5%</p>
        </div>
      </div>
    </div>
  );
};

// Add new interface for time range presets
interface TimeRange {
  label: string;
  startYear: number;
  endYear?: number;
  description: string;
}

// Add mobile detection function
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         window.innerWidth <= 768;
};

export default function NVDARiskChart() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [currentRisk, setCurrentRisk] = useState<number>(0);
  const [dataSource, setDataSource] = useState<string>('');
  const [riskStats, setRiskStats] = useState<RiskStats | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLogScale, setIsLogScale] = useState(true);
  
  // New visualization mode states
  const [showMovingAverages, setShowMovingAverages] = useState(false);
  
  // New state for time range control
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('aug2022present');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  
  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Mobile touch selection state
  const [touchSelection, setTouchSelection] = useState<{
    startX: number;
    currentX: number;
    isSelecting: boolean;
    startTime: number;
  } | null>(null);
  
  // Flag to prevent auto-zoom from interfering with custom selections
  const [hasCustomZoom, setHasCustomZoom] = useState(false);
  
  // Chart reference for zoom controls
  const chartRef = useRef<ChartJS<"scatter">>(null);
  
  // Chart height state
  const [chartHeight, setChartHeight] = useState(600);
  const [chartReady, setChartReady] = useState(false);

  // Time range presets
  const timeRanges: TimeRange[] = [
    { label: 'Aug 2022-Present', startYear: 2022, description: 'Recent AI boom cycle (Default)' },
    { label: '2021-Present', startYear: 2021, description: 'Post-COVID cycle' },
    { label: '2020-Present', startYear: 2020, description: 'Recent cycle' },
    { label: '2019-Present', startYear: 2019, description: 'Recent cycle' },
    { label: '2018-Present', startYear: 2018, description: 'Post-crypto boom' },
    { label: '2015-Present', startYear: 2015, description: 'Full modern era' },
    { label: 'All Data', startYear: 1999, description: 'Complete history since 1999 inception' },
    { label: 'Custom Range', startYear: 0, description: 'Select your own dates' }
  ];

  // Initialize Chart.js properly with better error handling
  useEffect(() => {
    const initializeChart = async () => {
      if (typeof window === 'undefined' || chartJsInitialized) {
        if (chartJsInitialized) setChartReady(true);
        return;
      }

      try {
        // First, register basic Chart.js components
        ChartJS.register(
          LinearScale,
          LogarithmicScale,
          PointElement,
          LineElement,
          Tooltip,
          Legend,
          TimeScale
        );

        // Import and register zoom plugin
        const zoomModule = await import('chartjs-plugin-zoom');
        ChartJS.register(zoomModule.default);

        // Try to import date adapter, but don't fail if it doesn't work
        try {
          // Import date adapter for Chart.js time scale
          await import('chartjs-adapter-date-fns');
        } catch (adapterError) {
          console.warn('Date adapter failed to load, using default:', adapterError);
        }

        chartJsInitialized = true;
        setChartReady(true);
        console.log('Chart.js initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Chart.js:', error);
        setError('Failed to initialize chart components');
      }
    };

    initializeChart();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Loading historical data from CSV...');
        
        // STEP 1: Load historical data from CSV file
        const historicalData = await loadHistoricalDataFromCSV();
        
        if (historicalData.length === 0) {
          console.log('No CSV data found, falling back to full API call...');
          // Fallback to original API if CSV is empty
        let response = await fetch('/api/nvda-data-yahoo');
        
        if (!response.ok) {
          console.log('Yahoo Finance failed, trying Finnhub...');
          response = await fetch('/api/nvda-data');
        }
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const result: APIResponse = await response.json();
        
        const processedData = result.data.map(item => ({
          ...item,
          date: new Date(item.date),
          timestamp: new Date(item.date).getTime(),
        }));
        
          const dataWithNewRisk = calculateEMAFocusedRisk(processedData);
          const currentRiskFromData = dataWithNewRisk.length > 0 ? dataWithNewRisk[dataWithNewRisk.length - 1].risk : result.currentRisk;
          
          setData(dataWithNewRisk);
        setCurrentPrice(result.currentPrice);
          setCurrentRisk(currentRiskFromData);
          setDataSource(`${result.source || 'API'} (Full Fallback)`);
        setRiskStats(result.riskStats);
        
          console.log(`Fallback: loaded ${dataWithNewRisk.length} data points from ${result.source || 'API'}`);
          return;
        }
        
        console.log(`Loaded ${historicalData.length} historical data points from CSV`);
        
        // STEP 2: Fetch only the latest data point from API
        console.log('Fetching latest data point from API...');
        let latestResponse: Response | undefined;
        let latestApiSuccess = false;
        
        try {
          latestResponse = await fetch('/api/nvda-latest');
          latestApiSuccess = latestResponse.ok;
        } catch (latestError) {
          console.warn('Latest API endpoint failed, using historical data only:', latestError);
          // Process historical data only if latest API fails
          if (historicalData.length > 0) {
            // Historical data is already processed from CSV
            const currentPrice = historicalData[historicalData.length - 1].price;
            const currentRisk = historicalData[historicalData.length - 1].risk;
            
            setData(historicalData);
            setCurrentPrice(currentPrice);
            setCurrentRisk(currentRisk);
            setDataSource('CSV Historical Only (Pre-calculated)');
            
            console.log(`✅ Using ${historicalData.length} pre-calculated data points from CSV`);
            return;
          }
        }
        
        // STEP 3: Combine historical + latest data efficiently
        let combinedData: DataPoint[] = [...historicalData];
        let currentPrice = 0;
        let dataSource = 'CSV Historical (Pre-calculated)';
        
        if (latestApiSuccess && latestResponse) {
          const latestResult = await latestResponse.json();
          const latestDate = new Date(latestResult.dataDate);
          const latestTimestamp = latestDate.getTime();
          
          // Check if we already have this date in historical data
          const existingIndex = historicalData.findIndex(item => 
            Math.abs(item.timestamp - latestTimestamp) < 24 * 60 * 60 * 1000 // Within 24 hours
          );
          
          if (existingIndex >= 0) {
            // Update existing data point with latest price
            combinedData[existingIndex] = {
              ...historicalData[existingIndex],
              price: latestResult.currentPrice,
              // Note: EMAs, SMAs, and risk will be recalculated for this point
            };
            console.log('Updated existing data point with latest price');
          } else {
            // Add new latest data point (EMAs/SMAs/risk will be calculated)
            const newDataPoint: DataPoint = {
              date: latestDate,
              price: latestResult.currentPrice,
              timestamp: latestTimestamp,
              ema8: 0, // Will be calculated
              ema21: 0,
              sma50: 0,
              sma100: 0,
              sma200: 0,
              sma400: 0,
              risk: 5 // Will be calculated
            };
            combinedData.push(newDataPoint);
            console.log('Added new latest data point');
          }
          
          currentPrice = latestResult.currentPrice;
          dataSource = `CSV Historical (Pre-calculated) + ${latestResult.source}`;
        } else {
          console.warn('Latest API failed, using historical data only');
          // Use the most recent historical price as current
          if (historicalData.length > 0) {
            currentPrice = historicalData[historicalData.length - 1].price;
          }
          dataSource = 'CSV Historical Only (Pre-calculated)';
        }
        
        // STEP 4: Process only new/updated data points efficiently
        console.log('⚡ Processing efficiently - only calculating new data points...');
        const processedData = processOptimizedDataset(combinedData);
        
        // STEP 5: Calculate current risk from processed data
        const currentRiskFromData = processedData.length > 0 ? processedData[processedData.length - 1].risk : 5;
        
        // STEP 6: Calculate risk statistics
        const risks = processedData.map(d => d.risk);
        const riskStats: RiskStats = {
          min: Math.min(...risks),
          max: Math.max(...risks),
          avg: risks.reduce((sum, r) => sum + r, 0) / risks.length,
          distribution: {
            risk1to3: risks.filter(r => r >= 1 && r <= 3).length,
            risk4to6: risks.filter(r => r > 3 && r <= 6).length,
            risk7to8: risks.filter(r => r > 6 && r <= 8).length,
            risk9to10: risks.filter(r => r > 8 && r <= 10).length,
          }
        };
        
        // STEP 7: Set state with processed data
        setData(processedData);
        setCurrentPrice(currentPrice);
        setCurrentRisk(currentRiskFromData);
        setDataSource(dataSource);
        setRiskStats(riskStats);
        
        console.log(`✅ Successfully processed ${processedData.length} data points`);
        console.log(`📊 Data source: ${dataSource}`);
        console.log(`💰 Current price: $${currentPrice.toFixed(2)}`);
        console.log(`⚠️ Current risk: ${currentRiskFromData.toFixed(2)}`);
        console.log(`📈 Risk range: ${riskStats.min.toFixed(2)} - ${riskStats.max.toFixed(2)} (avg: ${riskStats.avg.toFixed(2)})`);
        
      } catch (err) {
        console.error('Error in fetchData:', err);
        setError(err instanceof Error ? err.message : 'An error occurred while loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter data based on selected time range
  const filteredDataForTimeRange = useMemo(() => {
    if (!data.length) return [];
    
    let startDate: Date;
    let endDate: Date = new Date();
    
    if (selectedTimeRange === 'customrange' && customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
    } else {
      const selectedRange = timeRanges.find(range => 
        range.label.toLowerCase().replace(/[^a-z]/g, '') === 
        selectedTimeRange.toLowerCase().replace(/[^a-z]/g, '')
      );
      
      if (selectedRange && selectedRange.startYear > 0) {
        // Special handling for Aug 2022-Present
        if (selectedRange.label === 'Aug 2022-Present') {
          startDate = new Date(2022, 7, 1); // August 1, 2022 (month is 0-indexed)
        } else {
          startDate = new Date(selectedRange.startYear, 0, 1);
        }
        if (selectedRange.endYear) {
          endDate = new Date(selectedRange.endYear, 11, 31);
        } else {
          // For present-day timeframes, add 3 months to current date
          endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 3);
        }
      } else {
        // Show all data
        startDate = new Date(data[0].date);
        endDate = new Date(data[data.length - 1].date);
        // Add 3 months to the end date for "All Data" view as well
        endDate.setMonth(endDate.getMonth() + 3);
      }
    }
    
    const filtered = data.filter(point => 
      point.date >= startDate && point.date <= endDate
    );
    
    return filtered;
  }, [data, selectedTimeRange, customStartDate, customEndDate, timeRanges]);

  // Set mounted state
  useEffect(() => {
    const getChartHeight = () => {
      return window.innerWidth < 768 ? 500 : 600;
    };
    
    setChartHeight(getChartHeight());
    
    const handleResize = () => setChartHeight(getChartHeight());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setSelectedTimeRange('2019present');
            break;
          case '2':
            e.preventDefault();
            setSelectedTimeRange('2021present');
            break;
          case '3':
            e.preventDefault();
            setSelectedTimeRange('2020present');
            break;
          case '4':
            e.preventDefault();
            setSelectedTimeRange('2018present');
            break;
          case '0':
            e.preventDefault();
            setSelectedTimeRange('alldata');
            break;
          case 'l':
            e.preventDefault();
            setIsLogScale(!isLogScale);
            break;
          case 'r':
            e.preventDefault();
            // Reset zoom
            if (chartRef.current) {
              chartRef.current.resetZoom();
            }
            setSelectedTimeRange('aug2022present');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isLogScale]);

  // Custom mobile touch selection handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobileDevice() || !chartRef.current) return;
    
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    
    setTouchSelection({
      startX: x,
      currentX: x,
      isSelecting: true,
      startTime: Date.now()
    });
    
    e.preventDefault();
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobileDevice() || !touchSelection?.isSelecting) return;
    
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    
    setTouchSelection(prev => prev ? {
      ...prev,
      currentX: x
    } : null);
    
    e.preventDefault();
  }, [touchSelection?.isSelecting]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isMobileDevice() || !touchSelection?.isSelecting || !chartRef.current) {
      setTouchSelection(null);
      return;
    }
    
    const { startX, currentX, startTime } = touchSelection;
    const endTime = Date.now();
    const duration = endTime - startTime;
    const distance = Math.abs(currentX - startX);
    
    // Check if this was a tap (short duration, small movement) vs drag
    const isTap = duration < 300 && distance < 10; // Less than 300ms and 10px movement
    
    if (isTap) {
      // This was a tap - let Chart.js handle tooltip with intersect mode
      setTouchSelection(null);
      return;
    }
    
    // This was a drag - proceed with selection logic
    const chart = chartRef.current;
    const chartArea = chart.chartArea;
    
    if (!chartArea) {
      setTouchSelection(null);
      return;
    }
    
    const minX = Math.min(startX, currentX);
    const maxX = Math.max(startX, currentX);
    
    // Only proceed if drag distance is meaningful (at least 30px)
    if (maxX - minX < 30) {
      setTouchSelection(null);
      return;
    }
    
    // Convert pixel positions to chart coordinates
    const xScale = chart.scales.x;
    const chartLeftEdge = chartArea.left;
    const chartRightEdge = chartArea.right;
    const chartWidth = chartRightEdge - chartLeftEdge;
    
    // Calculate relative positions within chart area
    const relativeMinX = Math.max(0, (minX - chartLeftEdge) / chartWidth);
    const relativeMaxX = Math.min(1, (maxX - chartLeftEdge) / chartWidth);
    
    // Get the data range
    const dataMin = xScale.min;
    const dataMax = xScale.max;
    const dataRange = dataMax - dataMin;
    
    // Calculate selected time range
    const selectedMinTime = dataMin + (relativeMinX * dataRange);
    const selectedMaxTime = dataMin + (relativeMaxX * dataRange);
    
    // Apply zoom
    xScale.options.min = selectedMinTime;
    xScale.options.max = selectedMaxTime;
    
    // Auto-fit Y axis to selected data
    const yScale = chart.scales.y;
    const visibleData = data.filter(point => 
      point.timestamp >= selectedMinTime && point.timestamp <= selectedMaxTime
    );
    
    if (visibleData.length > 0) {
      const visiblePrices = visibleData.map(d => d.price);
      const minPrice = Math.min(...visiblePrices);
      const maxPrice = Math.max(...visiblePrices);
      const priceRange = maxPrice - minPrice;
      const pricePadding = priceRange * 0.1;
      
      yScale.options.min = Math.max(0, minPrice - pricePadding);
      yScale.options.max = maxPrice + pricePadding;
    }
    
    chart.update('none');
    setTouchSelection(null);
    setHasCustomZoom(true); // Prevent auto-zoom from interfering
    
    e.preventDefault();
  }, [touchSelection, data]);

  // Smooth timeframe changing with animation
  const changeTimeRange = (newRange: string) => {
    setHasCustomZoom(false); // Allow auto-zoom to work again
    setIsAnimating(true);
    setTimeout(() => {
      setSelectedTimeRange(newRange);
      setIsAnimating(false);
    }, 150);
  };

  // Export function
  const exportData = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Date,Price,Risk,8-Week EMA,21-Week EMA,50-Week SMA\n"
      + data.map(row => 
          `${format(row.date, 'yyyy-MM-dd')},${row.price},${row.risk},${row.ema8},${row.ema21},${row.sma50}`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nvda-daily-risk-data-ema-focused.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset zoom function
  const resetZoom = () => {
    if (chartRef.current) {
      // Set custom zoom temporarily to prevent auto-zoom interference
      setHasCustomZoom(true);
      
      const xScale = chartRef.current.scales.x;
      const yScale = chartRef.current.scales.y;
      
      if (xScale && yScale) {
        // Reset to show data from Aug 2022-present (default view)
        const startDate = new Date(2022, 7, 1); // August 1, 2022
        const endDate = new Date(); // Current date
        // Add 3 months to the end date
        endDate.setMonth(endDate.getMonth() + 3);
        
        xScale.options.min = startDate.getTime();
        xScale.options.max = endDate.getTime();
        yScale.options.min = undefined; // Auto-fit to data
        yScale.options.max = undefined; // Auto-fit to data
        
        // Restore full pan limits for the default view
        const chart = chartRef.current;
        if (chart.options.plugins?.zoom?.limits) {
          chart.options.plugins.zoom.limits.x = {
            min: dataBounds.minX,
            max: dataBounds.maxX
          };
        }
        
        // Clear any active hover states
        chartRef.current.setActiveElements([]);
        
        // Force a proper re-render with animation
        chartRef.current.update();
        
        // Ensure data points are properly rendered with a second update
        setTimeout(() => {
          if (chartRef.current) {
            chartRef.current.update('none');
          }
        }, 50);
      }
    }
  };

  // Zoom to past 12 months function
  const zoomToLast12Months = () => {
    if (chartRef.current) {
      // Set custom zoom to prevent auto-zoom interference
      setHasCustomZoom(true);
      
      const xScale = chartRef.current.scales.x;
      const yScale = chartRef.current.scales.y;
      
      if (xScale && yScale) {
        // Set to past 12 months
        const endDate = new Date(); // Current date
        // Add 1 month to the end date
        endDate.setMonth(endDate.getMonth() + 1);
        const startDate = new Date(endDate.getFullYear() - 1, endDate.getMonth() - 1, endDate.getDate()); // 12 months ago
        
        // Calculate y-axis bounds with padding based on data in the 12-month range
        const startTime = startDate.getTime();
        const endTime = endDate.getTime();
        const dataInRange = data.filter(point => 
          point.timestamp >= startTime && point.timestamp <= endTime
        );
        
        if (dataInRange.length > 0) {
          const pricesInRange = dataInRange.map(d => d.price);
          const minPrice = Math.min(...pricesInRange);
          const maxPrice = Math.max(...pricesInRange);
          const priceRange = maxPrice - minPrice;
          const pricePadding = priceRange * 0.1; // 10% padding
          
          yScale.options.min = Math.max(0, minPrice - pricePadding);
          yScale.options.max = maxPrice + pricePadding;
        } else {
          yScale.options.min = undefined; // Auto-fit to data
          yScale.options.max = undefined; // Auto-fit to data
        }
        
        xScale.options.min = startDate.getTime();
        xScale.options.max = endDate.getTime();
        
        // Update zoom/pan limits to match the 12-month view
        const chart = chartRef.current;
        if (chart.options.plugins?.zoom?.limits) {
          // Use same pan limits as other views - full data range
          chart.options.plugins.zoom.limits.x = {
            min: dataBounds.minX,
            max: dataBounds.maxX
          };
        }
        
        // Clear any active hover states
        chartRef.current.setActiveElements([]);
        
        // Force a proper re-render with animation
        chartRef.current.update();
        
        // Ensure data points are properly rendered with a second update
        setTimeout(() => {
          if (chartRef.current) {
            chartRef.current.update('none');
          }
        }, 50);
      }
    }
  };

  // Zoom to all time function
  const zoomToAllTime = () => {
    if (chartRef.current) {
      // Set custom zoom to prevent auto-zoom interference
      setHasCustomZoom(true);
      
      const xScale = chartRef.current.scales.x;
      const yScale = chartRef.current.scales.y;
      
      if (xScale && yScale) {
        // Set to show all historical data from 1999
        xScale.options.min = undefined; // Show all data from beginning
        xScale.options.max = undefined; // Show all data to end
        yScale.options.min = undefined; // Auto-fit to data
        yScale.options.max = undefined; // Auto-fit to data
        
        // Set pan limits to full data range for all time view
        const chart = chartRef.current;
        if (chart.options.plugins?.zoom?.limits) {
          chart.options.plugins.zoom.limits.x = {
            min: dataBounds.minX,
            max: dataBounds.maxX
          };
        }
        
        // Clear any active hover states
        chartRef.current.setActiveElements([]);
        
        // Force a proper re-render with animation
        chartRef.current.update();
        
        // Ensure data points are properly rendered with a second update
        setTimeout(() => {
          if (chartRef.current) {
            chartRef.current.update('none');
          }
        }, 50);
      }
    }
  };

  // Calculate data bounds for zoom limits - based on ALL data, not just filtered
  const dataBounds = useMemo(() => {
    if (data.length === 0) {
      return {
        minX: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago as fallback
        maxX: Date.now(),
        minY: 0,
        maxY: 1000
      };
    }

    const prices = data.map(d => d.price);
    const timestamps = data.map(d => d.timestamp);
    
    // Add some padding to the bounds (5% on each side)
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const pricePadding = priceRange * 0.05;
    
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime;
    const timePadding = timeRange * 0.02; // 2% padding for time
    
    return {
      minX: minTime - timePadding,
      maxX: maxTime + timePadding,
      minY: Math.max(0, minPrice - pricePadding), // Don't go below 0
      maxY: maxPrice + pricePadding
    };
  }, [data]);

  // Auto-zoom to selected timeframe
  useEffect(() => {
    if (!chartRef.current || !data.length || !chartReady || hasCustomZoom) return;
    
    // Small delay to ensure chart is fully rendered
    const timeoutId = setTimeout(() => {
      const chart = chartRef.current;
      if (!chart) return;
      
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      
      if (!xScale || !yScale) return;
      
      // Calculate timeframe boundaries
      let startDate: Date;
      let endDate: Date = new Date();
      
      if (selectedTimeRange === 'customrange' && customStartDate && customEndDate) {
        startDate = customStartDate;
        endDate = customEndDate;
      } else {
        const selectedRange = timeRanges.find(range => 
          range.label.toLowerCase().replace(/[^a-z]/g, '') === 
          selectedTimeRange.toLowerCase().replace(/[^a-z]/g, '')
        );
        
        if (selectedRange && selectedRange.startYear > 0) {
          // Special handling for Aug 2022-Present
          if (selectedRange.label === 'Aug 2022-Present') {
            startDate = new Date(2022, 7, 1); // August 1, 2022 (month is 0-indexed)
          } else {
            startDate = new Date(selectedRange.startYear, 0, 1);
          }
          if (selectedRange.endYear) {
            endDate = new Date(selectedRange.endYear, 11, 31);
          } else {
            // For present-day timeframes, add 3 months to current date
            endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 3);
          }
        } else {
          // Show all data
          startDate = new Date(data[0].date);
          endDate = new Date(data[data.length - 1].date);
          // Add 3 months to the end date for "All Data" view as well
          endDate.setMonth(endDate.getMonth() + 3);
        }
      }
      
      // Set chart zoom to timeframe
      xScale.options.min = startDate.getTime();
      xScale.options.max = endDate.getTime();
      yScale.options.min = undefined;
      yScale.options.max = undefined;
      
      // Update pan limits based on the selected time range
      if (chart.options.plugins?.zoom?.limits) {
        // Use full data bounds for all views to ensure consistent panning behavior
        chart.options.plugins.zoom.limits.x = {
          min: dataBounds.minX,
          max: dataBounds.maxX
        };
      }
      
      chart.update('none');
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [selectedTimeRange, customStartDate, customEndDate, data, chartReady, timeRanges, dataBounds, hasCustomZoom]);

  // Prepare Chart.js data with performance optimizations
  const chartData = useMemo(() => {
    return {
      datasets: [
        {
          label: 'NVDA Risk Analysis',
          data: data.map(point => ({
            x: point.timestamp,
            y: point.price,
            risk: point.risk,
            date: point.date,
            ema8: point.ema8,
            ema21: point.ema21,
            sma50: point.sma50,
            sma100: point.sma100,
            sma200: point.sma200,
          })),
          backgroundColor: data.map(point => getRiskColor(point.risk)),
          borderColor: data.map(point => getRiskColor(point.risk)),
          pointRadius: isMobileDevice() ? 3 : 2, // Larger on mobile for easier targeting
          pointHoverRadius: isMobileDevice() ? 6 : 4, // Larger on mobile for easier tapping
          pointBorderWidth: 0,
          showLine: false,
          tension: 0.1,
          fill: false,
          borderWidth: 0,
          order: 0,
        },
        // 8-Week EMA line (if enabled) - PRIMARY HIGH RISK REFERENCE
        ...(showMovingAverages ? [{
          label: '8-Week EMA (High Risk Ref)',
          data: data.map(point => ({
            x: point.timestamp,
            y: point.ema8,
          })),
          backgroundColor: 'transparent',
          borderColor: 'rgba(239, 68, 68, 1.0)', // Bright red - primary high risk reference
          pointRadius: 0,
          pointHoverRadius: 2,
          showLine: true,
          tension: 0.1,
          fill: false,
          borderWidth: 4, // Thickest - most important for high risk detection
          order: 1,
        }] : []),
        // 21-Week EMA line (if enabled) - PRIMARY MODERATE RISK REFERENCE
        ...(showMovingAverages ? [{
          label: '21-Week EMA (Entry Zone)',
          data: data.map(point => ({
            x: point.timestamp,
            y: point.ema21,
          })),
          backgroundColor: 'transparent',
          borderColor: 'rgba(59, 130, 246, 1.0)', // Bright blue - key entry zone
          pointRadius: 0,
          pointHoverRadius: 2,
          showLine: true,
          tension: 0.1,
          fill: false,
          borderWidth: 3, // Second thickest - key entry reference
          order: 2,
        }] : []),
        // SMA50 line (if enabled) - SECONDARY REFERENCE for low risk
        ...(showMovingAverages ? [{
          label: '50-Week SMA (Support)',
          data: data.map(point => ({
            x: point.timestamp,
            y: point.sma50,
          })),
          backgroundColor: 'transparent',
          borderColor: 'rgba(34, 197, 94, 0.8)', // Green for support level
          pointRadius: 0,
          pointHoverRadius: 2,
          showLine: true,
          tension: 0.1,
          fill: false,
          borderWidth: 2, // Standard thickness
          order: 3,
        }] : []),
        // SMA200 line (if enabled) - as scatter dataset with lines
        ...(showMovingAverages ? [{
          label: '200-Week SMA',
          data: data.map(point => ({
            x: point.timestamp,
            y: point.sma200,
          })),
          backgroundColor: 'transparent',
          borderColor: 'rgba(156, 163, 175, 0.6)', // Gray - background reference
          pointRadius: 0,
          pointHoverRadius: 2,
          showLine: true,
          tension: 0.1,
          fill: false,
          borderWidth: 1, // Thinnest - background reference
          order: 4,
        }] : []),
        // SMA100 line (if enabled) - as scatter dataset with lines  
        ...(showMovingAverages ? [{
          label: '100-Week SMA (Deep Support)',
          data: data.map(point => ({
            x: point.timestamp,
            y: point.sma100,
          })),
          backgroundColor: 'transparent',
          borderColor: 'rgba(168, 85, 247, 0.6)', // Faded purple - deep support
          pointRadius: 0,
          pointHoverRadius: 2,
          showLine: true,
          tension: 0.1,
          fill: false,
          borderWidth: 2, // Standard thickness
          order: 5,
        }] : []),
      ],
    };
  }, [data, showMovingAverages]);

  // Chart.js options with performance optimizations
  const chartOptions: ChartOptions<'scatter'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    // Disable animations for better performance
    animation: false,
    transitions: {
      active: {
        animation: {
          duration: 0
        }
      }
    },
    interaction: {
      intersect: true, // Only trigger when directly intersecting with data points
      mode: 'point', // Only interact with individual points
      includeInvisible: false,
    },
    onHover: isMobileDevice() ? undefined : (event, elements) => {
      const target = event.native?.target as HTMLCanvasElement;
      if (target && target.style) {
        target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true, // Re-enable tooltips on mobile for tap interactions
        backgroundColor: 'rgba(31, 41, 55, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#d1d5db',
        borderColor: '#6b7280',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (context) => {
            const dataPoint = context[0].raw as { x: number };
            return format(new Date(dataPoint.x), 'MMM dd, yyyy');
          },
          label: (context) => {
            const dataPoint = context.raw as { y: number; risk: number; ema8?: number; ema21?: number; sma50?: number };
            return [
              `Price: $${dataPoint.y.toFixed(2)}`,
              `Risk Level: ${dataPoint.risk.toFixed(2)}`,
            ];
          },
        },
      },
      zoom: {
        limits: {
          y: {min: dataBounds.minY, max: dataBounds.maxY},
          x: {min: dataBounds.minX, max: dataBounds.maxX}
        },
        pan: {
          enabled: false, // Disable all panning/scrolling
        },
        zoom: {
          wheel: {
            enabled: false, // Disable mouse wheel zoom
          },
          pinch: {
            enabled: false, // Disable pinch zoom
          },
          drag: {
            enabled: !isMobileDevice(), // Disable Chart.js drag on mobile, use custom handling
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: 'rgba(59, 130, 246, 0.8)',
            borderWidth: 2,
            threshold: 30, // Increased from 15 to 30 pixels to prevent accidental zoom on click
            modifierKey: undefined,
          },
          mode: 'x',
          onZoom: ({ chart }) => {
            // Set custom zoom flag when user manually zooms
            setHasCustomZoom(true);
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'month',
          displayFormats: {
            day: 'MMM dd',
            week: 'MMM dd',
            month: 'MMM yyyy',
            quarter: 'MMM yyyy',
            year: 'yyyy',
          },
        },
        adapters: {
          date: {},
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
        ticks: {
          color: '#9ca3af',
          font: {
            size: 12,
          },
          maxRotation: 45,
          autoSkip: true,
          autoSkipPadding: 20,
          maxTicksLimit: 12,
        },
        border: {
          color: 'rgba(156, 163, 175, 0.2)',
        },
        // Show data from Aug 2022 by default
        min: data.length > 0 ? new Date(2022, 7, 1).getTime() : undefined,
        max: data.length > 0 ? (() => {
          const maxDate = new Date();
          maxDate.setMonth(maxDate.getMonth() + 3);
          return maxDate.getTime();
        })() : undefined,
      },
      y: {
        type: isLogScale ? 'logarithmic' : 'linear',
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
        ticks: {
          color: '#9ca3af',
          font: {
            size: 12,
          },
          callback: function(value) {
            const numValue = Number(value);
            if (numValue >= 1000) return `$${(numValue / 1000).toFixed(0)}K`;
            if (numValue >= 100) return `$${Math.round(numValue)}`;
            if (numValue >= 10) return `$${numValue.toFixed(0)}`;
            return `$${numValue.toFixed(1)}`;
          },
        },
        border: {
          color: 'rgba(156, 163, 175, 0.2)',
        },
      },
    },
  }), [dataBounds, isLogScale, data]);

  // Early returns after all hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Loading NVDA daily risk data...</div>
          <div className="text-gray-400 text-sm">Calculating advanced risk metrics with historical context</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-xl mb-4">Error Loading Data</div>
          <div className="text-gray-300 text-sm mb-4">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-2 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 md:mb-8 text-center">
          <h1 className="text-xl md:text-4xl font-bold text-white mb-1 md:mb-2 transition-all duration-300">
            NVDA Daily Risk Analysis Chart
          </h1>
          {dataSource && (
            <p className="text-xs md:text-sm text-gray-400 mt-1 md:mt-2 transition-opacity duration-300">
              Data Source: {dataSource}
            </p>
          )}
        </div>

        {/* Current Risk Assessment */}
        <div className="transition-all duration-500 ease-in-out mb-4 md:mb-8">
        <CurrentRiskAssessment currentRisk={currentRisk} currentPrice={currentPrice} />
        </div>

        {/* Professional Chart */}
        <div className={`bg-gray-800 rounded-lg p-2 md:p-6 shadow-xl transition-all duration-500 relative mb-4 md:mb-8 ${
          isAnimating ? 'opacity-90 scale-99' : 'opacity-100 scale-100'
        }`}>
          {/* Chart Control Buttons - Positioned above chart */}
          <div className="flex justify-center gap-2 mb-4 md:mb-6">
            <button
              onClick={resetZoom}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
            >
              🔍 Reset
            </button>
            <button
              onClick={zoomToLast12Months}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
            >
              📅 12M
            </button>
            <button
              onClick={zoomToAllTime}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
            >
              🌐 All
            </button>
          </div>
          
          {/* Mobile instruction */}
          <div className="block md:hidden text-center text-xs text-gray-400 mb-3">
            Tap directly on data points for details • Drag across chart to select time period
          </div>
          
          <div 
            style={{ 
              height: `${chartHeight}px`,
              touchAction: isMobileDevice() ? 'none' : 'manipulation',
              position: 'relative'
            }} 
            className="select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Custom mobile selection overlay - only show for actual drags */}
            {isMobileDevice() && touchSelection?.isSelecting && 
             Math.abs(touchSelection.currentX - touchSelection.startX) > 10 && (
              <div
                className="absolute top-0 pointer-events-none z-10"
                style={{
                  left: Math.min(touchSelection.startX, touchSelection.currentX),
                  width: Math.abs(touchSelection.currentX - touchSelection.startX),
                  height: '100%',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)', // Match Chart.js desktop transparency
                  border: '2px solid rgba(59, 130, 246, 0.8)', // Match Chart.js desktop border
                }}
              />
            )}
            
            {chartReady && !loading ? (
              <Scatter
                ref={chartRef}
                data={chartData} 
                options={chartOptions} 
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-400 text-center">
                  <div className="text-lg mb-2">Loading Chart...</div>
                  <div className="text-sm">Preparing interactive features</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 