const fs = require('fs');
const axios = require('axios');

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
function calculateEMAFocusedRisk(dataPoints) {
  const currentDate = new Date();
  
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
    if (dev8EMA >= 0.15) {
      if (dev8EMA >= 0.30) {
        risk = 9.5;
      } else if (dev8EMA >= 0.22) {
        risk = 9.0;
      } else if (dev8EMA >= 0.18) {
        risk = 8.5;
      } else {
        risk = 8.0;
      }
    } else if (dev8EMA >= 0.08) {
      if (dev8EMA >= 0.12) {
        risk = 7.5 + (dev8EMA - 0.12) / 0.03 * 0.5;
      } else {
        risk = 6.5 + (dev8EMA - 0.08) / 0.04 * 1.0;
      }
    } else if (dev8EMA >= -0.05) {
      risk = 5.0 + (dev8EMA + 0.05) / 0.13 * 1.5;
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

// Load existing CSV data
function loadExistingCSV() {
  const csvFilePath = './public/nvda-historical-data.csv';
  
  if (!fs.existsSync(csvFilePath)) {
    console.log('❌ CSV file not found. Run npm run generate-csv first.');
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

async function updateCSVIncremental() {
  try {
    console.log('🔄 Incrementally updating NVDA CSV with latest data...');
    
    // Load existing CSV data
    const existingData = loadExistingCSV();
    if (!existingData) {
      console.log('💡 Run "npm run generate-csv" first to create the initial CSV file.');
      return;
    }
    
    console.log(`📂 Loaded ${existingData.length} existing data points from CSV`);
    
    // Get the last date in CSV
    const lastDate = new Date(Math.max(...existingData.map(d => d.timestamp)));
    const lastDateStr = lastDate.toISOString().split('T')[0];
    console.log(`📅 Last date in CSV: ${lastDateStr}`);
    
    // Fetch latest data from API
    console.log('📡 Fetching latest data from API...');
    let response;
    try {
      response = await axios.get('http://localhost:3000/api/nvda-latest');
    } catch (error) {
      console.log('❌ Latest API failed, trying full Yahoo Finance...');
      response = await axios.get('http://localhost:3000/api/nvda-data-yahoo');
    }
    
    if (!response.data) {
      throw new Error('No data received from API');
    }
    
    let latestPrice, latestDate, latestTimestamp;
    
    if (response.data.currentPrice) {
      // Latest API format
      latestPrice = response.data.currentPrice;
      latestDate = new Date(response.data.dataDate);
      latestTimestamp = latestDate.getTime();
    } else if (response.data.data) {
      // Full API format - get the latest point
      const data = response.data.data;
      const latest = data[data.length - 1];
      latestPrice = latest.price;
      latestDate = new Date(latest.date);
      latestTimestamp = latestDate.getTime();
    }
    
    // Check if we already have this date
    const latestDateStr = latestDate.toISOString().split('T')[0];
    const existingLatest = existingData.find(d => 
      Math.abs(d.timestamp - latestTimestamp) < 24 * 60 * 60 * 1000
    );
    
    if (existingLatest) {
      // Update existing record if price changed
      if (Math.abs(existingLatest.price - latestPrice) > 0.01) {
        console.log(`🔄 Updating existing record for ${latestDateStr}: $${existingLatest.price} → $${latestPrice}`);
        
        // Update the price and recalculate
        existingLatest.price = latestPrice;
        
        // Recalculate EMAs/SMAs for the entire dataset with updated price
        const allPrices = existingData.map(d => d.price);
        const ema8 = calculateEMA(allPrices, 8 * 5);
        const ema21 = calculateEMA(allPrices, 21 * 5);
        const sma50 = calculateSMA(allPrices, 50 * 5);
        const sma100 = calculateSMA(allPrices, 100 * 5);
        const sma200 = calculateSMA(allPrices, 200 * 5);
        const sma400 = calculateSMA(allPrices, 400 * 5);
        
        // Update EMAs/SMAs for all data points
        existingData.forEach((point, index) => {
          point.ema8 = ema8[index];
          point.ema21 = ema21[index];
          point.sma50 = sma50[index];
          point.sma100 = sma100[index];
          point.sma200 = sma200[index];
          point.sma400 = sma400[index];
        });
        
        // Recalculate risk for all data points
        const updatedData = calculateEMAFocusedRisk(existingData);
        
        // Write updated CSV
        writeCSV(updatedData);
        
        console.log(`✅ Updated CSV with latest price for ${latestDateStr}`);
      } else {
        console.log(`✅ CSV is already up to date (${latestDateStr}: $${latestPrice})`);
      }
      return;
    }
    
    // Add new data point
    console.log(`📈 Adding new data point: ${latestDateStr} - $${latestPrice}`);
    
    // Add the new point to existing data
    const newDataPoint = {
      date: latestDate,
      price: latestPrice,
      timestamp: latestTimestamp,
      ema8: 0, // Will be calculated
      ema21: 0,
      sma50: 0,
      sma100: 0,
      sma200: 0,
      sma400: 0,
      risk: 5 // Will be calculated
    };
    
    const combinedData = [...existingData, newDataPoint].sort((a, b) => a.timestamp - b.timestamp);
    
    // Recalculate EMAs/SMAs for the entire dataset (needed for accuracy)
    console.log('🔄 Recalculating EMAs/SMAs with new data point...');
    const allPrices = combinedData.map(d => d.price);
    const ema8 = calculateEMA(allPrices, 8 * 5);
    const ema21 = calculateEMA(allPrices, 21 * 5);
    const sma50 = calculateSMA(allPrices, 50 * 5);
    const sma100 = calculateSMA(allPrices, 100 * 5);
    const sma200 = calculateSMA(allPrices, 200 * 5);
    const sma400 = calculateSMA(allPrices, 400 * 5);
    
    // Update EMAs/SMAs for all data points
    combinedData.forEach((point, index) => {
      point.ema8 = ema8[index];
      point.ema21 = ema21[index];
      point.sma50 = sma50[index];
      point.sma100 = sma100[index];
      point.sma200 = sma200[index];
      point.sma400 = sma400[index];
    });
    
    // Recalculate risk for all data points
    console.log('🎯 Recalculating risk levels...');
    const finalData = calculateEMAFocusedRisk(combinedData);
    
    // Write updated CSV
    writeCSV(finalData);
    
    console.log(`✅ Successfully added new data point: ${latestDateStr} - $${latestPrice}`);
    console.log(`📊 Total data points: ${finalData.length}`);
    
  } catch (error) {
    console.error('❌ Error updating CSV:', error.message);
    console.log('💡 Make sure your Next.js app is running on localhost:3000');
    console.log('💡 Run: npm run dev');
    process.exit(1);
  }
}

function writeCSV(data) {
  const csvFilePath = './public/nvda-historical-data.csv';
  
  // Create CSV content
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
  
  // Write to file
  fs.writeFileSync(csvFilePath, csvContent);
  
  console.log(`💾 Updated CSV file: ${csvFilePath}`);
  console.log(`📏 File size: ${(csvContent.length / 1024).toFixed(2)} KB`);
}

// Check if this is being run directly
if (require.main === module) {
  updateCSVIncremental();
}

module.exports = { updateCSVIncremental }; 