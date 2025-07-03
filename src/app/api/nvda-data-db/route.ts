import { NextResponse } from 'next/server';
// Example using Vercel Postgres - you can adapt for other databases
// npm install @vercel/postgres

/*
// Uncomment and configure for your database
import { sql } from '@vercel/postgres';

interface DataPoint {
  date: Date;
  price: number;
  ema8: number;
  ema21: number;
  sma50: number;
  sma100: number;
  sma200: number;
  sma400: number;
  risk: number;
  timestamp: number;
}

export async function GET() {
  try {
    // Fetch all historical data from database
    const result = await sql`
      SELECT date, price, ema8, ema21, sma50, sma100, sma200, sma400, risk, timestamp
      FROM nvda_data 
      ORDER BY timestamp ASC
    `;
    
    const data: DataPoint[] = result.rows.map(row => ({
      date: new Date(row.date),
      price: row.price,
      ema8: row.ema8,
      ema21: row.ema21,
      sma50: row.sma50,
      sma100: row.sma100,
      sma200: row.sma200,
      sma400: row.sma400,
      risk: row.risk,
      timestamp: row.timestamp
    }));
    
    const currentPrice = data.length > 0 ? data[data.length - 1].price : 0;
    const currentRisk = data.length > 0 ? data[data.length - 1].risk : 5;
    
    // Calculate risk statistics
    const risks = data.map(d => d.risk);
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
    
    return NextResponse.json({
      data,
      currentPrice,
      currentRisk,
      source: 'Vercel Database',
      riskStats
    });
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from database' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Update database with latest data
    // This endpoint would be called by Vercel Cron
    
    // 1. Fetch latest data from external API
    const response = await fetch('https://external-api.com/nvda-latest');
    const latestData = await response.json();
    
    // 2. Check if data already exists
    const existing = await sql`
      SELECT * FROM nvda_data 
      WHERE date = ${latestData.date}
    `;
    
    if (existing.rows.length > 0) {
      // Update existing record
      await sql`
        UPDATE nvda_data 
        SET price = ${latestData.price},
            ema8 = ${latestData.ema8},
            ema21 = ${latestData.ema21},
            sma50 = ${latestData.sma50},
            sma100 = ${latestData.sma100},
            sma200 = ${latestData.sma200},
            sma400 = ${latestData.sma400},
            risk = ${latestData.risk}
        WHERE date = ${latestData.date}
      `;
    } else {
      // Insert new record
      await sql`
        INSERT INTO nvda_data (date, price, ema8, ema21, sma50, sma100, sma200, sma400, risk, timestamp)
        VALUES (${latestData.date}, ${latestData.price}, ${latestData.ema8}, ${latestData.ema21}, 
                ${latestData.sma50}, ${latestData.sma100}, ${latestData.sma200}, ${latestData.sma400}, 
                ${latestData.risk}, ${latestData.timestamp})
      `;
    }
    
    return NextResponse.json({
      success: true,
      message: 'Database updated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Database update error:', error);
    return NextResponse.json(
      { error: 'Failed to update database' },
      { status: 500 }
    );
  }
}
*/

// Placeholder response - replace with actual database implementation
export async function GET() {
  return NextResponse.json({
    message: 'Database-based NVDA Data API',
    description: 'This endpoint would serve data from a database instead of CSV',
    setup: [
      '1. Set up Vercel Postgres or your preferred database',
      '2. Create nvda_data table with appropriate schema',
      '3. Migrate existing CSV data to database',
      '4. Update component to use this API endpoint',
      '5. Set up Vercel Cron to call POST endpoint daily'
    ],
    benefits: [
      'Works with Vercel serverless functions',
      'Scalable and performant',
      'No file system limitations',
      'Built-in backup and replication'
    ]
  });
} 