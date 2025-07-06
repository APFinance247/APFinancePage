/**
 * Generate historical CSV data for any stock symbol
 * Usage: npm run generate-stock-csv -- --symbol=MSFT
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Get command line arguments
const args = process.argv.slice(2);
const symbolArg = args.find(arg => arg.startsWith('--symbol='));
const symbol = symbolArg ? symbolArg.split('=')[1].toUpperCase() : 'NVDA';

console.log(`🚀 Generating historical data CSV for ${symbol}...`);

// Import the stock analysis service
async function importESModules() {
  const { StockAnalysisService } = await import('../src/lib/stock-analysis-service.js');
  const { STOCK_CONFIGS } = await import('../src/types/stock-analysis.js');
  
  return { StockAnalysisService, STOCK_CONFIGS };
}

async function generateCSV() {
  try {
    // Dynamic imports for ES modules
    const { StockAnalysisService, STOCK_CONFIGS } = await importESModules();
    const stockAnalysisService = new StockAnalysisService();
    
    console.log(`📡 Fetching data for ${symbol}...`);
    
    // Get stock configuration
    const stockConfig = STOCK_CONFIGS[symbol] || {
      symbol,
      name: symbol,
      riskConfig: { algorithm: 'ema-focused' }
    };
    
    // Analyze the stock
    const result = await stockAnalysisService.analyzeStock(symbol);
    
    console.log(`📊 Received ${result.data.length} data points from ${result.source}`);
    
    // Sort by date
    const sortedData = result.data.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Generate CSV content
    const header = 'Date,Price,Timestamp,8-Week EMA,21-Week EMA,50-Week SMA,100-Week SMA,200-Week SMA,400-Week SMA,Risk\n';
    
    const csvContent = header + sortedData.map(point => {
      const dateStr = point.date.toISOString().split('T')[0];
      return [
        dateStr,
        point.price.toFixed(2),
        point.timestamp,
        point.ema8.toFixed(2),
        point.ema21.toFixed(2),
        point.sma50.toFixed(2),
        point.sma100.toFixed(2),
        point.sma200.toFixed(2),
        point.sma400.toFixed(2),
        point.risk.toFixed(2)
      ].join(',');
    }).join('\n');
    
    // Write to file
    const filename = `${symbol.toLowerCase()}-historical-data.csv`;
    const filepath = path.join(__dirname, '..', 'public', filename);
    fs.writeFileSync(filepath, csvContent);
    
    console.log(`✅ Successfully generated ${filename}`);
    console.log(`📁 File location: ${filepath}`);
    console.log(`📈 Data points: ${sortedData.length}`);
    console.log(`📅 Date range: ${sortedData[0].date.toISOString().split('T')[0]} to ${sortedData[sortedData.length - 1].date.toISOString().split('T')[0]}`);
    
    // Calculate and display risk statistics
    const risks = sortedData.map(d => d.risk);
    const riskStats = {
      min: Math.min(...risks).toFixed(2),
      max: Math.max(...risks).toFixed(2),
      avg: (risks.reduce((a, b) => a + b, 0) / risks.length).toFixed(2),
      distribution: {
        low: risks.filter(r => r <= 3).length,
        moderate: risks.filter(r => r > 3 && r <= 6).length,
        high: risks.filter(r => r > 6 && r <= 8).length,
        extreme: risks.filter(r => r > 8).length,
      }
    };
    
    console.log('\n📊 Risk Statistics:');
    console.log(`  Min: ${riskStats.min}, Max: ${riskStats.max}, Avg: ${riskStats.avg}`);
    console.log(`  Distribution:`);
    console.log(`    Low (1-3): ${riskStats.distribution.low} (${(riskStats.distribution.low / risks.length * 100).toFixed(1)}%)`);
    console.log(`    Moderate (4-6): ${riskStats.distribution.moderate} (${(riskStats.distribution.moderate / risks.length * 100).toFixed(1)}%)`);
    console.log(`    High (7-8): ${riskStats.distribution.high} (${(riskStats.distribution.high / risks.length * 100).toFixed(1)}%)`);
    console.log(`    Extreme (9-10): ${riskStats.distribution.extreme} (${(riskStats.distribution.extreme / risks.length * 100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('❌ Error generating CSV:', error);
    process.exit(1);
  }
}

// Run with proper module resolution
if (require.main === module) {
  generateCSV().catch(console.error);
} 