/**
 * Yahoo Finance data provider
 */

import axios from 'axios';
import { DataProvider, DataProviderOptions, PriceData } from '@/types/stock-analysis';

export class YahooFinanceProvider implements DataProvider {
  name = 'Yahoo Finance';
  
  async fetchData(options: DataProviderOptions): Promise<PriceData[]> {
    const { symbol, startDate, endDate, interval = 'daily' } = options;
    
    // Handle cryptocurrency symbols - Yahoo Finance uses BTC-USD format
    const yahooSymbol = ['BTC', 'ETH', 'DOGE', 'ADA', 'SOL'].includes(symbol) 
      ? `${symbol}-USD` 
      : symbol;
    
    // Default dates if not provided
    const end = endDate || new Date();
    const start = startDate || new Date(1999, 0, 1); // Default to 1999
    
    const period1 = Math.floor(start.getTime() / 1000);
    const period2 = Math.floor(end.getTime() / 1000);
    
    // Convert interval to Yahoo format
    const yahooInterval = interval === 'weekly' ? '1wk' : '1d';
    
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${period1}&period2=${period2}&interval=${yahooInterval}`;
    
    try {
      console.log(`Fetching ${symbol} data from Yahoo Finance...`);
      
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
      
      // Filter out null values and create clean data
      const cleanData: PriceData[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] !== null && closes[i] !== undefined) {
          cleanData.push({
            date: new Date(timestamps[i] * 1000),
            timestamp: timestamps[i] * 1000,
            price: closes[i],
            open: quote.open?.[i] || closes[i],
            high: quote.high?.[i] || closes[i],
            low: quote.low?.[i] || closes[i],
            volume: quote.volume?.[i] || 0
          });
        }
      }
      
      console.log(`Successfully fetched ${cleanData.length} data points for ${symbol}`);
      
      return cleanData;
      
    } catch (error) {
      console.error(`Error fetching ${symbol} data from Yahoo Finance:`, error);
      throw error;
    }
  }
} 