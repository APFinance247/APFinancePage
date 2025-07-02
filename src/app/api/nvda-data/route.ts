import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

interface CandleData {
  t: number[]; // timestamps
  c: number[]; // close prices
  o: number[]; // open prices
  h: number[]; // high prices
  l: number[]; // low prices
  v: number[]; // volumes
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

// Calculate risk based on position relative to moving averages
function calculateRisk(
  price: number,
  ema8: number,
  ema21: number,
  sma200: number
): number {
  // Risk is lowest (1) when at 200 SMA, highest (10) when 30% above 8-week EMA
  
  // Distance from 200 SMA (baseline)
  const distanceFrom200SMA = (price - sma200) / sma200;
  
  // Distance from 8-week EMA
  const distanceFrom8EMA = (price - ema8) / ema8;
  
  // Define risk levels:
  // - At 200 SMA or below: risk = 1-2
  // - 30% above 8-week EMA: risk = 10
  // - Scale linearly between these points
  
  if (distanceFrom200SMA <= 0) {
    return 1; // Dark purple - lowest risk
  }
  
  if (distanceFrom8EMA >= 0.3) {
    return 10; // Yellow - highest risk
  }
  
  // Linear interpolation between low and high risk
  // Use the higher of the two distances to determine risk
  const maxDistance = Math.max(distanceFrom200SMA, distanceFrom8EMA);
  const normalizedRisk = Math.min(maxDistance / 0.3, 1); // Cap at 1 for 30% above 8EMA
  
  return Math.max(1, Math.min(10, 1 + (normalizedRisk * 9)));
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.FINNHUB_API_KEY || 'c58gpgaad3ifmjb47cl0';
    
    // Calculate date range (about 10 years of weekly data)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 10);
    
    const end = Math.floor(endDate.getTime() / 1000);
    const start = Math.floor(startDate.getTime() / 1000);
    
    // Fetch weekly candlestick data from Finnhub
    const response = await axios.get(
      `https://finnhub.io/api/v1/stock/candle?symbol=NVDA&resolution=W&from=${start}&to=${end}&token=${apiKey}`
    );
    
    const data: CandleData = response.data;
    
    if (!data.c || data.c.length === 0) {
      return NextResponse.json({ error: 'No data received from Finnhub' }, { status: 500 });
    }
    
    // Calculate moving averages
    const ema8 = calculateEMA(data.c, 8);
    const ema21 = calculateEMA(data.c, 21);
    const sma50 = calculateSMA(data.c, 50);
    const sma100 = calculateSMA(data.c, 100);
    const sma200 = calculateSMA(data.c, 200);
    const sma400 = calculateSMA(data.c, 400);
    
    // Process data and calculate risk for each point
    const processedData: ProcessedDataPoint[] = [];
    
    for (let i = 0; i < data.c.length; i++) {
      const risk = calculateRisk(
        data.c[i],
        ema8[i],
        ema21[i],
        sma200[i]
      );
      
      processedData.push({
        date: new Date(data.t[i] * 1000),
        price: data.c[i],
        ema8: ema8[i],
        ema21: ema21[i],
        sma50: sma50[i],
        sma100: sma100[i],
        sma200: sma200[i],
        sma400: sma400[i],
        risk: Math.round(risk * 100) / 100, // Round to 2 decimal places
      });
    }
    
    return NextResponse.json({
      data: processedData,
      currentPrice: data.c[data.c.length - 1],
      currentRisk: processedData[processedData.length - 1]?.risk || 0,
    });
    
  } catch (error) {
    console.error('Error fetching NVDA data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch NVDA data' },
      { status: 500 }
    );
  }
} 