const fs = require('fs');
const axios = require('axios');
const path = require('path');

// Import the generation functions
const { generateStockCSV } = require('./generate-all-stock-csvs');

// Helper functions for moving averages
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

// EMA-focused risk calculation
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
    
    const yearsFromNow = (currentDate.getTime() - point.date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const modernWeight = Math.max(0, Math.min(1, (5 - yearsFromNow) / 5));
    
    const dev8EMA = (point.price - point.ema8) / point.ema8;
    const dev21EMA = (point.price - point.ema21) / point.ema21;
    const dev50SMA = (point.price - point.sma50) / point.sma50;
    const dev100SMA = (point.price - point.sma100) / point.sma100;
    const dev200SMA = (point.price - point.sma200) / point.sma200;
    
    let risk;
    
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
    
    if (modernWeight > 0.7) {
      if (risk <= 3) {
        risk -= 0.2;
      } else if (risk >= 7) {
        risk += 0.1;
      }
    }
    
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
    
    const trendAlignment = (
      (dev8EMA > 0 ? 1 : -1) + 
      (dev21EMA > 0 ? 1 : -1) + 
      (dev50SMA > 0 ? 1 : -1)
    ) / 3;
    
    if (Math.abs(trendAlignment) > 0.6) {
      risk += trendAlignment * 0.15;
    }
    
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

// Stock configurations
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
  }
};

// Load existing CSV data for a stock
function loadExistingCSV(symbol) {
  const csvFilePath = path.join('./public/stock-data', `${symbol}.csv`);
  
  if (!fs.existsSync(csvFilePath)) {
    console.log(`❌ CSV file not found for ${symbol}. Will generate it.`);
    return null;
  }
  
  const csvText = fs.readFileSync(csvFilePath, 'utf8');
  const lines = csvText.split('\n').filter(line => line.trim());
  const dataLines = lines.slice(1); // Skip header
  
  const existingData = dataLines.map(line => {
    const [dateStr, priceStr, timestampStr, ema8Str, ema21Str, sma50Str, sma100Str, sma200Str, sma400Str, riskStr] = line.split(',');
    
    return {
      date: new Date(dateStr),
      price: parseFloat(priceStr),
      timestamp: parseInt(timestampStr),
      ema8: parseFloat(ema8Str),
      ema21: parseFloat(ema21Str),
      sma50: parseFloat(sma50Str),
      sma100: parseFloat(sma100Str),
      sma200: parseFloat(sma200Str),
      sma400: parseFloat(sma400Str),
      risk: parseFloat(riskStr)
    };
  }).filter(item => !isNaN(item.price) && item.price > 0);
  
  return existingData;
}

