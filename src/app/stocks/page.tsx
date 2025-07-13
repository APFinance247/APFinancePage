'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { STOCK_CONFIGS } from '@/types/stock-analysis';
import { getRiskColor, getRiskDescription } from '@/lib/risk-analysis/risk-calculator';

interface StockData {
  symbol: string;
  name: string;
  currentPrice: number;
  currentRisk: number;
  loading: boolean;
  error?: string;
}

export default function AllStocksPage() {
  const [stocksData, setStocksData] = useState<Record<string, StockData>>({});
  const [overallLoading, setOverallLoading] = useState(true);

  useEffect(() => {
    const fetchAllStockData = async () => {
      const initialData: Record<string, StockData> = {};
      
      // Initialize all stocks with loading state
      Object.entries(STOCK_CONFIGS).forEach(([symbol, config]) => {
        initialData[symbol] = {
          symbol,
          name: config.name,
          currentPrice: 0,
          currentRisk: 5,
          loading: true
        };
      });
      
      setStocksData(initialData);

      // Fetch data for each stock
      const promises = Object.keys(STOCK_CONFIGS).map(async (symbol) => {
        try {
          const response = await fetch(`/api/stock-analysis?symbol=${symbol}`);
          if (response.ok) {
            const data = await response.json();
            return {
              symbol,
              name: STOCK_CONFIGS[symbol].name,
              currentPrice: data.currentPrice,
              currentRisk: data.currentRisk,
              loading: false
            };
          } else {
            throw new Error(`Failed to fetch ${symbol}`);
          }
        } catch (error) {
          console.error(`Error fetching ${symbol}:`, error);
          return {
            symbol,
            name: STOCK_CONFIGS[symbol].name,
            currentPrice: 0,
            currentRisk: 5,
            loading: false,
            error: 'Failed to load'
          };
        }
      });

      // Update stocks as data comes in
      Promise.allSettled(promises).then((results) => {
        const updatedData: Record<string, StockData> = {};
        
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            const stockData = result.value;
            updatedData[stockData.symbol] = stockData;
          }
        });
        
        setStocksData(updatedData);
        setOverallLoading(false);
      });
    };

    fetchAllStockData();
  }, []);

  const StockCard = ({ stockData }: { stockData: StockData }) => {
    const { symbol, name, currentPrice, currentRisk, loading, error } = stockData;
    const riskInfo = getRiskDescription(currentRisk);
    const riskColor = getRiskColor(currentRisk);
    
    const href = symbol === 'NVDA' ? '/' : `/stocks/${symbol.toLowerCase()}`;

    return (
      <Link
        href={href}
        className="group block bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl border border-gray-700 hover:border-gray-600"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: riskColor }}
                title={`Risk Level: ${currentRisk.toFixed(1)}`}
              />
              <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                {symbol}
              </h3>
            </div>
            {!loading && !error && (
              <div className="text-right">
                <div 
                  className="text-sm font-semibold"
                  style={{ color: riskColor }}
                >
                  {currentRisk.toFixed(1)}
                </div>
                <div className="text-xs text-gray-400">Risk</div>
              </div>
            )}
          </div>

          {/* Company Name */}
          <h4 className="text-sm text-gray-300 mb-3 line-clamp-2 flex-grow">
            {name}
          </h4>

          {/* Price and Risk Info */}
          {loading ? (
            <div className="space-y-2">
              <div className="h-4 bg-gray-700 rounded animate-pulse"></div>
              <div className="h-3 bg-gray-700 rounded animate-pulse w-3/4"></div>
            </div>
          ) : error ? (
            <div className="text-red-400 text-sm">
              {error}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Price:</span>
                <span className="text-white font-semibold">
                  ${currentPrice.toLocaleString(undefined, { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Risk Level:</span>
                <span 
                  className="text-sm font-semibold"
                  style={{ color: riskColor }}
                >
                  {riskInfo.level}
                </span>
              </div>
            </div>
          )}

          {/* Hover indicator */}
          <div className="mt-4 flex items-center text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-sm">View Chart</span>
            <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Stock Risk Analysis
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto">
            Explore risk analysis charts for our complete selection of stocks and cryptocurrencies. 
            Each asset is analyzed using advanced risk algorithms to help guide your investment decisions.
          </p>
        </div>

        {/* Stats Summary */}
        {!overallLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-4 text-center border border-gray-700">
              <div className="text-2xl font-bold text-white mb-1">
                {Object.keys(stocksData).length}
              </div>
              <div className="text-gray-400 text-sm">Assets Tracked</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center border border-gray-700">
              <div className="text-2xl font-bold text-green-400 mb-1">
                {Object.values(stocksData).filter(stock => !stock.loading && stock.currentRisk <= 3).length}
              </div>
              <div className="text-gray-400 text-sm">Low Risk</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center border border-gray-700">
              <div className="text-2xl font-bold text-yellow-400 mb-1">
                {Object.values(stocksData).filter(stock => !stock.loading && stock.currentRisk > 3 && stock.currentRisk <= 7).length}
              </div>
              <div className="text-gray-400 text-sm">Moderate Risk</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center border border-gray-700">
              <div className="text-2xl font-bold text-red-400 mb-1">
                {Object.values(stocksData).filter(stock => !stock.loading && stock.currentRisk > 7).length}
              </div>
              <div className="text-gray-400 text-sm">High Risk</div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {overallLoading && (
          <div className="text-center py-12">
            <div className="text-white text-xl mb-4">Loading stock data...</div>
            <div className="text-gray-400">Fetching current risk levels and prices</div>
          </div>
        )}

        {/* Stock Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Object.values(stocksData).map((stockData) => (
            <StockCard key={stockData.symbol} stockData={stockData} />
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-3">About Risk Levels</h3>
            <div className="text-gray-400 text-sm max-w-4xl mx-auto">
              <p className="mb-2">
                Our risk analysis uses advanced algorithms that consider multiple factors including price position relative to key moving averages, 
                historical volatility, and market conditions to generate risk scores from 1-10.
              </p>
              <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getRiskColor(2) }}></div>
                  Low Risk (1-3): Potential Value Opportunity
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getRiskColor(5) }}></div>
                  Moderate Risk (4-6): Fair Value Range
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getRiskColor(8) }}></div>
                  High Risk (7-10): Elevated Valuations
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 