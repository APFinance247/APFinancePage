/**
 * Shared utility functions for stock risk calculation
 */

import { StockDataPoint, RiskStats } from '@/types/stock-analysis';

// Helper function to calculate risk from price deviations (same as in StockRiskChart)
export function calculateRiskFromDeviations(
  dev8EMA: number, 
  dev21EMA: number, 
  dev50SMA: number, 
  dev100SMA: number, 
  dev200SMA: number
): number {
  const yellowTerritory = 0.15; // 15% above 8W EMA
  const elevatedTerritory = 0.08; // 8% above 8W EMA  
  const nearEMA = -0.05; // 5% below 8W EMA
  
  let risk: number;
  
  if (dev8EMA >= yellowTerritory) {
    // Above threshold = YELLOW TERRITORY (Risk 8-10)
    if (dev8EMA >= yellowTerritory * 2) {
      risk = 9.5; // Extreme overextension
    } else if (dev8EMA >= yellowTerritory * 1.5) {
      risk = 9.0; // Very high overextension  
    } else if (dev8EMA >= yellowTerritory * 1.2) {
      risk = 8.5; // High overextension
    } else {
      risk = 8.0; // Moderate overextension
    }
  } else if (dev8EMA >= elevatedTerritory) {
    // Elevated territory (Risk 6.5-8)
    const range = yellowTerritory - elevatedTerritory;
    const position = (dev8EMA - elevatedTerritory) / range;
    risk = 6.5 + position * 1.5;
  } else if (dev8EMA >= nearEMA) {
    // Near EMA = MODERATE TERRITORY (Risk 5-6.5)
    const range = elevatedTerritory - nearEMA;
    const position = (dev8EMA - nearEMA) / range;
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
  
  return Math.max(1, Math.min(10, risk));
}

// Load historical data from individual stock CSV file
export async function loadDataFromStockCSV(symbol: string): Promise<StockDataPoint[]> {
  try {
    const response = await fetch(`/stock-data/${symbol.toUpperCase()}.csv`);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV for ${symbol}: ${response.statusText}`);
    }
    const csvText = await response.text();
    
    const lines = csvText.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1); // Skip header
    
    const historicalData = dataLines
      .map(line => {
        const [dateStr, priceStr, timestampStr, ema8Str, ema21Str, sma50Str, sma100Str, sma200Str, sma400Str, riskStr] = line.split(',');
        
        return {
          date: new Date(dateStr),
          price: parseFloat(priceStr) || 0,
          timestamp: parseInt(timestampStr) || 0,
          ema8: parseFloat(ema8Str) || 0,
          ema21: parseFloat(ema21Str) || 0,
          sma50: parseFloat(sma50Str) || 0,
          sma100: parseFloat(sma100Str) || 0,
          sma200: parseFloat(sma200Str) || 0,
          sma400: parseFloat(sma400Str) || 0,
          risk: parseFloat(riskStr) || 5,
        };
      })
      .filter(item => !isNaN(item.price) && item.price > 0);
    
    console.log(`✅ Loaded ${historicalData.length} pre-calculated data points for ${symbol} from CSV`);
    return historicalData;
  } catch (error) {
    console.error(`Error loading historical data for ${symbol} from CSV:`, error);
    return [];
  }
}

// Get current risk and price using CSV + latest API approach
export async function getCurrentRiskAndPrice(symbol: string): Promise<{
  currentRisk: number;
  currentPrice: number;
  dataSource: string;
}> {
  try {
    // Try to load from individual stock CSV first
    console.log(`Loading historical data for ${symbol} from CSV...`);
    const historicalData = await loadDataFromStockCSV(symbol);
    
    if (historicalData.length > 0) {
      // Successfully loaded from CSV, now fetch only the latest price
      console.log(`Fetching latest data point for ${symbol} from API...`);
      
      try {
        const latestResponse = await fetch(`/api/stock-latest?symbol=${symbol}`);
        if (!latestResponse.ok) {
          throw new Error('Failed to fetch latest data');
        }
        
        const latestResult = await latestResponse.json();
        const latestDate = new Date(latestResult.dataDate);
        const latestTimestamp = latestDate.getTime();
        
        // Check if we already have this date in historical data
        const existingIndex = historicalData.findIndex(item => 
          Math.abs(item.timestamp - latestTimestamp) < 24 * 60 * 60 * 1000 // Within 24 hours
        );
        
        let finalData = [...historicalData];
        
        if (existingIndex >= 0) {
          // Update existing data point with latest price if different
          if (Math.abs(historicalData[existingIndex].price - latestResult.currentPrice) > 0.01) {
            // Update price and recalculate risk
            finalData[existingIndex] = {
              ...historicalData[existingIndex],
              price: latestResult.currentPrice,
            };
            
            // Recalculate risk for updated price
            const point = finalData[existingIndex];
            const dev8EMA = point.ema8 > 0 ? (point.price - point.ema8) / point.ema8 : 0;
            const dev21EMA = point.ema21 > 0 ? (point.price - point.ema21) / point.ema21 : 0;
            const dev50SMA = point.sma50 > 0 ? (point.price - point.sma50) / point.sma50 : 0;
            const dev100SMA = point.sma100 > 0 ? (point.price - point.sma100) / point.sma100 : 0;
            const dev200SMA = point.sma200 > 0 ? (point.price - point.sma200) / point.sma200 : 0;
            
            const recalculatedRisk = calculateRiskFromDeviations(dev8EMA, dev21EMA, dev50SMA, dev100SMA, dev200SMA);
            finalData[existingIndex].risk = Math.round(recalculatedRisk * 100) / 100;
            
            console.log(`Updated existing data point for ${symbol} with latest price and recalculated risk: ${finalData[existingIndex].risk}`);
          }
        } else {
          // Add new data point
          const lastPoint = historicalData[historicalData.length - 1];
          const newDataPoint: StockDataPoint = {
            date: latestDate,
            price: latestResult.currentPrice,
            timestamp: latestTimestamp,
            ema8: lastPoint.ema8,
            ema21: lastPoint.ema21,
            sma50: lastPoint.sma50,
            sma100: lastPoint.sma100,
            sma200: lastPoint.sma200,
            sma400: lastPoint.sma400,
            risk: lastPoint.risk, // Will be recalculated below
          };
          finalData.push(newDataPoint);
          console.log(`Added new latest data point for ${symbol}`);
          
          // Recalculate risk for the last data point
          const lastPointFinal = finalData[finalData.length - 1];
          const dev8EMA = lastPointFinal.ema8 > 0 ? (lastPointFinal.price - lastPointFinal.ema8) / lastPointFinal.ema8 : 0;
          const dev21EMA = lastPointFinal.ema21 > 0 ? (lastPointFinal.price - lastPointFinal.ema21) / lastPointFinal.ema21 : 0;
          const dev50SMA = lastPointFinal.sma50 > 0 ? (lastPointFinal.price - lastPointFinal.sma50) / lastPointFinal.sma50 : 0;
          const dev100SMA = lastPointFinal.sma100 > 0 ? (lastPointFinal.price - lastPointFinal.sma100) / lastPointFinal.sma100 : 0;
          const dev200SMA = lastPointFinal.sma200 > 0 ? (lastPointFinal.price - lastPointFinal.sma200) / lastPointFinal.sma200 : 0;
          
          const recalculatedRisk = calculateRiskFromDeviations(dev8EMA, dev21EMA, dev50SMA, dev100SMA, dev200SMA);
          finalData[finalData.length - 1].risk = Math.round(recalculatedRisk * 100) / 100;
        }
        
        const lastDataPoint = finalData[finalData.length - 1];
        return {
          currentRisk: lastDataPoint.risk,
          currentPrice: lastDataPoint.price,
          dataSource: 'CSV + Latest API'
        };
        
      } catch (latestError) {
        console.warn(`Latest API failed for ${symbol}, using CSV data only:`, latestError);
        // Use CSV data as-is
        const lastPoint = historicalData[historicalData.length - 1];
        return {
          currentRisk: lastPoint.risk,
          currentPrice: lastPoint.price,
          dataSource: 'CSV Historical Data'
        };
      }
    }
    
    // Fallback to original API if CSV not found
    console.log(`No CSV data found for ${symbol}, falling back to full API call...`);
    const response = await fetch(`/api/stock-analysis?symbol=${symbol}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch data');
    }
    
    const result = await response.json();
    return {
      currentRisk: result.currentRisk,
      currentPrice: result.currentPrice,
      dataSource: 'API'
    };
    
  } catch (err) {
    console.error('Error fetching current risk and price:', err);
    throw err;
  }
}