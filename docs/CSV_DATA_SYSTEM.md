# CSV Data System Documentation

## Overview

The NVDA Risk Chart application uses a hybrid data storage approach that combines local CSV files for historical data with real-time API calls for the latest market data. This system significantly improves performance by reducing API calls and enables offline access to historical data.

## Architecture

### Data Storage Structure

```
public/
├── nvda-historical-data.csv    # Legacy NVDA data (backward compatibility)
└── stock-data/
    ├── NVDA.csv
    ├── MSFT.csv
    ├── AAPL.csv
    ├── GOOGL.csv
    ├── AMZN.csv
    ├── TSLA.csv
    └── VOO.csv
```

### CSV File Format

Each CSV file contains the following columns:
- `date` - Trading date (YYYY-MM-DD format)
- `price` - Closing price
- `timestamp` - Unix timestamp (milliseconds)
- `ema8` - 8-week Exponential Moving Average
- `ema21` - 21-week Exponential Moving Average
- `sma50` - 50-week Simple Moving Average
- `sma100` - 100-week Simple Moving Average
- `sma200` - 200-week Simple Moving Average
- `sma400` - 400-week Simple Moving Average
- `risk` - Pre-calculated risk score (1-10)

### Data Flow

1. **Initial Load**: Charts first attempt to load historical data from CSV files
2. **Latest Data**: Only the most recent data point is fetched via API
3. **Combination**: Historical CSV data is combined with the latest API data
4. **Display**: Charts render the combined dataset

## Scripts

### Generate All CSVs
```bash
npm run generate-all-csvs
```
- Generates CSV files for all configured stocks
- Fetches complete historical data via API
- Pre-calculates all technical indicators and risk scores
- Saves to `public/stock-data/` directory

### Update All CSVs
```bash
npm run update-all-csvs
```
- Updates existing CSV files with new data points
- Only fetches recent data to minimize API calls
- Recalculates indicators for the entire dataset
- Updates the last data point if price changed

## GitHub Actions Automation

The system includes a GitHub Actions workflow that runs daily:

```yaml
name: Update Stock Data
on:
  schedule:
    - cron: '0 22 * * 1-5'  # 5 PM EST, Monday-Friday
  workflow_dispatch:  # Manual trigger
```

The workflow:
1. Builds and starts the Next.js application
2. Runs the update script for all stocks
3. Commits and pushes any changes to CSV files

## API Endpoints

### `/api/stock-latest?symbol={SYMBOL}`
Fetches only the latest price data for a specific stock.

**Response:**
```json
{
  "symbol": "NVDA",
  "currentPrice": 145.89,
  "dataDate": "2024-01-15T00:00:00.000Z",
  "timestamp": 1705276800000,
  "open": 144.50,
  "high": 146.25,
  "low": 144.00,
  "volume": 45000000,
  "source": "Yahoo Finance"
}
```

### `/api/stock-analysis?symbol={SYMBOL}`
Full stock analysis endpoint (used for initial CSV generation).

## Benefits

1. **Performance**: 90%+ reduction in API calls
2. **Reliability**: Historical data always available
3. **Cost**: Reduced API usage costs
4. **Speed**: Faster chart loading times
5. **Offline**: Historical data accessible offline

## Adding New Stocks

1. Add stock configuration to `src/types/stock-analysis.ts`:
```typescript
export const STOCK_CONFIGS: Record<string, StockConfig> = {
  // ... existing stocks ...
  NEW: {
    symbol: 'NEW',
    name: 'New Company Inc.',
    riskConfig: {
      algorithm: 'ema-focused',
      // Optional custom thresholds
    }
  }
};
```

2. Update the scripts' STOCK_CONFIGS object to match

3. Generate the initial CSV:
```bash
npm run generate-all-csvs
```

4. The daily GitHub Action will automatically maintain it

## Manual Updates

To manually update CSVs (useful for debugging):

1. Ensure the app is running:
```bash
npm run dev
```

2. In another terminal:
```bash
npm run update-all-csvs
```

## Troubleshooting

### CSV Not Loading
- Check if file exists in `public/stock-data/`
- Verify CSV format matches expected structure
- Check browser console for errors

### Outdated Data
- Manually run update script
- Check GitHub Actions logs for failures
- Verify API endpoints are accessible

### Risk Calculations
- Risk is pre-calculated in CSVs
- Uses EMA-focused algorithm by default
- Stock-specific thresholds in configuration

## Cryptocurrency Support

The system also supports cryptocurrencies like Bitcoin. When adding crypto assets:

1. **Symbol Conversion**: Cryptocurrencies are automatically converted to Yahoo Finance format
   - BTC → BTC-USD
   - ETH → ETH-USD
   - etc.

2. **Higher Risk Thresholds**: Cryptocurrencies use adjusted risk thresholds due to higher volatility:
```javascript
BTC: {
  symbol: 'BTC',
  name: 'Bitcoin',
  riskThresholds: {
    yellowTerritory: 0.25,  // 25% (vs 15% for stocks)
    elevatedTerritory: 0.15, // 15% (vs 8% for stocks)
    nearEMA: -0.10          // -10% (vs -5% for stocks)
  }
}
```

3. **Data Availability**: Cryptocurrency data typically starts from when the asset began trading on major exchanges (e.g., BTC from 2014) 