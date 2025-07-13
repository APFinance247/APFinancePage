# Adding New Tickers to the Risk Chart Website

This guide documents all the changes needed to add new stock tickers to the risk chart website. This was documented when adding META and ETH to the existing system.

## Overview

The website supports dynamic stock analysis with risk calculations and color-coded visualizations. Adding new tickers requires updating configuration files, generating historical data, and ensuring all automation scripts include the new tickers.

## Required Changes

### 1. Update Stock Configuration (`src/types/stock-analysis.ts`)

Add the new ticker to the `STOCK_CONFIGS` object:

```typescript
export const STOCK_CONFIGS: Record<string, StockConfig> = {
  // ... existing configs ...
  META: {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    riskConfig: {
      algorithm: 'ema-focused',
      // Adjust risk thresholds based on stock volatility
      riskThresholds: {
        yellowTerritory: 0.18, // 18% for social media stock volatility
        elevatedTerritory: 0.10,
        nearEMA: -0.08
      }
    }
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    riskConfig: {
      algorithm: 'ema-focused',
      // Cryptocurrencies have higher volatility
      riskThresholds: {
        yellowTerritory: 0.25, // 25% for crypto volatility
        elevatedTerritory: 0.15,
        nearEMA: -0.10
      }
    }
  }
};
```

**Risk Threshold Guidelines:**
- **Traditional Tech Stocks**: 15% yellowTerritory (default)
- **Volatile Tech Stocks**: 18-20% yellowTerritory
- **Cryptocurrencies**: 25% yellowTerritory
- **ETFs**: 10% yellowTerritory (lower volatility)

### 2. Update Generation Script (`scripts/generate-all-stock-csvs.js`)

Add the new ticker to the `STOCK_CONFIGS` object in the script:

```javascript
const STOCK_CONFIGS = {
  // ... existing configs ...
  META: {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    riskThresholds: {
      yellowTerritory: 0.18,
      elevatedTerritory: 0.10,
      nearEMA: -0.08
    }
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    riskThresholds: {
      yellowTerritory: 0.25,
      elevatedTerritory: 0.15,
      nearEMA: -0.10
    }
  }
};
```

### 3. Update Daily Update Script (`scripts/update-all-stock-csvs.js`)

Add the new ticker to the `STOCK_CONFIGS` object in the update script:

```javascript
const STOCK_CONFIGS = {
  // ... existing configs ...
  META: {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    riskThresholds: {
      yellowTerritory: 0.18,
      elevatedTerritory: 0.10,
      nearEMA: -0.08
    }
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    riskThresholds: {
      yellowTerritory: 0.25,
      elevatedTerritory: 0.15,
      nearEMA: -0.10
    }
  }
};
```

### 4. Generate Historical Data

Run the script to generate CSV files for all stocks including the new ones:

```bash
node scripts/generate-all-stock-csvs.js
```

This will create:
- `public/stock-data/META.csv`
- `public/stock-data/ETH.csv`

### 5. Verify Daily Update Automation

The GitHub Actions workflow (`.github/workflows/update-stock-data.yml`) will automatically include the new tickers because it runs `npm run update-all-csvs` which uses the updated scripts.

**No changes needed** to the workflow file itself - it's already configured to handle dynamic ticker lists.

## What Gets Created Automatically

### 1. Chart Pages
The dynamic routing system automatically creates pages for new tickers:
- `/stocks/meta` - Meta Platforms chart
- `/stocks/eth` - Ethereum chart

### 2. Stock Selector Integration
The `StockSelector` component automatically includes new tickers:
- Color-coded buttons based on current risk
- Risk score display
- Navigation to ticker-specific pages

### 3. API Integration
The stock analysis API automatically supports new tickers through the updated `STOCK_CONFIGS`.

## File Structure After Adding New Tickers

```
src/
├── types/
│   └── stock-analysis.ts          # ✅ Updated with new STOCK_CONFIGS
├── components/
│   ├── StockSelector.tsx          # ✅ Automatically includes new tickers
│   └── StockRiskChart.tsx         # ✅ No changes needed
├── app/
│   └── stocks/
│       └── [symbol]/
│           └── page.tsx           # ✅ Automatically handles new tickers

scripts/
├── generate-all-stock-csvs.js    # ✅ Updated with new STOCK_CONFIGS
└── update-all-stock-csvs.js      # ✅ Updated with new STOCK_CONFIGS

public/
└── stock-data/
    ├── META.csv                   # ✅ Generated automatically
    └── ETH.csv                    # ✅ Generated automatically

.github/
└── workflows/
    └── update-stock-data.yml      # ✅ No changes needed
```

## Testing New Tickers

1. **Development Server**: Run `npm run dev` and navigate to:
   - `/stocks/meta`
   - `/stocks/eth`

2. **Stock Selector**: Verify new tickers appear in the top navigation bar with appropriate risk colors

3. **API Endpoints**: Test the API endpoints:
   - `/api/stock-analysis?symbol=META`
   - `/api/stock-analysis?symbol=ETH`

## Key Benefits of This Architecture

1. **Automatic Integration**: Once configured, new tickers are automatically included in all components
2. **Dynamic Routing**: Pages are created automatically using Next.js dynamic routing
3. **Scalable**: Easy to add more tickers by following the same pattern
4. **Consistent**: All tickers use the same risk calculation and visualization system

## Summary of Changes for META and ETH

1. ✅ Added to `src/types/stock-analysis.ts`
2. ✅ Added to `scripts/generate-all-stock-csvs.js`
3. ✅ Added to `scripts/update-all-stock-csvs.js`
4. ✅ Generated historical CSV data files
5. ✅ Verified GitHub Actions workflow works automatically
6. ✅ Tested automatic page creation and stock selector integration

## Future Ticker Additions

To add more tickers in the future:

1. Add to all three configuration files
2. Set appropriate risk thresholds based on asset volatility
3. Run the generation script
4. Test the new ticker pages and API endpoints

The system is designed to be extensible and maintainable for future additions. 