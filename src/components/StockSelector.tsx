'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { STOCK_CONFIGS } from '@/types/stock-analysis';
import { getRiskColor } from '@/lib/risk-analysis/risk-calculator';

interface StockRiskData {
  symbol: string;
  currentRisk: number;
  currentPrice: number;
}

export default function StockSelector() {
  const pathname = usePathname();
  const [stockRisks, setStockRisks] = useState<Record<string, StockRiskData>>({});
  const [loading, setLoading] = useState(true);
  
  // Determine the active symbol from the pathname
  let activeSymbol = 'NVDA'; // Default for home page
  if (pathname.startsWith('/stocks/')) {
    activeSymbol = pathname.split('/')[2]?.toUpperCase() || 'NVDA';
  }

  // Fetch current risk data for all stocks
  useEffect(() => {
    const fetchStockRisks = async () => {
      try {
        const risks: Record<string, StockRiskData> = {};
        
        // Fetch risk data for each stock
        const promises = Object.keys(STOCK_CONFIGS).map(async (symbol) => {
          try {
            const response = await fetch(`/api/stock-analysis?symbol=${symbol}`);
            if (response.ok) {
              const data = await response.json();
              risks[symbol] = {
                symbol,
                currentRisk: data.currentRisk,
                currentPrice: data.currentPrice
              };
            }
          } catch (error) {
            console.error(`Error fetching risk for ${symbol}:`, error);
            // Set default risk if fetch fails
            risks[symbol] = {
              symbol,
              currentRisk: 5,
              currentPrice: 0
            };
          }
        });
        
        await Promise.all(promises);
        setStockRisks(risks);
      } catch (error) {
        console.error('Error fetching stock risks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStockRisks();
  }, []);

  const getRiskButtonStyle = (symbol: string, isActive: boolean) => {
    const riskData = stockRisks[symbol];
    if (!riskData || loading) {
      // Default style while loading
      return isActive
        ? 'bg-blue-600 text-white'
        : 'bg-gray-700 text-gray-300 hover:bg-gray-600';
    }

    const riskColor = getRiskColor(riskData.currentRisk);
    
    if (isActive) {
      return `text-white font-semibold border-2 border-white shadow-lg`;
    } else {
      return `text-white hover:opacity-80 border border-gray-500`;
    }
  };

  const getRiskBackgroundColor = (symbol: string) => {
    const riskData = stockRisks[symbol];
    if (!riskData || loading) {
      return '#374151'; // Default gray
    }
    return getRiskColor(riskData.currentRisk);
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <h2 className="text-white font-semibold text-sm sm:text-base">Select Stock:</h2>
          <div className="flex gap-1 sm:gap-2 flex-wrap w-full sm:w-auto justify-start sm:justify-end">
            {Object.keys(STOCK_CONFIGS).map((symbol) => {
              const isActive = symbol === activeSymbol;
              const riskData = stockRisks[symbol];
              
              return (
                <Link
                  key={symbol}
                  href={symbol === 'NVDA' ? '/' : `/stocks/${symbol.toLowerCase()}`}
                  className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-all duration-200 w-16 sm:w-20 text-center ${getRiskButtonStyle(symbol, isActive)}`}
                  style={{ backgroundColor: getRiskBackgroundColor(symbol) }}
                  title={riskData ? `Risk: ${riskData.currentRisk.toFixed(1)}` : 'Loading...'}
                >
                  <span className="block sm:inline">{symbol}</span>
                  {riskData && !loading && (
                    <span className="ml-0 sm:ml-1 text-xs opacity-75 block sm:inline">
                      {riskData.currentRisk.toFixed(1)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
} 