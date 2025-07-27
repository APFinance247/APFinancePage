const fs = require('fs');
const axios = require('axios');
const path = require('path');

// Helper functions for moving averages (same as in the component)
function calculateSMA(data, period) {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(0);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

function calculateEMA(data, period) {
  const ema = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      ema.push(data[i]);
    } else {
      ema.push((data[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
    }
  }
  return ema;
}

// EMA-focused risk calculation (same as in component)
function calculateEMAFocusedRisk(dataPoints, riskThresholds = {}) {
  const currentDate = new Date();
  const defaultThresholds = {
    yellowTerritory: 0.15,
    elevatedTerritory: 0.08,
    nearEMA: -0.05,
    ...riskThresholds
  };
  
  return dataPoints.map((point, index) => {
    if (point.sma50 === 0 || point.ema8 === 0 || point.ema21 === 0) return { ...point, risk: 5 };
    
    // Calculate years from current date for time-based weighting
    const yearsFromNow = (currentDate.getTime() - point.date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const modernWeight = Math.max(0, Math.min(1, (5 - yearsFromNow) / 5));
    
    // Calculate deviations from key levels
    const dev8EMA = (point.price - point.ema8) / point.ema8;
    const dev21EMA = (point.price - point.ema21) / point.ema21;
    const dev50SMA = (point.price - point.sma50) / point.sma50;
    const dev100SMA = (point.price - point.sma100) / point.sma100;
    const dev200SMA = (point.price - point.sma200) / point.sma200;
    
    let risk;
    
    // STEP 1: Determine base risk from EMA position
    if (dev8EMA >= defaultThresholds.yellowTerritory) {
      if (dev8EMA >= defaultThresholds.yellowTerritory * 2) {
        risk = 9.5;
      } else if (dev8EMA >= defaultThresholds.yellowTerritory * 1.5) {
        risk = 9.0;
      } else if (dev8EMA >= defaultThresholds.yellowTerritory * 1.2) {
        risk = 8.5;
      } else {
        risk = 8.0;
      }
    } else if (dev8EMA >= defaultThresholds.elevatedTerritory) {
      const range = defaultThresholds.yellowTerritory - defaultThresholds.elevatedTerritory;
      const position = (dev8EMA - defaultThresholds.elevatedTerritory) / range;
      risk = 6.5 + position * 1.5;
    } else if (dev8EMA >= defaultThresholds.nearEMA) {
      const range = defaultThresholds.elevatedTerritory - defaultThresholds.nearEMA;
      const position = (dev8EMA - defaultThresholds.nearEMA) / range;
      risk = 5.0 + position * 1.5;
    } else if (dev21EMA >= -0.08) {
      if (dev21EMA >= 0) {
        risk = 4.0 + dev21EMA / 0.08 * 1.0;
      } else {
        risk = 3.0 + (dev21EMA + 0.08) / 0.08 * 1.0;
      }
    } else {
      const deepestDeviation = Math.min(dev50SMA, dev100SMA, dev200SMA);
      
      if (deepestDeviation <= -0.25) {
        risk = 1.0;
      } else if (deepestDeviation <= -0.15) {
        risk = 1.5;
      } else if (deepestDeviation <= -0.08) {
        risk = 2.0;
      } else if (dev50SMA <= -0.03) {
        risk = 2.5;
      } else {
        risk = 3.0;
      }
    }
    
    // STEP 2: Modern time-based adjustments
    if (modernWeight > 0.7) {
      if (risk <= 3) {
        risk -= 0.2;
      } else if (risk >= 7) {
        risk += 0.1;
      }
    }
    
    // STEP 3: Volatility adjustment
    if (modernWeight > 0.3 && index > 50) {
      const recentPrices = dataPoints.slice(Math.max(0, index - 20), index + 1).map(p => p.price);
      const priceChanges = recentPrices.slice(1).map((price, i) => (price - recentPrices[i]) / recentPrices[i]);
      const volatility = Math.sqrt(priceChanges.reduce((sum, change) => sum + change * change, 0) / priceChanges.length);
      
      if (volatility > 0.06) {
        risk -= 0.2;
      } else if (volatility > 0.04) {
        risk -= 0.1;
      }
    }
    
    // STEP 4: Trend consistency bonus/penalty
    const trendAlignment = (
      (dev8EMA > 0 ? 1 : -1) + 
      (dev21EMA > 0 ? 1 : -1) + 
      (dev50SMA > 0 ? 1 : -1)
    ) / 3;
    
    if (Math.abs(trendAlignment) > 0.6) {
      risk += trendAlignment * 0.15;
    }
    
    // STEP 5: Final bounds and smoothing
    risk = Math.max(1, Math.min(10, risk));
    
    if (index > 0 && index < dataPoints.length - 1) {
      const prevRisk = dataPoints[index - 1]?.risk || risk;
      risk = risk * 0.8 + prevRisk * 0.2;
    }
    
    return {
      ...point,
      risk: Math.round(risk * 100) / 100
    };
  });
}

// Stock configurations - matching the TypeScript config
const STOCK_CONFIGS = {
  VOO: {
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    riskThresholds: {
      yellowTerritory: 0.10,
      elevatedTerritory: 0.05,
      nearEMA: -0.03
    }
  },
  NVDA: {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation'
  },
  MSFT: {
    symbol: 'MSFT',
    name: 'Microsoft Corporation'
  },
  AAPL: {
    symbol: 'AAPL',
    name: 'Apple Inc.'
  },
  GOOGL: {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.'
  },
  AMZN: {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.'
  },
  TSLA: {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    riskThresholds: {
      yellowTerritory: 0.20,
      elevatedTerritory: 0.10,
      nearEMA: -0.08
    }
  },
  META: {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    riskThresholds: {
      yellowTerritory: 0.18,
      elevatedTerritory: 0.10,
      nearEMA: -0.08
    }
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    riskThresholds: {
      yellowTerritory: 0.25,
      elevatedTerritory: 0.15,
      nearEMA: -0.10
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
  },
  UNH: {
    symbol: 'UNH',
    name: 'UnitedHealth Group Inc.',
    riskThresholds: {
      yellowTerritory: 0.15,
      elevatedTerritory: 0.08,
      nearEMA: -0.05
    }
  },
  GRAL: {
    symbol: 'GRAL',
    name: 'GRAIL, Inc.',
    riskThresholds: {
      yellowTerritory: 0.20,
      elevatedTerritory: 0.10,
      nearEMA: -0.08
    }
  }
};

async function generateStockCSV(symbol, baseUrl = 'http://localhost:3000') {
  try {
    const stockConfig = STOCK_CONFIGS[symbol];
    if (!stockConfig) {
      throw new Error(`Unknown stock symbol: ${symbol}`);
    }
    
    console.log(`\n📊 Generating CSV for ${symbol} (${stockConfig.name})...`);
    
    // Fetch data from stock analysis API
    console.log(`📡 Fetching data for ${symbol}...`);
    const response = await axios.get(`${baseUrl}/api/stock-analysis?symbol=${symbol}`);
    
    if (!response.data || !response.data.data) {
      throw new Error(`Invalid response structure for ${symbol}`);
    }
    
    const data = response.data.data;
    console.log(`✅ Received ${data.length} data points`);
    
    // Sort by date to ensure proper order
    const sortedData = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const prices = sortedData.map(d => d.price);
    
    // Calculate moving averages
    console.log('🔄 Calculating EMAs and SMAs...');
    const ema8 = calculateEMA(prices, 8 * 5);    // ~8 weeks in daily data
    const ema21 = calculateEMA(prices, 21 * 5);  // ~21 weeks in daily data  
    const sma50 = calculateSMA(prices, 50 * 5);  // ~50 weeks in daily data
    const sma100 = calculateSMA(prices, 100 * 5); // ~100 weeks in daily data
    const sma200 = calculateSMA(prices, 200 * 5); // ~200 weeks in daily data
    const sma400 = calculateSMA(prices, 400 * 5); // ~400 weeks in daily data
    
    // Create processed data points
    const processedData = sortedData.map((item, index) => ({
      date: new Date(item.date),
      price: item.price,
      ema8: ema8[index],
      ema21: ema21[index],
      sma50: sma50[index],
      sma100: sma100[index],
      sma200: sma200[index],
      sma400: sma400[index],
      risk: 5, // Will be calculated next
      timestamp: new Date(item.date).getTime(),
    }));
    
    // Calculate risk levels with stock-specific thresholds
    console.log('🎯 Calculating risk levels...');
    const dataWithRisk = calculateEMAFocusedRisk(processedData, stockConfig.riskThresholds);
    
    // Create CSV content
    let csvContent = 'date,price,timestamp,ema8,ema21,sma50,sma100,sma200,sma400,risk\n';
    
    dataWithRisk.forEach(item => {
      const dateStr = item.date.toISOString().split('T')[0];
      const timestamp = item.timestamp;
      const price = item.price;
      const ema8 = item.ema8.toFixed(2);
      const ema21 = item.ema21.toFixed(2);
      const sma50 = item.sma50.toFixed(2);
      const sma100 = item.sma100.toFixed(2);
      const sma200 = item.sma200.toFixed(2);
      const sma400 = item.sma400.toFixed(2);
      const risk = item.risk.toFixed(2);
      
      csvContent += `${dateStr},${price},${timestamp},${ema8},${ema21},${sma50},${sma100},${sma200},${sma400},${risk}\n`;
    });
    
    // Write to CSV file
    const csvFilePath = path.join('./public/stock-data', `${symbol}.csv`);
    fs.writeFileSync(csvFilePath, csvContent);
    
    console.log(`✅ Generated ${csvFilePath}`);
    console.log(`📈 Data range: ${dataWithRisk[0].date.toISOString().split('T')[0]} to ${dataWithRisk[dataWithRisk.length - 1].date.toISOString().split('T')[0]}`);
    console.log(`💾 File size: ${(csvContent.length / 1024).toFixed(2)} KB`);
    
    // Calculate risk statistics
    const risks = dataWithRisk.map(d => d.risk);
    const riskStats = {
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
    
    console.log(`📊 Risk Stats - Min: ${riskStats.min.toFixed(2)}, Max: ${riskStats.max.toFixed(2)}, Avg: ${riskStats.avg.toFixed(2)}`);
    
    return { symbol, success: true, dataPoints: dataWithRisk.length };
    
  } catch (error) {
    console.error(`❌ Error generating CSV for ${symbol}:`, error.message);
    return { symbol, success: false, error: error.message };
  }
}

async function generateAllCSVs() {
  console.log('🚀 Generating CSV files for all configured stocks...\n');
  
  // Ensure the stock-data directory exists
  const stockDataDir = './public/stock-data';
  if (!fs.existsSync(stockDataDir)) {
    fs.mkdirSync(stockDataDir, { recursive: true });
    console.log(`📁 Created directory: ${stockDataDir}`);
  }
  
  // Get base URL from environment or use default
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  
  const symbols = Object.keys(STOCK_CONFIGS);
  const results = [];
  
  for (const symbol of symbols) {
    const result = await generateStockCSV(symbol, baseUrl);
    results.push(result);
    
    // Add a small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n📊 Summary:');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successfully generated: ${successful.length} CSVs`);
  successful.forEach(r => console.log(`   - ${r.symbol}: ${r.dataPoints} data points`));
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length} CSVs`);
    failed.forEach(r => console.log(`   - ${r.symbol}: ${r.error}`));
  }
  
  // Generate NVDA CSV in the root public folder for backward compatibility
  if (STOCK_CONFIGS.NVDA && successful.find(r => r.symbol === 'NVDA')) {
    const nvdaSource = path.join(stockDataDir, 'NVDA.csv');
    const nvdaDest = './public/nvda-historical-data.csv';
    fs.copyFileSync(nvdaSource, nvdaDest);
    console.log('\n📋 Copied NVDA.csv to nvda-historical-data.csv for backward compatibility');
  }
  
  console.log('\n🎉 CSV generation complete!');
  
  if (failed.length > 0) {
    process.exit(1);
  }
}

// Check if this is being run directly
if (require.main === module) {
  generateAllCSVs().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { generateAllCSVs, generateStockCSV }; 