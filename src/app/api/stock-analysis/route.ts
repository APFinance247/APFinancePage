import { NextRequest, NextResponse } from 'next/server';
import { stockAnalysisService } from '@/lib/stock-analysis-service';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }
    
    // Parse dates if provided
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    
    // Analyze the stock
    const result = await stockAnalysisService.analyzeStock(
      symbol.toUpperCase(),
      startDate,
      endDate
    );
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error in stock analysis API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze stock', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 