// Write CSV data
function writeCSV(symbol, data) {
  const csvFilePath = path.join('./public/stock-data', `${symbol}.csv`);
  
  let csvContent = 'date,price,timestamp,ema8,ema21,sma50,sma100,sma200,sma400,risk\n';
  
  data.forEach(item => {
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
  
  fs.writeFileSync(csvFilePath, csvContent);
  
  console.log(`💾 Updated ${csvFilePath}`);
  console.log(`📏 File size: ${(csvContent.length / 1024).toFixed(2)} KB`);
}

async function updateStockCSV(symbol, baseUrl = 'http://localhost:3000') {
  try {
    const stockConfig = STOCK_CONFIGS[symbol];
    if (!stockConfig) {
      throw new Error(`Unknown stock symbol: ${symbol}`);
    }
    
    console.log(`\n🔄 Updating CSV for ${symbol} (${stockConfig.name})...`);
    
    // Load existing CSV data
    const existingData = loadExistingCSV(symbol);
    if (!existingData) {
      // If no CSV exists, generate it
      console.log(`📝 No existing CSV found for ${symbol}, generating full CSV...`);
      return await generateStockCSV(symbol, baseUrl);
    }
    
    console.log(`📂 Loaded ${existingData.length} existing data points`);
    
    // Get the last date in CSV
    const lastDate = new Date(Math.max(...existingData.map(d => d.timestamp)));
    const lastDateStr = lastDate.toISOString().split('T')[0];
    console.log(`📅 Last date in CSV: ${lastDateStr}`);
    
    // Fetch latest data from API
    console.log(`📡 Fetching latest data for ${symbol}...`);
    
    // Calculate how many days to fetch (last 10 trading days to ensure we get latest)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 14); // 2 weeks to ensure we get enough trading days
    
    const params = new URLSearchParams({
      symbol,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    
    const response = await axios.get(`${baseUrl}/api/stock-analysis?${params}`);
    
    if (!response.data || !response.data.data) {
      throw new Error(`No data received for ${symbol}`);
    }
    
    const latestData = response.data.data;
    console.log(`📊 Received ${latestData.length} recent data points`);
    
    // Find new data points
    const newDataPoints = latestData.filter(point => {
      const pointDate = new Date(point.date);
      return pointDate > lastDate;
    });
    
    if (newDataPoints.length === 0) {
      // Check if the latest price has changed for the last date
      const latestPoint = latestData[latestData.length - 1];
      const latestDate = new Date(latestPoint.date);
      const existingLatest = existingData.find(d => 
        Math.abs(d.timestamp - latestDate.getTime()) < 24 * 60 * 60 * 1000
      );
      
      if (existingLatest && Math.abs(existingLatest.price - latestPoint.price) > 0.01) {
        console.log(`🔄 Updating price for ${lastDateStr}: $${existingLatest.price} → $${latestPoint.price}`);
        existingLatest.price = latestPoint.price;
        
        // Recalculate all indicators
        const allPrices = existingData.map(d => d.price);
        const ema8 = calculateEMA(allPrices, 8 * 5);
        const ema21 = calculateEMA(allPrices, 21 * 5);
        const sma50 = calculateSMA(allPrices, 50 * 5);
        const sma100 = calculateSMA(allPrices, 100 * 5);
        const sma200 = calculateSMA(allPrices, 200 * 5);
        const sma400 = calculateSMA(allPrices, 400 * 5);
        
        existingData.forEach((point, index) => {
          point.ema8 = ema8[index];
          point.ema21 = ema21[index];
          point.sma50 = sma50[index];
          point.sma100 = sma100[index];
          point.sma200 = sma200[index];
          point.sma400 = sma400[index];
        });
        
        const updatedData = calculateEMAFocusedRisk(existingData, stockConfig.riskThresholds);
        writeCSV(symbol, updatedData);
        
        return { symbol, success: true, message: 'Updated existing price', dataPoints: updatedData.length };
      } else {
        console.log(`✅ CSV is already up to date`);
        return { symbol, success: true, message: 'Already up to date', dataPoints: existingData.length };
      }
    }
    
    console.log(`📈 Adding ${newDataPoints.length} new data points`);
    
    // Combine existing and new data
    const combinedData = [...existingData];
    
    newDataPoints.forEach(newPoint => {
      combinedData.push({
        date: new Date(newPoint.date),
        price: newPoint.price,
        timestamp: new Date(newPoint.date).getTime(),
        ema8: 0,
        ema21: 0,
        sma50: 0,
        sma100: 0,
        sma200: 0,
        sma400: 0,
        risk: 5
      });
    });
    
    // Sort by date
    combinedData.sort((a, b) => a.timestamp - b.timestamp);
    
    // Recalculate all indicators
    console.log('🔄 Recalculating indicators...');
    const allPrices = combinedData.map(d => d.price);
    const ema8 = calculateEMA(allPrices, 8 * 5);
    const ema21 = calculateEMA(allPrices, 21 * 5);
    const sma50 = calculateSMA(allPrices, 50 * 5);
    const sma100 = calculateSMA(allPrices, 100 * 5);
    const sma200 = calculateSMA(allPrices, 200 * 5);
    const sma400 = calculateSMA(allPrices, 400 * 5);
    
    combinedData.forEach((point, index) => {
      point.ema8 = ema8[index];
      point.ema21 = ema21[index];
      point.sma50 = sma50[index];
      point.sma100 = sma100[index];
      point.sma200 = sma200[index];
      point.sma400 = sma400[index];
    });
    
    // Recalculate risk
    console.log('🎯 Recalculating risk levels...');
    const finalData = calculateEMAFocusedRisk(combinedData, stockConfig.riskThresholds);
    
    // Write updated CSV
    writeCSV(symbol, finalData);
    
    return { symbol, success: true, message: `Added ${newDataPoints.length} new points`, dataPoints: finalData.length };
    
  } catch (error) {
    console.error(`❌ Error updating CSV for ${symbol}:`, error.message);
    return { symbol, success: false, error: error.message };
  }
}

async function updateAllCSVs() {
  console.log('🚀 Updating CSV files for all configured stocks...\n');
  
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
    const result = await updateStockCSV(symbol, baseUrl);
    results.push(result);
    
    // Add a small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n📊 Summary:');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successfully updated: ${successful.length} stocks`);
  successful.forEach(r => console.log(`   - ${r.symbol}: ${r.message} (${r.dataPoints} total points)`));
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length} stocks`);
    failed.forEach(r => console.log(`   - ${r.symbol}: ${r.error}`));
  }
  
  // Update NVDA CSV in root for backward compatibility
  if (STOCK_CONFIGS.NVDA && successful.find(r => r.symbol === 'NVDA')) {
    const nvdaSource = path.join(stockDataDir, 'NVDA.csv');
    const nvdaDest = './public/nvda-historical-data.csv';
    if (fs.existsSync(nvdaSource)) {
      fs.copyFileSync(nvdaSource, nvdaDest);
      console.log('\n📋 Copied NVDA.csv to nvda-historical-data.csv for backward compatibility');
    }
  }
  
  console.log('\n🎉 CSV update complete!');
  
  const currentTime = new Date().toISOString();
  console.log(`⏰ Update completed at: ${currentTime}`);
  
  if (failed.length > 0) {
    process.exit(1);
  }
}

// Check if this is being run directly
if (require.main === module) {
  updateAllCSVs().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { updateAllCSVs, updateStockCSV }; 