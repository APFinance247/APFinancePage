'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale,
  LogarithmicScale,
  ChartOptions,
} from 'chart.js';
import { StockDataPoint, RiskStats, StockAnalysisResponse } from '@/types/stock-analysis';
import { StockAnalysisService, stockAnalysisService } from '@/lib/stock-analysis-service';

// Dynamic import for components that need window
const Scatter = dynamic(() => import('react-chartjs-2').then((mod) => mod.Scatter), {
  ssr: false,
});

// Chart.js registration state
let chartJsInitialized = false;

interface StockRiskChartProps {
  symbol: string;
  companyName?: string;
  startDate?: Date;
  endDate?: Date;
  useCSV?: boolean; // For backward compatibility with NVDA CSV
}

// Time range interface
interface TimeRange {
  label: string;
  startYear: number;
  endYear?: number;
  description: string;
}

// Mobile detection
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         window.innerWidth <= 768;
};

// Stock Summary Display
const StockSummaryDisplay = ({ 
  currentRisk, 
  currentPrice, 
  symbol, 
  companyName 
}: { 
  currentRisk: number; 
  currentPrice: number; 
  symbol: string;
  companyName?: string;
}) => {
  const riskInfo = StockAnalysisService.getRiskDescription(currentRisk);

  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-4 md:p-6 shadow-2xl border border-gray-600">
      <div className="flex flex-col items-center text-center">
        {/* Top: Stock Info */}
        <div className="mb-4">
          <h2 className="text-xl md:text-3xl font-bold text-white">
            {companyName || symbol}
          </h2>
          <p className="text-lg md:text-xl text-gray-300">
            ${symbol} - ${currentPrice.toFixed(2)}
          </p>
        </div>

        {/* Middle: Risk Details */}
        <div className="flex justify-center items-center gap-8 mb-4 w-full max-w-md">
          {/* Left: Score */}
          <div className="text-center">
            <div 
              className="text-4xl md:text-6xl font-bold"
              style={{ color: riskInfo.color }}
            >
              {currentRisk.toFixed(1)}
            </div>
            <div className="text-sm text-gray-400">Risk Score</div>
          </div>
          {/* Right: Description */}
          <div className="text-center">
            <div 
              className="text-lg md:text-2xl font-bold"
              style={{ color: riskInfo.color }}
            >
              {riskInfo.level}
            </div>
            <div className="text-xs text-gray-300 max-w-xs">
              {riskInfo.description}
            </div>
          </div>
        </div>

        {/* Risk Color Legend Bar */}
        <div className="relative w-full max-w-lg mx-auto">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
          <div className="h-3 md:h-4 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full w-full"
              style={{
                background: `linear-gradient(90deg, 
                  ${StockAnalysisService.getRiskColor(1)}, 
                  ${StockAnalysisService.getRiskColor(3)}, 
                  ${StockAnalysisService.getRiskColor(5)}, 
                  ${StockAnalysisService.getRiskColor(7)}, 
                  ${StockAnalysisService.getRiskColor(10)}
                )`
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Very Low</span>
            <span>Moderate</span>
            <span>Very High</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function StockRiskChart({ 
  symbol, 
  companyName,
  startDate,
  endDate,
  useCSV = false 
}: StockRiskChartProps) {
  const [data, setData] = useState<StockDataPoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [currentRisk, setCurrentRisk] = useState<number>(0);
  const [dataSource, setDataSource] = useState<string>('');
  const [riskStats, setRiskStats] = useState<RiskStats | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLogScale, setIsLogScale] = useState(true);
  const [showMovingAverages, setShowMovingAverages] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('aug2022present');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(startDate || null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(endDate || null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasCustomZoom, setHasCustomZoom] = useState(false);
  const chartRef = useRef<ChartJS<"scatter">>(null);
  const [chartHeight, setChartHeight] = useState(600);
  const [chartReady, setChartReady] = useState(false);

  // Mobile touch selection state
  const [touchSelection, setTouchSelection] = useState<{
    startX: number;
    currentX: number;
    isSelecting: boolean;
    startTime: number;
  } | null>(null);

  // Time range presets
  const timeRanges: TimeRange[] = [
    { label: 'Aug 2022-Present', startYear: 2022, description: 'Recent AI boom cycle (Default)' },
    { label: '2021-Present', startYear: 2021, description: 'Post-COVID cycle' },
    { label: '2020-Present', startYear: 2020, description: 'Recent cycle' },
    { label: '2019-Present', startYear: 2019, description: 'Recent cycle' },
    { label: '2018-Present', startYear: 2018, description: 'Post-crypto boom' },
    { label: '2015-Present', startYear: 2015, description: 'Full modern era' },
    { label: 'All Data', startYear: 1999, description: 'Complete history' },
    { label: 'Custom Range', startYear: 0, description: 'Select your own dates' }
  ];

  // Initialize Chart.js
  useEffect(() => {
    const initializeChart = async () => {
      if (typeof window === 'undefined' || chartJsInitialized) {
        if (chartJsInitialized) setChartReady(true);
        return;
      }

      try {
        ChartJS.register(
          LinearScale,
          LogarithmicScale,
          PointElement,
          LineElement,
          Tooltip,
          Legend,
          TimeScale
        );

        const zoomModule = await import('chartjs-plugin-zoom');
        ChartJS.register(zoomModule.default);

        try {
          await import('chartjs-adapter-date-fns');
        } catch (adapterError) {
          console.warn('Date adapter failed to load, using default:', adapterError);
        }

        chartJsInitialized = true;
        setChartReady(true);
      } catch (error) {
        console.error('Failed to initialize Chart.js:', error);
        setError('Failed to initialize chart components');
      }
    };

    initializeChart();
  }, []);

  // Reset zoom to past 3 years
  const resetZoom = useCallback(() => {
    if (chartRef.current && data.length > 0) {
      setHasCustomZoom(true);
      const chart = chartRef.current;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(endDate.getFullYear() - 3);

      xScale.options.min = startDate.getTime();
      xScale.options.max = endDate.getTime();

      // Explicitly set y-axis range for the visible data
      const visibleData = data.filter(point => 
        point.timestamp >= startDate.getTime() && point.timestamp <= endDate.getTime()
      );

      if (visibleData.length > 0) {
        const visiblePrices = visibleData.map(d => d.price);
        const minPrice = Math.min(...visiblePrices);
        const maxPrice = Math.max(...visiblePrices);
        const priceRange = maxPrice - minPrice;
        const pricePadding = priceRange * 0.1;
        
        yScale.options.min = Math.max(0, minPrice - pricePadding);
        yScale.options.max = maxPrice + pricePadding;
      } else {
        yScale.options.min = undefined;
        yScale.options.max = undefined;
      }
      
      chart.update('none');
    }
  }, [data]);

  // Zoom to all time
  const zoomToAllTime = useCallback(() => {
    if (chartRef.current) {
      setHasCustomZoom(true);
      const chart = chartRef.current;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;

      xScale.options.min = undefined;
      xScale.options.max = undefined;
      yScale.options.min = undefined;
      yScale.options.max = undefined;

      chart.update('none');
    }
  }, []);

  // Custom mobile touch selection handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobileDevice() || !chartRef.current) return;

    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;

    setTouchSelection({
      startX: x,
      currentX: x,
      isSelecting: true,
      startTime: Date.now()
    });

    e.preventDefault();
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobileDevice() || !touchSelection?.isSelecting) return;

    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;

    setTouchSelection(prev => prev ? {
      ...prev,
      currentX: x
    } : null);

    e.preventDefault();
  }, [touchSelection?.isSelecting]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isMobileDevice() || !touchSelection?.isSelecting || !chartRef.current) {
      setTouchSelection(null);
      return;
    }

    const { startX, currentX, startTime } = touchSelection;
    const endTime = Date.now();
    const duration = endTime - startTime;
    const distance = Math.abs(currentX - startX);

    // Check if this was a tap (short duration, small movement) vs drag
    const isTap = duration < 300 && distance < 10;

    if (isTap) {
      setTouchSelection(null);
      return;
    }

    // This was a drag - proceed with selection logic
    const chart = chartRef.current;
    const chartArea = chart.chartArea;

    if (!chartArea) {
      setTouchSelection(null);
      return;
    }

    const minX = Math.min(startX, currentX);
    const maxX = Math.max(startX, currentX);

    if (maxX - minX < 30) {
      setTouchSelection(null);
      return;
    }

    const xScale = chart.scales.x;
    const chartLeftEdge = chartArea.left;
    const chartRightEdge = chartArea.right;
    const chartWidth = chartRightEdge - chartLeftEdge;

    const relativeMinX = Math.max(0, (minX - chartLeftEdge) / chartWidth);
    const relativeMaxX = Math.min(1, (maxX - chartLeftEdge) / chartWidth);

    const dataMin = xScale.min;
    const dataMax = xScale.max;
    const dataRange = dataMax - dataMin;

    const selectedMinTime = dataMin + (relativeMinX * dataRange);
    const selectedMaxTime = dataMin + (relativeMaxX * dataRange);

    xScale.options.min = selectedMinTime;
    xScale.options.max = selectedMaxTime;

    const yScale = chart.scales.y;
    const visibleData = data.filter(point => 
      point.timestamp >= selectedMinTime && point.timestamp <= selectedMaxTime
    );

    if (visibleData.length > 0) {
      const visiblePrices = visibleData.map(d => d.price);
      const minPrice = Math.min(...visiblePrices);
      const maxPrice = Math.max(...visiblePrices);
      const priceRange = maxPrice - minPrice;
      const pricePadding = priceRange * 0.1;
      
      yScale.options.min = Math.max(0, minPrice - pricePadding);
      yScale.options.max = maxPrice + pricePadding;
    }

    chart.update('none');
    setTouchSelection(null);
    setHasCustomZoom(true);

    e.preventDefault();
  }, [touchSelection, data]);

  // Auto-zoom to default view (3 years) on initial load
  useEffect(() => {
    if (data.length > 0 && chartReady && !hasCustomZoom) {
      setHasCustomZoom(true); // Mark that we've set the initial zoom
    }
  }, [data, chartReady, hasCustomZoom]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let result: StockAnalysisResponse;
        
        // Check if we should use CSV (for backward compatibility with NVDA)
        if (useCSV && symbol === 'NVDA') {
          // Try to load from CSV first
          try {
            const response = await fetch('/nvda-historical-data.csv');
            const csvText = await response.text();
            const csvData = stockAnalysisService.processCsvData(csvText);
            
            if (csvData.length > 0) {
              const risks = csvData.map((d: StockDataPoint) => d.risk);
              const riskStats: RiskStats = {
                min: Math.min(...risks),
                max: Math.max(...risks),
                avg: risks.reduce((sum: number, r: number) => sum + r, 0) / risks.length,
                distribution: {
                  risk1to3: risks.filter((r: number) => r >= 1 && r <= 3).length,
                  risk4to6: risks.filter((r: number) => r > 3 && r <= 6).length,
                  risk7to8: risks.filter((r: number) => r > 6 && r <= 8).length,
                  risk9to10: risks.filter((r: number) => r > 8 && r <= 10).length,
                }
              };
              
              result = {
                data: csvData,
                currentPrice: csvData[csvData.length - 1].price,
                currentRisk: csvData[csvData.length - 1].risk,
                source: 'CSV Historical Data',
                riskStats,
                symbol: 'NVDA',
                companyName: 'NVIDIA Corporation'
              };
            } else {
              throw new Error('No CSV data found');
            }
          } catch (csvError) {
            console.log('CSV load failed, falling back to API');
            // Fall back to API
            const response = await fetch(`/api/stock-analysis?symbol=${symbol}`);
            if (!response.ok) throw new Error('API request failed');
            result = await response.json();
          }
        } else {
          // Use the generic API
          const params = new URLSearchParams({ symbol });
          if (customStartDate) params.append('startDate', customStartDate.toISOString());
          if (customEndDate) params.append('endDate', customEndDate.toISOString());
          
          const response = await fetch(`/api/stock-analysis?${params}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch data');
          }
          
          result = await response.json();
        }
        
        setData(result.data);
        setCurrentPrice(result.currentPrice);
        setCurrentRisk(result.currentRisk);
        setDataSource(result.source || 'API');
        setRiskStats(result.riskStats);
        
        console.log(`Loaded ${result.data.length} data points for ${symbol}`);
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred while loading data');
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchData();
    }
  }, [symbol, customStartDate, customEndDate, useCSV]);

  // Chart height
  useEffect(() => {
    const getChartHeight = () => window.innerWidth < 768 ? 500 : 600;
    setChartHeight(getChartHeight());
    
    const handleResize = () => setChartHeight(getChartHeight());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate data bounds
  const dataBounds = useMemo(() => {
    if (data.length === 0) {
      return {
        minX: Date.now() - 365 * 24 * 60 * 60 * 1000,
        maxX: Date.now(),
        minY: 0,
        maxY: 1000
      };
    }

    const prices = data.map(d => d.price);
    const timestamps = data.map(d => d.timestamp);
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const pricePadding = priceRange * 0.05;
    
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime;
    const timePadding = timeRange * 0.02;
    
    return {
      minX: minTime - timePadding,
      maxX: maxTime + timePadding,
      minY: Math.max(0, minPrice - pricePadding),
      maxY: maxPrice + pricePadding
    };
  }, [data]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return {
      datasets: [
        {
          label: `${symbol} Risk Analysis`,
          data: data.map(point => ({
            x: point.timestamp,
            y: point.price,
            risk: point.risk,
            date: point.date,
            ema8: point.ema8,
            ema21: point.ema21,
            sma50: point.sma50,
            sma100: point.sma100,
            sma200: point.sma200,
          })),
          backgroundColor: data.map(point => StockAnalysisService.getRiskColor(point.risk)),
          borderColor: data.map(point => StockAnalysisService.getRiskColor(point.risk)),
          //change data point size
          pointRadius: 2,
          pointHoverRadius: 3,
          pointBorderWidth: 0,
          showLine: false,
          tension: 0.1,
          fill: false,
          borderWidth: 0,
          order: 0,
        },
        // Moving average lines (if enabled)
        ...(showMovingAverages ? [
          {
            label: '8-Week EMA',
            data: data.map(point => ({ x: point.timestamp, y: point.ema8 })),
            backgroundColor: 'transparent',
            borderColor: 'rgba(239, 68, 68, 1.0)',
            pointRadius: 0,
            pointHoverRadius: 2,
            showLine: true,
            tension: 0.1,
            fill: false,
            borderWidth: 4,
            order: 1,
          },
          {
            label: '21-Week EMA',
            data: data.map(point => ({ x: point.timestamp, y: point.ema21 })),
            backgroundColor: 'transparent',
            borderColor: 'rgba(59, 130, 246, 1.0)',
            pointRadius: 0,
            pointHoverRadius: 2,
            showLine: true,
            tension: 0.1,
            fill: false,
            borderWidth: 3,
            order: 2,
          },
          {
            label: '50-Week SMA',
            data: data.map(point => ({ x: point.timestamp, y: point.sma50 })),
            backgroundColor: 'transparent',
            borderColor: 'rgba(34, 197, 94, 0.8)',
            pointRadius: 0,
            pointHoverRadius: 2,
            showLine: true,
            tension: 0.1,
            fill: false,
            borderWidth: 2,
            order: 3,
          }
        ] : []),
      ],
    };
  }, [data, showMovingAverages, symbol]);

  // Chart options
  const chartOptions: ChartOptions<'scatter'> = useMemo(() => {
    // Calculate 3-year default view
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 3);
    
    // Filter data for the 3-year view to calculate proper y-axis bounds
    const threeYearData = data.filter(point => 
      point.timestamp >= startDate.getTime() && point.timestamp <= endDate.getTime()
    );
    
    let initialYMin: number | undefined;
    let initialYMax: number | undefined;
    
    if (threeYearData.length > 0) {
      const threeYearPrices = threeYearData.map(d => d.price);
      const minPrice = Math.min(...threeYearPrices);
      const maxPrice = Math.max(...threeYearPrices);
      const priceRange = maxPrice - minPrice;
      const pricePadding = priceRange * 0.1;
      
      initialYMin = Math.max(0, minPrice - pricePadding);
      initialYMax = maxPrice + pricePadding;
    }
    
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      transitions: {
        active: {
          animation: {
            duration: 0
          }
        }
      },
      interaction: {
        intersect: true,
        mode: 'point',
        includeInvisible: false,
      },
      onHover: isMobileDevice() ? undefined : (event, elements) => {
        const target = event.native?.target as HTMLCanvasElement;
        if (target && target.style) {
          target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
        }
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(31, 41, 55, 0.95)',
          titleColor: '#ffffff',
          bodyColor: '#d1d5db',
          borderColor: '#6b7280',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: (context) => {
              const dataPoint = context[0].raw as { x: number };
              return format(new Date(dataPoint.x), 'MMM dd, yyyy');
            },
            label: (context) => {
              const dataPoint = context.raw as { y: number; risk: number };
              return [
                `Price: $${dataPoint.y.toFixed(2)}`,
                `Risk Level: ${dataPoint.risk.toFixed(2)}`,
              ];
            },
          },
        },
        zoom: {
          limits: {
            y: {min: dataBounds.minY, max: dataBounds.maxY},
            x: {min: dataBounds.minX, max: dataBounds.maxX}
          },
          pan: {
            enabled: false,
          },
          zoom: {
            wheel: {
              enabled: false,
            },
            pinch: {
              enabled: false,
            },
            drag: {
              enabled: !isMobileDevice(),
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderColor: 'rgba(59, 130, 246, 0.8)',
              borderWidth: 2,
              threshold: 30,
              modifierKey: undefined,
            },
            mode: 'x',
            onZoom: ({ chart }) => {
              setHasCustomZoom(true);
              
              // Auto-scale y-axis based on visible data
              const xScale = chart.scales.x;
              const yScale = chart.scales.y;
              
              if (xScale && yScale && data.length > 0) {
                const minX = xScale.min;
                const maxX = xScale.max;
                
                // Filter data to visible range
                const visibleData = data.filter(point => 
                  point.timestamp >= minX && point.timestamp <= maxX
                );
                
                if (visibleData.length > 0) {
                  const visiblePrices = visibleData.map(d => d.price);
                  const minPrice = Math.min(...visiblePrices);
                  const maxPrice = Math.max(...visiblePrices);
                  const priceRange = maxPrice - minPrice;
                  const pricePadding = priceRange * 0.1;
                  
                  yScale.options.min = Math.max(0, minPrice - pricePadding);
                  yScale.options.max = maxPrice + pricePadding;
                  
                  chart.update('none');
                }
              }
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          min: data.length > 0 ? startDate.getTime() : undefined,
          max: data.length > 0 ? endDate.getTime() : undefined,
          time: {
            unit: 'month',
            displayFormats: {
              day: 'MMM dd',
              week: 'MMM dd',
              month: 'MMM yyyy',
              quarter: 'MMM yyyy',
              year: 'yyyy',
            },
          },
          adapters: {
            date: {},
          },
          grid: {
            color: 'rgba(75, 85, 99, 0.3)',
          },
          ticks: {
            color: '#9ca3af',
            font: {
              size: 12,
            },
            maxRotation: 45,
            autoSkip: true,
            autoSkipPadding: 20,
            maxTicksLimit: 12,
          },
          border: {
            color: 'rgba(156, 163, 175, 0.2)',
          },
        },
        y: {
          type: isLogScale ? 'logarithmic' : 'linear',
          min: initialYMin,
          max: initialYMax,
          grid: {
            color: 'rgba(75, 85, 99, 0.3)',
          },
          ticks: {
            color: '#9ca3af',
            font: {
              size: 12,
            },
            callback: function(value) {
              const numValue = Number(value);
              if (numValue >= 1000) return `$${(numValue / 1000).toFixed(0)}K`;
              if (numValue >= 100) return `$${Math.round(numValue)}`;
              if (numValue >= 10) return `$${numValue.toFixed(0)}`;
              return `$${numValue.toFixed(1)}`;
            },
          },
          border: {
            color: 'rgba(156, 163, 175, 0.2)',
          },
        },
      },
    };
  }, [dataBounds, isLogScale, data]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Loading {symbol} risk data...</div>
          <div className="text-gray-400 text-sm">Calculating risk metrics with historical context</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-xl mb-4">Error Loading Data</div>
          <div className="text-gray-300 text-sm mb-4">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-2 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 md:mb-8 text-center">
          <h1 className="text-xl md:text-4xl font-bold text-white mb-1 md:mb-2 transition-all duration-300">
            {companyName || symbol} Risk Analysis Chart
          </h1>
          {dataSource && (
            <p className="text-xs md:text-sm text-gray-400 mt-1 md:mt-2 transition-opacity duration-300">
              Data Source: {dataSource}
            </p>
          )}
        </div>

        {/* Stock Summary Display */}
        <div className="transition-all duration-500 ease-in-out mb-4 md:mb-8">
          <StockSummaryDisplay 
            currentRisk={currentRisk} 
            currentPrice={currentPrice} 
            symbol={symbol}
            companyName={companyName}
          />
        </div>

        {/* Chart Container */}
        <div className={`bg-gray-800 rounded-lg p-2 md:p-6 shadow-xl transition-all duration-500 relative mb-4 md:mb-8 ${
          isAnimating ? 'opacity-90 scale-99' : 'opacity-100 scale-100'
        }`}>
          {/* Chart Controls */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <button
                onClick={resetZoom}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition-all duration-200"
              >
                Reset Zoom (3Y)
              </button>
              <button
                onClick={zoomToAllTime}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm font-medium transition-all duration-200"
              >
                All Time
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsLogScale(!isLogScale)}
                className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                  isLogScale 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {isLogScale ? 'Log' : 'Linear'} Scale
              </button>
            </div>
          </div>
          
          {/* Chart */}
          <div 
            style={{ 
              height: `${chartHeight}px`,
              touchAction: isMobileDevice() ? 'none' : 'manipulation',
              position: 'relative'
            }} 
            className="select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Custom mobile selection overlay */}
            {isMobileDevice() && touchSelection?.isSelecting && 
             Math.abs(touchSelection.currentX - touchSelection.startX) > 10 && (
              <div
                className="absolute top-0 pointer-events-none z-10"
                style={{
                  left: Math.min(touchSelection.startX, touchSelection.currentX),
                  width: Math.abs(touchSelection.currentX - touchSelection.startX),
                  height: '100%',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '2px solid rgba(59, 130, 246, 0.8)',
                }}
              />
            )}

            {chartReady && !loading ? (
              <Scatter
                ref={chartRef}
                data={chartData} 
                options={chartOptions} 
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-400 text-center">
                  <div className="text-lg mb-2">Loading Chart...</div>
                  <div className="text-sm">Preparing interactive features</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Risk Distribution Stats */}
        {riskStats && (
          <div className="bg-gray-800 rounded-lg p-4 md:p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-white">Risk Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-700 rounded p-3 text-center">
                <div className="text-green-400 font-semibold text-2xl">
                  {riskStats.distribution.risk1to3}
                </div>
                <div className="text-gray-300 mt-1">Low Risk (1-3)</div>
              </div>
              <div className="bg-gray-700 rounded p-3 text-center">
                <div className="text-yellow-400 font-semibold text-2xl">
                  {riskStats.distribution.risk4to6}
                </div>
                <div className="text-gray-300 mt-1">Moderate (4-6)</div>
              </div>
              <div className="bg-gray-700 rounded p-3 text-center">
                <div className="text-orange-400 font-semibold text-2xl">
                  {riskStats.distribution.risk7to8}
                </div>
                <div className="text-gray-300 mt-1">High (7-8)</div>
              </div>
              <div className="bg-gray-700 rounded p-3 text-center">
                <div className="text-red-400 font-semibold text-2xl">
                  {riskStats.distribution.risk9to10}
                </div>
                <div className="text-gray-300 mt-1">Extreme (9-10)</div>
              </div>
            </div>
            <div className="text-center mt-4 text-gray-400">
              Average Risk Score: <span className="font-semibold text-white text-lg">{riskStats.avg.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 