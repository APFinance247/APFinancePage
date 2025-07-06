# Stock Risk Analysis - Refactoring Documentation

## Overview

The stock risk analysis system has been refactored to support multiple stocks beyond NVDA. The backend logic is now centralized and reusable.

## Architecture

### 1. **Centralized Backend Structure**

```
src/
├── lib/
│   ├── indicators/
│   │   └── moving-averages.ts      # Technical indicators (SMA, EMA, RSI, etc.)
│   ├── risk-analysis/
│   │   └── risk-calculator.ts      # Risk calculation algorithms
│   ├── data-providers/
│   │   └── yahoo-provider.ts       # Data fetching from Yahoo Finance
│   └── stock-analysis-service.ts   # Main orchestration service
├── types/
│   └── stock-analysis.ts           # TypeScript interfaces and stock configs
└── components/
    └── StockRiskChart.tsx          # Generic stock chart component
```

### 2. **Key Components**

#### Technical Indicators (`moving-averages.ts`)
- `calculateSMA()` - Simple Moving Average
- `calculateEMA()` - Exponential Moving Average
- `calculateRSI()` - Relative Strength Index
- `calculateMACD()` - Moving Average Convergence Divergence
- `calculateBollingerBands()` - Bollinger Bands
- `calculateATR()` - Average True Range

#### Risk Calculator (`risk-calculator.ts`)
- `calculateRisk()` - Main risk calculation function
- Three algorithms: 'ema-focused', 'enhanced', 'simple'
- `getRiskColor()` - Color mapping for risk levels
- `getRiskDescription()` - Risk level descriptions

#### Stock Analysis Service (`stock-analysis-service.ts`)
- `analyzeStock(symbol)` - Complete stock analysis
- `getLatestPrice(symbol)` - Get current price
- `processCsvData()` - Process historical CSV data

### 3. **Stock Configuration**

Pre-configured stocks in `types/stock-analysis.ts`:
```typescript
export const STOCK_CONFIGS: Record<string, StockConfig> = {
  NVDA: { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  MSFT: { symbol: 'MSFT', name: 'Microsoft Corporation' },
  AAPL: { symbol: 'AAPL', name: 'Apple Inc.' },
  GOOGL: { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  AMZN: { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  TSLA: { 
    symbol: 'TSLA', 
    name: 'Tesla Inc.',
    riskConfig: {
      algorithm: 'ema-focused',
      riskThresholds: {
        yellowTerritory: 0.20, // Higher for volatile stocks
        elevatedTerritory: 0.10,
        nearEMA: -0.08
      }
    }
  }
};
```

## Usage

### 1. **Generic API Endpoint**

```bash
# Fetch any stock data
GET /api/stock-analysis?symbol=MSFT

# With date range
GET /api/stock-analysis?symbol=AAPL&startDate=2020-01-01&endDate=2024-01-01
```

### 2. **React Component**

```tsx
import StockRiskChart from '@/components/StockRiskChart';

// Basic usage
<StockRiskChart symbol="MSFT" />

// With company name
<StockRiskChart 
  symbol="MSFT" 
  companyName="Microsoft Corporation" 
/>

// With date range
<StockRiskChart 
  symbol="AAPL"
  startDate={new Date('2020-01-01')}
  endDate={new Date('2024-01-01')}
/>
```

### 3. **Dynamic Routes**

Access any stock via URL:
- `/` - NVDA (default)
- `/stocks/msft` - Microsoft
- `/stocks/aapl` - Apple
- `/stocks/googl` - Google
- etc.

### 4. **Generate CSV Data**

```bash
# Generate CSV for any stock
npm run generate-stock-csv -- --symbol=MSFT

# Output: public/msft-historical-data.csv
```

## Adding New Stocks

### 1. **Add to Configuration**

Edit `src/types/stock-analysis.ts`:
```typescript
export const STOCK_CONFIGS = {
  // ... existing stocks
  META: {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    riskConfig: {
      algorithm: 'ema-focused',
      // Optional: custom thresholds
    }
  }
};
```

### 2. **Generate Historical Data**

```bash
npm run generate-stock-csv -- --symbol=META
```

### 3. **Use in Application**

The stock will automatically appear in:
- Stock selector menu
- Available at `/stocks/meta`
- API endpoint `/api/stock-analysis?symbol=META`

## Customizing Risk Calculation

### 1. **Per-Stock Configuration**

```typescript
TSLA: {
  symbol: 'TSLA',
  name: 'Tesla Inc.',
  riskConfig: {
    algorithm: 'ema-focused',
    emaPeriods: {
      short: 10 * 5,  // 10 weeks instead of 8
      medium: 26 * 5  // 26 weeks instead of 21
    },
    riskThresholds: {
      yellowTerritory: 0.25,    // 25% for high volatility
      elevatedTerritory: 0.12,  // 12%
      nearEMA: -0.10           // -10%
    }
  }
}
```

### 2. **Custom Algorithm**

Add new algorithm in `risk-calculator.ts`:
```typescript
function calculateCustomRisk(
  dataPoints: StockDataPoint[],
  config: Required<RiskCalculationConfig>
): StockDataPoint[] {
  // Your custom risk calculation
}
```

## Migration from NVDA-specific Code

### Before (NVDA-specific):
```tsx
import NVDARiskChart from '@/components/NVDARiskChart';
<NVDARiskChart />
```

### After (Generic):
```tsx
import StockRiskChart from '@/components/StockRiskChart';
<StockRiskChart symbol="NVDA" useCSV={true} />
```

### API Migration:
- Old: `/api/nvda-data`
- New: `/api/stock-analysis?symbol=NVDA`

## Performance Considerations

1. **CSV Pre-calculation**: For frequently accessed stocks, pre-calculate and store as CSV
2. **Caching**: Yahoo Finance data is fetched fresh each time - consider implementing caching
3. **Rate Limits**: Be aware of Yahoo Finance rate limits when adding many stocks

## Future Enhancements

1. **Additional Data Providers**
   - Alpha Vantage
   - IEX Cloud
   - Polygon.io

2. **More Technical Indicators**
   - Stochastic Oscillator
   - Williams %R
   - Fibonacci Retracements

3. **Database Integration**
   - Store historical data in PostgreSQL
   - Implement data caching layer
   - Real-time updates via WebSocket

4. **Portfolio Analysis**
   - Multiple stock comparison
   - Portfolio risk assessment
   - Correlation analysis 