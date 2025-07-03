import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(_request: NextRequest) {
  try {
    console.log('Test API endpoint hit');
    
    // Test if environment variables are accessible
    const hasApiKey = process.env.FINNHUB_API_KEY ? 'Yes' : 'No';
    
    // Test basic fetch capability
    const testResponse = await fetch('https://httpbin.org/json');
    
    if (!testResponse.ok) {
      throw new Error(`HTTP error! status: ${testResponse.status}`);
    }
    
    const testData: { slideshow?: { title?: string } } = await testResponse.json();
    
    return NextResponse.json({
      success: true,
      message: 'API is working',
      environment: {
        hasApiKey,
        nodeEnv: process.env.NODE_ENV,
      },
      testFetch: testData?.slideshow?.title || 'Test completed'
    });
    
  } catch (error: unknown) {
    console.error('Test API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Test API failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 