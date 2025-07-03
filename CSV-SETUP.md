# NVDA Risk Chart - CSV Optimization Setup

## Overview

This optimization reduces API calls from **~6000+ historical data points** to just **1 API call per day** by:
- Storing historical data in a CSV file locally
- Fetching only the latest data point via API
- Combining CSV + latest data for real-time analysis

## Quick Setup

### 1. First Time Setup

Make sure your Next.js app is running:
```bash
npm run dev
```

Then generate the initial CSV file:
```bash
npm run generate-csv
```

This will:
- Fetch all historical NVDA data from 1999-present 
- Save it as `/public/nvda-historical-data.csv`
- Display confirmation and file stats

### 2. Verify Setup

After running the script, you should see:
- ✅ CSV file created at `/public/nvda-historical-data.csv`
- 📊 Data range from 1999 to current date
- 🔍 Verification of data points

### 3. App Behavior

The app now:
- 📂 Loads historical data from CSV (fast, local)
- 🌐 Fetches only latest price via `/api/nvda-latest` (1 API call)
- 🔄 Combines data and calculates EMAs/SMAs/Risk
- 📈 Displays full chart with all historical context

## Maintenance

### Update CSV (Recommended: Weekly)

To add recent data to your CSV:
```bash
npm run generate-csv
```

This refreshes the CSV with all latest data.

### Fallback Behavior

If CSV file is missing or corrupted, the app automatically falls back to full API mode.

## Benefits

- **⚡ 99.98% API Reduction**: From ~6000 to 1 call per day
- **🚀 Faster Loading**: CSV loads in milliseconds vs seconds
- **💰 Cost Savings**: Massive reduction in API usage
- **🔄 Reliable**: Fallback to full API if needed
- **📊 Same Experience**: Identical chart functionality

## File Structure

```
nvda-risk-chart/
├── public/
│   └── nvda-historical-data.csv    # Historical data (auto-generated)
├── scripts/
│   └── generate-csv.js             # CSV generation script
├── src/app/api/
│   ├── nvda-latest/                # New: Latest data only
│   ├── nvda-data-yahoo/            # Backup: Full historical
│   └── nvda-data/                  # Backup: Full historical
└── src/components/
    └── NVDARiskChart.tsx           # Updated: CSV + latest logic
```

## Troubleshooting

### CSV Generation Fails
- Ensure Next.js is running (`npm run dev`)
- Check API endpoints are working
- Verify network connectivity

### App Shows Error
- Check if CSV file exists in `/public/`
- Run `npm run generate-csv` to recreate
- App will fallback to full API mode if CSV issues persist

### Latest Data Not Updating
- Latest data fetches from `/api/nvda-latest`
- If endpoint fails, app uses last CSV price
- Check browser console for API errors

## Development Notes

The optimization works by:

1. **CSV Loading**: `loadHistoricalDataFromCSV()` reads local CSV
2. **Latest Fetch**: Calls `/api/nvda-latest` for current price
3. **Data Merging**: Combines historical + latest data
4. **Processing**: Calculates EMAs, SMAs, risk on complete dataset
5. **Display**: Shows full chart with all data

This maintains the exact same user experience while dramatically reducing external API dependencies. 