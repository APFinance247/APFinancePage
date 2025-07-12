// Core data types for stock analysis
export interface StockDataPoint {
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

export interface RiskStats {
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

export interface StockAnalysisResponse {
  data: StockDataPoint[];
  currentPrice: number;
  currentRisk: number;
  source?: string;
  riskStats?: RiskStats;
  symbol: string;
  companyName?: string;
}

// Provider types
export interface PriceData {
  date: Date;
  price: number;
  timestamp: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface DataProviderOptions {
  symbol: string;
  startDate?: Date;
  endDate?: Date;
  interval?: 'daily' | 'weekly';
}

export interface DataProvider {
  name: string;
  fetchData(options: DataProviderOptions): Promise<PriceData[]>;
}

// Risk calculation configuration
export interface RiskCalculationConfig {
  algorithm: 'ema-focused' | 'enhanced' | 'simple';
  // Periods for moving averages (in trading days)
  emaPeriods?: {
    short: number;  // Default: 8 * 5 (8 weeks)
    medium: number; // Default: 21 * 5 (21 weeks)
  };
  smaPeriods?: {
    short: number;   // Default: 50 * 5
    medium: number;  // Default: 100 * 5
    long: number;    // Default: 200 * 5
    extraLong: number; // Default: 400 * 5
  };
  // Risk thresholds
  riskThresholds?: {
    yellowTerritory: number; // Default: 0.15 (15% above 8W EMA)
    elevatedTerritory: number; // Default: 0.08
    nearEMA: number; // Default: -0.05
  };
}

export interface StockConfig {
  symbol: string;
  name: string;
  riskConfig?: RiskCalculationConfig;
  dataSource?: 'yahoo' | 'finnhub' | 'alphavantage';
}

// Pre-configured stocks
export const STOCK_CONFIGS: Record<string, StockConfig> = {
  VOO: {
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    riskConfig: {
      algorithm: 'ema-focused',
      // ETFs typically have lower volatility than individual stocks
      riskThresholds: {
        yellowTerritory: 0.10, // 10% for less volatile ETF
        elevatedTerritory: 0.05,
        nearEMA: -0.03
      }
    }
  },
  NVDA: {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    riskConfig: {
      algorithm: 'ema-focused',
    }
  },
  MSFT: {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    riskConfig: {
      algorithm: 'ema-focused',
    }
  },
  AAPL: {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    riskConfig: {
      algorithm: 'ema-focused',
    }
  },
  GOOGL: {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    riskConfig: {
      algorithm: 'ema-focused',
    }
  },
  AMZN: {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    riskConfig: {
      algorithm: 'ema-focused',
    }
  },
  TSLA: {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    riskConfig: {
      algorithm: 'ema-focused',
      // Tesla might need different thresholds due to higher volatility
      riskThresholds: {
        yellowTerritory: 0.20, // 20% for more volatile stock
        elevatedTerritory: 0.10,
        nearEMA: -0.08
      }
    }
  },
  'BTC-USD': {
    symbol: 'BTC-USD',
    name: 'Bitcoin',
    riskConfig: {
      algorithm: 'ema-focused',
      riskThresholds: {
        yellowTerritory: 0.20,
        elevatedTerritory: 0.10,
        nearEMA: -0.08
      }
    }
  }
}; 