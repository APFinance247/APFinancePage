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

export async function GET(_request: NextRequest) {
  try {
    // Get only the last 5 trading days to ensure we have the latest data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7); // Last week to ensure we get latest trading day
    
    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000);
    
    // Use Yahoo Finance API for latest data
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/NVDA?period1=${period1}&period2=${period2}&interval=1d`;
    
    console.log('Fetching latest NVDA data from Yahoo Finance...');
    
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
    
    // Get the latest valid data point
    let latestDataPoint: YahooDataPoint | null = null;
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (closes[i] !== null && closes[i] !== undefined) {
        latestDataPoint = {
          date: timestamps[i] * 1000, // Convert to milliseconds
          open: quote.open[i] || closes[i],
          high: quote.high[i] || closes[i],
          low: quote.low[i] || closes[i],
          close: closes[i],
          volume: quote.volume[i] || 0
        };
        break;
      }
    }
    
    if (!latestDataPoint) {
      throw new Error('No valid price data received');
    }
    
    console.log(`Latest data point: ${new Date(latestDataPoint.date).toDateString()} - $${latestDataPoint.close}`);
    
    // Return the latest data point with basic structure
    // Note: EMAs and SMAs will be calculated on the frontend after combining with historical data
    const processedData: ProcessedDataPoint = {
      date: new Date(latestDataPoint.date),
      price: latestDataPoint.close,
      ema8: 0, // Will be calculated after combining with historical data
      ema21: 0,
      sma50: 0,
      sma100: 0,
      sma200: 0,
      sma400: 0,
      risk: 5, // Default, will be calculated after EMAs/SMAs
      timestamp: latestDataPoint.date,
    };
    
    return NextResponse.json({
      latestDataPoint: processedData,
      currentPrice: latestDataPoint.close,
      source: 'Yahoo Finance Latest',
      dataDate: new Date(latestDataPoint.date).toISOString(),
    });
    
  } catch (error: unknown) {
    console.error('Error fetching latest NVDA data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest NVDA data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 