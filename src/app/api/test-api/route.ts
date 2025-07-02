import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.FINNHUB_API_KEY || 'c58gpgaad3ifmjb47cl0';
    
    // Test with a simple quote endpoint first
    const response = await axios.get(
      `https://finnhub.io/api/v1/quote?symbol=NVDA&token=${apiKey}`
    );
    
    console.log('Finnhub API Response:', response.data);
    
    return NextResponse.json({
      success: true,
      data: response.data,
      message: 'Finnhub API is working!'
    });
    
  } catch (error: any) {
    console.error('Finnhub API Error:', error.response?.data || error.message);
    
    return NextResponse.json({
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500,
      message: 'Finnhub API test failed'
    }, { status: 500 });
  }
} 