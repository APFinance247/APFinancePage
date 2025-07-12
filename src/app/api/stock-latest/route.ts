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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }
    
    // Handle cryptocurrency symbols - Yahoo Finance uses BTC-USD format
    const yahooSymbol = ['BTC', 'ETH', 'DOGE', 'ADA', 'SOL'].includes(symbol.toUpperCase()) 
      ? `${symbol.toUpperCase()}-USD` 
      : symbol.toUpperCase();
    
    // Get only the last 5 trading days to ensure we have the latest data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7); // Last week to ensure we get latest trading day
    
    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000);
    
    // Use Yahoo Finance API for latest data
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${period1}&period2=${period2}&interval=1d`;
    
    console.log(`Fetching latest ${symbol} data from Yahoo Finance...`);
    
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
    
    console.log(`Latest data point for ${symbol}: ${new Date(latestDataPoint.date).toDateString()} - $${latestDataPoint.close}`);
    
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice: latestDataPoint.close,
      dataDate: new Date(latestDataPoint.date).toISOString(),
      timestamp: latestDataPoint.date,
      open: latestDataPoint.open,
      high: latestDataPoint.high,
      low: latestDataPoint.low,
      volume: latestDataPoint.volume,
      source: 'Yahoo Finance'
    });
    
  } catch (error) {
    console.error('Error fetching latest stock data:', error);
    
    // If it's an axios error, provide more details
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        return NextResponse.json(
          { error: 'Invalid stock symbol or data not available' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { 
          error: 'Failed to fetch data from Yahoo Finance',
          details: error.response?.data || error.message
        },
        { status: error.response?.status || 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch latest stock data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 