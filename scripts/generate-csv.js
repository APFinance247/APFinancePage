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

async function generateCSV() {
  try {
    console.log('🚀 Generating NVDA historical data CSV with pre-calculated risk levels...');
    
    // Try Yahoo Finance API first
    console.log('📡 Fetching from Yahoo Finance API...');
    let response;
    try {
      response = await axios.get('http://localhost:3000/api/nvda-data-yahoo');
    } catch (error) {
      console.log('❌ Yahoo Finance failed, trying Finnhub...');
      response = await axios.get('http://localhost:3000/api/nvda-data');
    }
    
    if (!response.data || !response.data.data) {
      throw new Error('Invalid response structure');
    }
    
    const data = response.data.data;
    console.log(`📊 Received ${data.length} data points from ${response.data.source || 'API'}`);
    
    // Sort by date to ensure proper order
    const sortedData = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const prices = sortedData.map(d => d.price);
    
    console.log('🔄 Calculating EMAs and SMAs...');
    
    // Calculate moving averages (same as in component)
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
    
    console.log('🎯 Calculating risk levels...');
    
    // Calculate risk levels
    const dataWithRisk = calculateEMAFocusedRisk(processedData);
    
    // Create CSV content with all calculated values
    let csvContent = 'date,price,timestamp,ema8,ema21,sma50,sma100,sma200,sma400,risk\n';
    
    dataWithRisk.forEach(item => {
      const date = item.date;
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
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
    const csvFilePath = './public/nvda-historical-data.csv';
    fs.writeFileSync(csvFilePath, csvContent);
    
    console.log(`✅ Successfully generated optimized CSV file: ${csvFilePath}`);
    console.log(`📈 Data range: ${dataWithRisk[0].date.toISOString().split('T')[0]} to ${dataWithRisk[dataWithRisk.length - 1].date.toISOString().split('T')[0]}`);
    console.log(`💾 File size: ${(csvContent.length / 1024).toFixed(2)} KB`);
    
    // Calculate risk statistics for verification
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
    
    console.log('📊 Risk Distribution:');
    console.log(`   Low Risk (1-3): ${riskStats.distribution.risk1to3} points`);
    console.log(`   Moderate Risk (4-6): ${riskStats.distribution.risk4to6} points`);
    console.log(`   High Risk (7-8): ${riskStats.distribution.risk7to8} points`);
    console.log(`   Very High Risk (9-10): ${riskStats.distribution.risk9to10} points`);
    console.log(`   Average Risk: ${riskStats.avg.toFixed(2)}`);
    
    // Verification
    const lines = csvContent.split('\n').filter(line => line.trim());
    console.log(`🔍 Verification: ${lines.length - 1} data rows (excluding header)`);
    
    console.log('\n🎉 Optimized CSV generation complete!');
    console.log('📝 Benefits:');
    console.log('1. Pre-calculated EMAs, SMAs, and risk levels');
    console.log('2. No need to recalculate historical data every time');
    console.log('3. Only calculate risk for new data points');
    console.log('4. Massive performance improvement');
    
  } catch (error) {
    console.error('❌ Error generating CSV:', error.message);
    console.log('💡 Make sure your Next.js app is running on localhost:3000');
    console.log('💡 Run: npm run dev');
    process.exit(1);
  }
}

// Check if this is being run directly
if (require.main === module) {
  generateCSV();
}

module.exports = { generateCSV }; 