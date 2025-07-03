import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
  try {
    console.log('📡 API: Triggering incremental CSV update...');
    
    // Run the incremental update script
    const { stdout, stderr } = await execAsync('npm run update-csv-daily');
    
    if (stderr && !stderr.includes('npm WARN')) {
      console.error('Script error:', stderr);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Script execution failed',
          details: stderr 
        },
        { status: 500 }
      );
    }
    
    console.log('✅ API: CSV update completed');
    console.log('Output:', stdout);
    
    // Parse the output to extract useful information
    const isUpToDate = stdout.includes('CSV is already up to date');
    const addedNewPoint = stdout.includes('Successfully added new data point');
    const updatedExisting = stdout.includes('Updated CSV with latest price');
    
    let status = 'unknown';
    let message = '';
    
    if (isUpToDate) {
      status = 'up-to-date';
      message = 'CSV is already current with the latest data';
    } else if (addedNewPoint) {
      status = 'added-new';
      message = 'Successfully added new data point to CSV';
    } else if (updatedExisting) {
      status = 'updated-existing';
      message = 'Updated existing data point with latest price';
    }
    
    return NextResponse.json({
      success: true,
      status,
      message,
      timestamp: new Date().toISOString(),
      output: stdout
    });
    
  } catch (error) {
    console.error('❌ API: CSV update failed:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update CSV',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'CSV Update API',
    description: 'Use POST to trigger an incremental CSV update',
    usage: 'POST /api/update-csv',
    timestamp: new Date().toISOString()
  });
} 