'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { STOCK_CONFIGS } from '@/types/stock-analysis';

export default function StockSelector() {
  const pathname = usePathname();
  
  // Determine the active symbol from the pathname
  let activeSymbol = 'NVDA'; // Default for home page
  if (pathname.startsWith('/stocks/')) {
    activeSymbol = pathname.split('/')[2]?.toUpperCase() || 'NVDA';
  }

  return (
    <div className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold">Select Stock:</h2>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(STOCK_CONFIGS).map((symbol) => (
              <Link
                key={symbol}
                href={symbol === 'NVDA' ? '/' : `/stocks/${symbol.toLowerCase()}`}
                className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                  symbol === activeSymbol
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {symbol}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 