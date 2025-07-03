const fs = require('fs');
const axios = require('axios');

async function generateCSV() {
  try {
    console.log('🚀 Generating initial NVDA historical data CSV...');
    
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
    
    // Create CSV content
    let csvContent = 'date,price,timestamp\n';
    
    data.forEach(item => {
      const date = new Date(item.date);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      const timestamp = date.getTime();
      const price = item.price;
      
      csvContent += `${dateStr},${price},${timestamp}\n`;
    });
    
    // Write to CSV file
    const csvFilePath = './public/nvda-historical-data.csv';
    fs.writeFileSync(csvFilePath, csvContent);
    
    console.log(`✅ Successfully generated CSV file: ${csvFilePath}`);
    console.log(`📈 Data range: ${data[0].date} to ${data[data.length - 1].date}`);
    console.log(`💾 File size: ${(csvContent.length / 1024).toFixed(2)} KB`);
    
    // Verification
    const lines = csvContent.split('\n').filter(line => line.trim());
    console.log(`🔍 Verification: ${lines.length - 1} data rows (excluding header)`);
    
    console.log('\n🎉 CSV generation complete!');
    console.log('📝 Next steps:');
    console.log('1. The CSV file is now available at /public/nvda-historical-data.csv');
    console.log('2. The app will now load historical data from CSV and fetch only latest data via API');
    console.log('3. This reduces API calls from ~6000+ to just 1 per day');
    console.log('4. Update the CSV periodically by running this script again');
    
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