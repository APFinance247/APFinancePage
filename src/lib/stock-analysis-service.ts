/**
 * Stock Analysis Service
 * Main service that orchestrates data fetching, indicator calculation, and risk analysis
 */

import { 
  StockDataPoint, 
  PriceData, 
  StockAnalysisResponse, 
  RiskStats,
  StockConfig,
  STOCK_CONFIGS
} from '@/types/stock-analysis';
import { calculateSMA, calculateEMA } from '@/lib/indicators/moving-averages';
import { calculateRisk, getRiskColor, getRiskDescription } from '@/lib/risk-analysis/risk-calculator';
import { YahooFinanceProvider } from '@/lib/data-providers/yahoo-provider';

export class StockAnalysisService {
  private dataProvider: YahooFinanceProvider;
  
  constructor() {
    this.dataProvider = new YahooFinanceProvider();
  }
  
  /**
   * Analyze a stock with risk calculations
   */
  async analyzeStock(
    symbol: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<StockAnalysisResponse> {
    // Get stock configuration
    const stockConfig = STOCK_CONFIGS[symbol] || {
      symbol,
      name: symbol,
      riskConfig: { algorithm: 'ema-focused' }
    };
    
    // Fetch price data
    const priceData = await this.dataProvider.fetchData({
      symbol,
      startDate,
      endDate,
      interval: 'daily'
    });
    
    if (priceData.length === 0) {
      throw new Error(`No data found for ${symbol}`);
    }
    
    // Process data and calculate indicators
    const processedData = this.processStockData(priceData, stockConfig);
    
    // Calculate risk statistics
    const riskStats = this.calculateRiskStats(processedData);
    
    // Get current values
    const currentData = processedData[processedData.length - 1];
    
    return {
      data: processedData,
      currentPrice: currentData.price,
      currentRisk: currentData.risk,
      source: this.dataProvider.name,
      riskStats,
      symbol: stockConfig.symbol,
      companyName: stockConfig.name
    };
  }
  
  /**
   * Process raw price data into full analysis data points
   */
  private processStockData(
    priceData: PriceData[], 
    stockConfig: StockConfig
  ): StockDataPoint[] {
    const prices = priceData.map(d => d.price);
    
    // Get periods from config or use defaults
    const emaPeriods = stockConfig.riskConfig?.emaPeriods || {
      short: 8 * 5,   // 8 weeks
      medium: 21 * 5  // 21 weeks
    };
    
    const smaPeriods = stockConfig.riskConfig?.smaPeriods || {
      short: 50 * 5,
      medium: 100 * 5,
      long: 200 * 5,
      extraLong: 400 * 5
    };
    
    // Calculate moving averages
    const ema8 = calculateEMA(prices, emaPeriods.short);
    const ema21 = calculateEMA(prices, emaPeriods.medium);
    const sma50 = calculateSMA(prices, smaPeriods.short);
    const sma100 = calculateSMA(prices, smaPeriods.medium);
    const sma200 = calculateSMA(prices, smaPeriods.long);
    const sma400 = calculateSMA(prices, smaPeriods.extraLong);
    
    // Create data points with indicators
    let dataPoints: StockDataPoint[] = priceData.map((item, index) => ({
      date: item.date,
      price: item.price,
      timestamp: item.timestamp,
      ema8: ema8[index],
      ema21: ema21[index],
      sma50: sma50[index],
      sma100: sma100[index],
      sma200: sma200[index],
      sma400: sma400[index],
      risk: 5 // Default, will be calculated
    }));
    
    // Calculate risk
    dataPoints = calculateRisk(dataPoints, stockConfig.riskConfig);
    
    return dataPoints;
  }
  
  /**
   * Calculate risk statistics
   */
  private calculateRiskStats(data: StockDataPoint[]): RiskStats {
    const risks = data.map(d => d.risk);
    
    return {
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
  }
  
  /**
   * Get latest price for a stock
   */
  async getLatestPrice(symbol: string): Promise<{
    price: number;
    date: Date;
    change: number;
    changePercent: number;
  }> {
    // Get last 5 days to ensure we have the latest trading day
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    
    const priceData = await this.dataProvider.fetchData({
      symbol,
      startDate,
      endDate,
      interval: 'daily'
    });
    
    if (priceData.length < 2) {
      throw new Error(`Insufficient data for ${symbol}`);
    }
    
    const latest = priceData[priceData.length - 1];
    const previous = priceData[priceData.length - 2];
    
    return {
      price: latest.price,
      date: latest.date,
      change: latest.price - previous.price,
      changePercent: ((latest.price - previous.price) / previous.price) * 100
    };
  }
  
  /**
   * Process CSV data (for pre-calculated historical data)
   */
  processCsvData(csvText: string): StockDataPoint[] {
    const lines = csvText.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    const dataLines = lines.slice(1); // Skip header
    
    const dataPoints = dataLines.map(line => {
      const [dateStr, priceStr, timestampStr, ema8Str, ema21Str, sma50Str, sma100Str, sma200Str, sma400Str, riskStr] = line.split(',');
      
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
    }).filter(item => !isNaN(item.price) && item.price > 0);
    
    return dataPoints;
  }
  
  /**
   * Export functions
   */
  static getRiskColor = getRiskColor;
  static getRiskDescription = getRiskDescription;
}

// Singleton instance
export const stockAnalysisService = new StockAnalysisService(); 