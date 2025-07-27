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
  META: {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    riskConfig: {
      algorithm: 'ema-focused',
      // Meta can be quite volatile
      riskThresholds: {
        yellowTerritory: 0.18, // 18% for social media stock volatility
        elevatedTerritory: 0.10,
        nearEMA: -0.08
      }
    }
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    riskConfig: {
      algorithm: 'ema-focused',
      // Cryptocurrencies have much higher volatility
      riskThresholds: {
        yellowTerritory: 0.25, // 25% for crypto volatility
        elevatedTerritory: 0.15,
        nearEMA: -0.10
      }
    }
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    riskConfig: {
      algorithm: 'ema-focused',
      // Ethereum typically has similar volatility to Bitcoin
      riskThresholds: {
        yellowTerritory: 0.25, // 25% for crypto volatility
        elevatedTerritory: 0.15,
        nearEMA: -0.10
      }
    }
  },
  UNH: {
    symbol: 'UNH',
    name: 'UnitedHealth Group Inc.',
    riskConfig: {
      algorithm: 'ema-focused',
      // Healthcare stock with moderate volatility
      riskThresholds: {
        yellowTerritory: 0.15, // 15% for healthcare stock
        elevatedTerritory: 0.08,
        nearEMA: -0.05
      }
    }
  },
  GRAL: {
    symbol: 'GRAL',
    name: 'GRAIL, Inc.',
    riskConfig: {
      algorithm: 'ema-focused',
      // Biotech stock with higher volatility
      riskThresholds: {
        yellowTerritory: 0.20, // 20% for biotech volatility
        elevatedTerritory: 0.10,
        nearEMA: -0.08
      }
    }
  }
};

// Top navigation stocks (main selector buttons)
export const TOP_NAVIGATION_STOCKS = [
  'VOO', 'NVDA', 'MSFT', 'AAPL', 'GOOGL', 'AMZN', 'TSLA', 'META', 'BTC', 'ETH', 'UNH'
] as const; 