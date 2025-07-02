'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';

// Dynamically import Chart.js components to avoid SSR issues
import dynamic from 'next/dynamic';

// Chart.js imports that are safe for SSR
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

// Dynamic import for components that need window
const Scatter = dynamic(() => import('react-chartjs-2').then((mod) => mod.Scatter), {
  ssr: false,
});

// Chart.js registration state
let chartJsInitialized = false;

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

interface RiskStats {
  min: number;
  max: number;
  avg: number;
  distribution: {
    risk1to3: number;
    risk4to6: number;
    risk7to8: number;
    risk9to10: number;
  };
}

interface APIResponse {
  data: DataPoint[];
  currentPrice: number;
  currentRisk: number;
  source?: string;
  riskStats?: RiskStats;
}

// Professional color mapping function
const getRiskColor = (risk: number): string => {
  const normalized = Math.max(0, Math.min(1, (risk - 1) / 9));
  
  const colors = [
    { r: 68, g: 1, b: 84 },     // Deep purple (risk 1)
    { r: 59, g: 82, b: 139 },   // Deep blue (risk 2.5)
    { r: 33, g: 145, b: 140 },  // Teal (risk 4)
    { r: 94, g: 201, b: 98 },   // Green (risk 6)
    { r: 253, g: 231, b: 37 },  // Bright yellow (risk 8)
    { r: 255, g: 255, b: 0 },   // Pure yellow (risk 10)
  ];
  
  const segments = colors.length - 1;
  const segmentSize = 1 / segments;
  const segment = Math.floor(normalized / segmentSize);
  const localNormalized = (normalized - segment * segmentSize) / segmentSize;
  
  const startColor = colors[Math.min(segment, segments - 1)];
  const endColor = colors[Math.min(segment + 1, segments)];
  
  const r = Math.round(startColor.r + (endColor.r - startColor.r) * localNormalized);
  const g = Math.round(startColor.g + (endColor.g - startColor.g) * localNormalized);
  const b = Math.round(startColor.b + (endColor.b - startColor.b) * localNormalized);
  
  return `rgb(${r}, ${g}, ${b})`;
};

// Get risk level description
const getRiskDescription = (risk: number): { level: string; description: string; color: string } => {
  if (risk <= 2) return { 
    level: "Very Low Risk", 
    description: "Extreme undervaluation - historically rare buying opportunity",
    color: getRiskColor(risk)
  };
  if (risk <= 3) return { 
    level: "Low Risk", 
    description: "Below key support levels - good value territory",
    color: getRiskColor(risk)
  };
  if (risk <= 4) return { 
    level: "Low-Moderate Risk", 
    description: "Below historical average - reasonable entry point",
    color: getRiskColor(risk)
  };
  if (risk <= 6) return { 
    level: "Moderate Risk", 
    description: "Fair value range - consider market conditions",
    color: getRiskColor(risk)
  };
  if (risk <= 7) return { 
    level: "Moderate-High Risk", 
    description: "Above historical average - elevated valuation",
    color: getRiskColor(risk)
  };
  if (risk <= 8.5) return { 
    level: "High Risk", 
    description: "Top 25% of historical valuations - proceed with caution",
    color: getRiskColor(risk)
  };
  if (risk <= 9) return { 
    level: "Very High Risk", 
    description: "Top 10% of historical valuations - high risk territory",
    color: getRiskColor(risk)
  };
  return { 
    level: "Extreme Risk", 
    description: "Top 5% of historical deviations - extreme overextension",
    color: getRiskColor(risk)
  };
};

// Current Risk Assessment Card
const CurrentRiskAssessment = ({ currentRisk, currentPrice }: { currentRisk: number; currentPrice: number }) => {
  const riskInfo = getRiskDescription(currentRisk);
  
  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-4 md:p-6 shadow-2xl border border-gray-600">
        <div className="text-center">
        <h2 className="text-lg md:text-2xl font-bold text-white mb-1 md:mb-2">
            Current Risk Assessment
          </h2>
        <h3 className="text-sm md:text-lg text-gray-300 mb-3 md:mb-4">
            NVIDIA ($NVDA) (${currentPrice.toFixed(2)})
          </h3>
          
        <div className="flex items-center justify-center gap-4 md:gap-8 mb-3 md:mb-4">
            <div className="text-center">
              <div 
              className="text-4xl md:text-6xl font-bold mb-1 md:mb-2"
                style={{ color: riskInfo.color }}
              >
                {currentRisk.toFixed(1)}
              </div>
            <div className="text-sm md:text-lg text-gray-400">Risk Score</div>
            </div>
            
            <div className="text-center">
              <div 
              className="text-lg md:text-2xl font-bold mb-1 md:mb-2"
                style={{ color: riskInfo.color }}
              >
                {riskInfo.level}
              </div>
            <div className="text-xs md:text-sm text-gray-300 max-w-xs">
                {riskInfo.description}
              </div>
            </div>
          </div>
          
          <div className="relative w-full max-w-md mx-auto">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          <div className="h-3 md:h-4 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-500 rounded-full"
                style={{ 
                  width: `${(currentRisk / 10) * 100}%`,
                  background: `linear-gradient(90deg, rgb(68,1,84), rgb(59,82,139), rgb(33,145,140), rgb(94,201,98), rgb(253,231,37), rgb(255,255,0))`
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

// Risk Algorithm Explanation Component
const RiskAlgorithmExplanation = ({ riskStats }: { riskStats?: RiskStats }) => {
  return (
    <div className="mb-6 bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-lg font-semibold mb-4 text-white">🔬 Pure Technical Risk Algorithm v4.0 - Real-Time</h3>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-md font-semibold text-blue-400 mb-2">Pure Technical Methodology:</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• <strong>Moving Average Deviations:</strong> 50/200-week SMA distance analysis</li>
            <li>• <strong>Rolling Percentiles:</strong> 3-year context for all indicators</li>
            <li>• <strong>Elevation Duration:</strong> Time above key thresholds</li>
            <li>• <strong>Peak Proximity:</strong> Distance from 52-week highs</li>
            <li>• <strong>Volatility Intelligence:</strong> Crash vs bubble volatility patterns</li>
            <li>• <strong>Market Regime:</strong> 52-week momentum analysis</li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-md font-semibold text-green-400 mb-2">v4.0 Real-Time Features:</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• <strong>No Hard-Coding:</strong> Zero retrospective adjustments</li>
            <li>• <strong>Backtest Accurate:</strong> Would work in real-time historically</li>
            <li>• <strong>Bubble Detection:</strong> Extreme elevation + duration signals</li>
            <li>• <strong>Crash Recognition:</strong> High volatility below moving averages</li>
            <li>• <strong>Dynamic Scaling:</strong> Risk 1.0 for deep value, 8+ for bubbles</li>
            <li>• <strong>Multi-Factor:</strong> 8 independent technical indicators</li>
          </ul>
        </div>
      </div>
      
      {riskStats && (
        <div className="mt-4">
          <h4 className="text-md font-semibold text-purple-400 mb-2">Current Distribution:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-gray-700 rounded p-2 text-center">
              <div className="text-green-400 font-semibold">{riskStats.distribution.risk1to3}</div>
              <div className="text-gray-300">Low (1-3)</div>
            </div>
            <div className="bg-gray-700 rounded p-2 text-center">
              <div className="text-yellow-400 font-semibold">{riskStats.distribution.risk4to6}</div>
              <div className="text-gray-300">Moderate (4-6)</div>
            </div>
            <div className="bg-gray-700 rounded p-2 text-center">
              <div className="text-orange-400 font-semibold">{riskStats.distribution.risk7to8}</div>
              <div className="text-gray-300">High (7-8)</div>
            </div>
            <div className="bg-gray-700 rounded p-2 text-center">
              <div className="text-red-400 font-semibold">{riskStats.distribution.risk9to10}</div>
              <div className="text-gray-300">Extreme (8+)</div>
            </div>
          </div>
          <div className="text-center mt-2 text-sm text-gray-400">
            Average Risk: <span className="font-semibold text-white">{riskStats.avg.toFixed(1)}</span>
          </div>
        </div>
      )}
      
      <div className="mt-4 p-3 bg-gradient-to-r from-gray-700 to-gray-600 rounded text-xs text-gray-300">
        <strong>🎯 v4.0 Philosophy:</strong> This algorithm uses ONLY technical indicators that would have been 
        available in real-time during backtesting. No hard-coded period adjustments or retrospective knowledge. 
        It identifies bubbles through extreme elevation + duration and distinguishes crashes from bubbles using 
        volatility patterns relative to moving averages. True backtest accuracy.
      </div>
    </div>
  );
};

// Professional risk legend component
const RiskLegend = () => {
  const riskLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  return (
    <div className="mb-4 md:mb-6">
      <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3 text-white">Risk Level Scale</h3>
      <div className="bg-gray-800 rounded-lg p-3 md:p-4 shadow-lg">
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-300 font-medium">Low Risk</span>
            <span className="text-xs text-gray-300 font-medium">High Risk</span>
          </div>
          <div className="flex gap-1 mb-2">
            {riskLevels.map((level) => (
              <div key={level} className="flex-1 text-center">
                <div
                  className="w-full h-5 rounded shadow-sm border border-gray-600 mb-1"
                  style={{ backgroundColor: getRiskColor(level) }}
                  title={`Risk Level ${level}`}
                />
                <div className="text-xs text-gray-400">{level}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400 text-center">
            Deep Purple (1): Bottom 5% • Bright Yellow (10): Top 5%
          </div>
        </div>
        
        <div className="hidden md:flex items-center justify-between">
        <span className="text-sm text-gray-300 font-medium">Low Risk</span>
        <div className="flex gap-1 mx-4">
          {riskLevels.map((level) => (
            <div key={level} className="text-center">
              <div
                className="w-6 h-6 rounded shadow-sm border border-gray-600 mb-1"
                style={{ backgroundColor: getRiskColor(level) }}
                title={`Risk Level ${level}`}
              />
              <div className="text-xs text-gray-400">{level}</div>
            </div>
          ))}
        </div>
        <span className="text-sm text-gray-300 font-medium">High Risk</span>
      </div>
        <div className="hidden md:block mt-2 text-xs text-gray-400 text-center">
        <p>Risk levels based on historical percentiles • Deep Purple (1): Bottom 5% • Bright Yellow (10): Top 5%</p>
        </div>
      </div>
    </div>
  );
};

// Add new interface for time range presets
interface TimeRange {
  label: string;
  startYear: number;
  endYear?: number;
  description: string;
}

export default function NVDARiskChart() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [currentRisk, setCurrentRisk] = useState<number>(0);
  const [dataSource, setDataSource] = useState<string>('');
  const [riskStats, setRiskStats] = useState<RiskStats | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLogScale, setIsLogScale] = useState(true);
  
  // New visualization mode states
  const [showMovingAverages, setShowMovingAverages] = useState(false);
  
  // New state for time range control
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('2019present');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  
  // Touch gesture state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Chart reference for zoom controls
  const chartRef = useRef<ChartJS<"scatter">>(null);
  
  // Chart height state
  const [chartHeight, setChartHeight] = useState(600);
  const [isMounted, setIsMounted] = useState(false);
  const [chartReady, setChartReady] = useState(false);

  // Time range presets
  const timeRanges: TimeRange[] = [
    { label: '2019-Present', startYear: 2019, description: 'Recent cycle (Default)' },
    { label: '2021-Present', startYear: 2021, description: 'Post-COVID cycle' },
    { label: '2020-Present', startYear: 2020, description: 'COVID era onwards' },
    { label: '2018-Present', startYear: 2018, description: 'Post-crypto boom' },
    { label: '2015-Present', startYear: 2015, description: 'Full modern era' },
    { label: 'All Data', startYear: 2015, description: 'Complete history from 2015' },
    { label: 'Custom Range', startYear: 0, description: 'Select your own dates' }
  ];

  // Initialize Chart.js properly with better error handling
  useEffect(() => {
    const initializeChart = async () => {
      if (typeof window === 'undefined' || chartJsInitialized) {
        if (chartJsInitialized) setChartReady(true);
        return;
      }

      try {
        // First, register basic Chart.js components
        ChartJS.register(
          LinearScale,
          LogarithmicScale,
          PointElement,
          LineElement,
          Tooltip,
          Legend,
          TimeScale
        );

        // Import and register zoom plugin
        const zoomModule = await import('chartjs-plugin-zoom');
        ChartJS.register(zoomModule.default);

        // Try to import date adapter, but don't fail if it doesn't work
        try {
          // @ts-ignore - Suppress TypeScript error for date adapter
          await import('chartjs-adapter-date-fns');
        } catch (adapterError) {
          console.warn('Date adapter failed to load, using default:', adapterError);
        }

        chartJsInitialized = true;
        setChartReady(true);
        console.log('Chart.js initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Chart.js:', error);
        setError('Failed to initialize chart components');
      }
    };

    initializeChart();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Attempting to fetch data from Yahoo Finance...');
        let response = await fetch('/api/nvda-data-yahoo');
        
        if (!response.ok) {
          console.log('Yahoo Finance failed, trying Finnhub...');
          response = await fetch('/api/nvda-data');
        }
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const result: APIResponse = await response.json();
        
        const processedData = result.data.map(item => ({
          ...item,
          date: new Date(item.date),
          timestamp: new Date(item.date).getTime(),
        }));
        
        setData(processedData);
        setCurrentPrice(result.currentPrice);
        setCurrentRisk(result.currentRisk);
        setDataSource(result.source || 'Unknown');
        setRiskStats(result.riskStats);
        
        console.log(`Successfully loaded ${processedData.length} data points from ${result.source || 'API'}`);
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter data based on selected time range
  const filteredData = useMemo(() => {
    if (!data.length) return [];
    
    let startDate: Date;
    let endDate: Date = new Date();
    
    if (selectedTimeRange === 'customrange' && customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
    } else {
      const selectedRange = timeRanges.find(range => 
        range.label.toLowerCase().replace(/[^a-z]/g, '') === 
        selectedTimeRange.toLowerCase().replace(/[^a-z]/g, '')
      );
      
      if (selectedRange && selectedRange.startYear > 0) {
        startDate = new Date(selectedRange.startYear, 0, 1);
        if (selectedRange.endYear) {
          endDate = new Date(selectedRange.endYear, 11, 31);
        }
      } else {
        return data;
      }
    }
    
    const filtered = data.filter(point => 
      point.date >= startDate && point.date <= endDate
    );
    
    return filtered;
  }, [data, selectedTimeRange, customStartDate, customEndDate]);

  // Set mounted state
  useEffect(() => {
    setIsMounted(true);
    
    const getChartHeight = () => {
      return window.innerWidth < 768 ? 500 : 600;
    };
    
    setChartHeight(getChartHeight());
    
    const handleResize = () => setChartHeight(getChartHeight());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setSelectedTimeRange('2019present');
            break;
          case '2':
            e.preventDefault();
            setSelectedTimeRange('2021present');
            break;
          case '3':
            e.preventDefault();
            setSelectedTimeRange('2020present');
            break;
          case '4':
            e.preventDefault();
            setSelectedTimeRange('2018present');
            break;
          case '0':
            e.preventDefault();
            setSelectedTimeRange('alldata');
            break;
          case 'l':
            e.preventDefault();
            setIsLogScale(!isLogScale);
            break;
          case 'r':
            e.preventDefault();
            // Reset zoom
            if (chartRef.current) {
              chartRef.current.resetZoom();
            }
            setSelectedTimeRange('2019present');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isLogScale]);

  // Smooth timeframe changing with animation
  const changeTimeRange = (newRange: string) => {
    setIsAnimating(true);
    setTimeout(() => {
      setSelectedTimeRange(newRange);
      setIsAnimating(false);
    }, 150);
  };

  // Touch gesture handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      const currentIndex = timeRanges.findIndex(range => 
        range.label.toLowerCase().replace(/[^a-z]/g, '') === selectedTimeRange
      );
      
      if (deltaX > 0 && currentIndex > 0) {
        const newRange = timeRanges[currentIndex - 1];
        changeTimeRange(newRange.label.toLowerCase().replace(/[^a-z]/g, ''));
      } else if (deltaX < 0 && currentIndex < timeRanges.length - 2) {
        const newRange = timeRanges[currentIndex + 1];
        changeTimeRange(newRange.label.toLowerCase().replace(/[^a-z]/g, ''));
      }
    }
    
    setTouchStart(null);
  };

  // Export function
  const exportData = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Date,Price,Risk,8-Week EMA,21-Week EMA,200-Week SMA\n"
      + data.map(row => 
          `${format(row.date, 'yyyy-MM-dd')},${row.price},${row.risk},${row.ema8},${row.ema21},${row.sma200}`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nvda-daily-risk-data-complete.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset zoom function
  const resetZoom = () => {
    if (chartRef.current) {
      const xScale = chartRef.current.scales.x;
      const yScale = chartRef.current.scales.y;
      
      if (xScale && yScale) {
        // Set to 2019-present timeframe (matches initial load)
        const startDate = new Date(2019, 0, 1); // Jan 1, 2019
        const endDate = new Date(); // Current date
        
        xScale.options.min = startDate.getTime();
        xScale.options.max = endDate.getTime();
        yScale.options.min = undefined; // Auto-fit to data
        yScale.options.max = undefined; // Auto-fit to data
        
        // Clear any active hover states
        chartRef.current.setActiveElements([]);
        
        // Force a proper re-render with animation
        chartRef.current.update();
        
        // Ensure data points are properly rendered with a second update
        setTimeout(() => {
          if (chartRef.current) {
            chartRef.current.update('none');
          }
        }, 50);
      }
    }
  };

  // Calculate data bounds for zoom limits - based on ALL data, not just filtered
  const dataBounds = useMemo(() => {
    if (data.length === 0) {
      return {
        minX: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago as fallback
        maxX: Date.now(),
        minY: 0,
        maxY: 1000
      };
    }

    const prices = data.map(d => d.price);
    const timestamps = data.map(d => d.timestamp);
    
    // Add some padding to the bounds (5% on each side)
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const pricePadding = priceRange * 0.05;
    
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime;
    const timePadding = timeRange * 0.02; // 2% padding for time
    
    return {
      minX: minTime - timePadding,
      maxX: maxTime + timePadding,
      minY: Math.max(0, minPrice - pricePadding), // Don't go below 0
      maxY: maxPrice + pricePadding
    };
  }, [data]);

  // Auto-zoom to selected timeframe
  useEffect(() => {
    if (!chartRef.current || !data.length || !chartReady) return;
    
    // Small delay to ensure chart is fully rendered
    const timeoutId = setTimeout(() => {
      const chart = chartRef.current;
      if (!chart) return;
      
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      
      if (!xScale || !yScale) return;
      
      // Calculate timeframe boundaries
      let startDate: Date;
      let endDate: Date = new Date();
      
      if (selectedTimeRange === 'customrange' && customStartDate && customEndDate) {
        startDate = customStartDate;
        endDate = customEndDate;
      } else {
        const selectedRange = timeRanges.find(range => 
          range.label.toLowerCase().replace(/[^a-z]/g, '') === 
          selectedTimeRange.toLowerCase().replace(/[^a-z]/g, '')
        );
        
        if (selectedRange && selectedRange.startYear > 0) {
          startDate = new Date(selectedRange.startYear, 0, 1);
          if (selectedRange.endYear) {
            endDate = new Date(selectedRange.endYear, 11, 31);
          }
        } else {
          // Show all data
          startDate = new Date(data[0].date);
          endDate = new Date(data[data.length - 1].date);
        }
      }
      
      // Set chart zoom to timeframe
      xScale.options.min = startDate.getTime();
      xScale.options.max = endDate.getTime();
      yScale.options.min = undefined;
      yScale.options.max = undefined;
      
      chart.update('none');
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [selectedTimeRange, customStartDate, customEndDate, data, chartReady]);

  // Early returns after all hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Loading NVDA daily risk data...</div>
          <div className="text-gray-400 text-sm">Calculating advanced risk metrics with historical context</div>
        </div>
      </div>
    );
  }

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

  // Prepare Chart.js data with optional line connections and moving averages
  const chartData = {
    datasets: [
      {
        label: 'NVDA Risk Analysis',
        data: data.map(point => ({
          x: point.timestamp,
          y: point.price,
          risk: point.risk,
          date: point.date,
          ema8: point.ema8,
          ema21: point.ema21,
          sma200: point.sma200,
        })),
        backgroundColor: data.map(point => getRiskColor(point.risk)),
        borderColor: data.map(point => getRiskColor(point.risk)),
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBorderWidth: 0,
        showLine: false,
        tension: 0.1,
        fill: false,
        borderWidth: 0,
        order: 1,
      },
      // EMA8 line (if enabled) - as scatter dataset with lines
      ...(showMovingAverages ? [{
        label: '8-Week EMA',
        data: data.map(point => ({
          x: point.timestamp,
          y: point.ema8,
        })),
        backgroundColor: 'transparent',
        borderColor: 'rgba(59, 130, 246, 0.8)',
        pointRadius: 0,
        pointHoverRadius: 2,
        showLine: true,
        tension: 0.1,
        fill: false,
        borderWidth: 2,
        order: 2,
      }] : []),
      // EMA21 line (if enabled) - as scatter dataset with lines
      ...(showMovingAverages ? [{
        label: '21-Week EMA', 
        data: data.map(point => ({
          x: point.timestamp,
          y: point.ema21,
        })),
        backgroundColor: 'transparent',
        borderColor: 'rgba(234, 179, 8, 0.8)',
        pointRadius: 0,
        pointHoverRadius: 2,
        showLine: true,
        tension: 0.1,
        fill: false,
        borderWidth: 2,
        order: 3,
      }] : []),
      // SMA200 line (if enabled) - as scatter dataset with lines
      ...(showMovingAverages ? [{
        label: '200-Week SMA',
        data: data.map(point => ({
          x: point.timestamp,
          y: point.sma200,
        })),
        backgroundColor: 'transparent',
        borderColor: 'rgba(239, 68, 68, 0.8)',
        pointRadius: 0,
        pointHoverRadius: 2,
        showLine: true,
        tension: 0.1,
        fill: false,
        borderWidth: 2,
        order: 4,
      }] : []),
    ],
  };

  // Chart.js options with professional styling and zoom
  const chartOptions: ChartOptions<'scatter'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'nearest',
      includeInvisible: false,
    },
    onHover: (event, elements) => {
      // Ensure consistent hover behavior
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
        backgroundColor: 'rgba(31, 41, 55, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#d1d5db',
        borderColor: '#6b7280',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (context) => {
            const dataPoint = context[0].raw as any;
            return format(new Date(dataPoint.x), 'MMM dd, yyyy');
          },
          label: (context) => {
            const dataPoint = context.raw as any;
            return [
              `Price: $${dataPoint.y.toFixed(2)}`,
              `Risk Level: ${dataPoint.risk.toFixed(2)}`,
              `8-Week EMA: $${dataPoint.ema8.toFixed(2)}`,
              `21-Week EMA: $${dataPoint.ema21.toFixed(2)}`,
              `200-Week SMA: $${dataPoint.sma200.toFixed(2)}`,
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
          enabled: true,
          mode: 'x',
          modifierKey: 'ctrl',
        },
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1,
          },
          pinch: {
            enabled: true,
          },
          drag: {
            enabled: true,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: 'rgba(59, 130, 246, 0.8)',
            borderWidth: 2,
            threshold: 15,
          },
          mode: 'x',
          onZoom: ({chart}) => {
            // All data is always available for smooth zooming
            chart.update('none');
          },
          onZoomComplete: ({chart}) => {
            // Re-enable interactions after zoom
            chart.update('none');
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
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
        // Set initial zoom to 2019-present by default
        min: data.length > 0 ? new Date(2019, 0, 1).getTime() : undefined,
        max: data.length > 0 ? new Date().getTime() : undefined,
      },
      y: {
        type: isLogScale ? 'logarithmic' : 'linear',
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

  return (
    <div className="min-h-screen bg-gray-900 p-2 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 md:mb-8 text-center">
          <h1 className="text-xl md:text-4xl font-bold text-white mb-1 md:mb-2 transition-all duration-300">
            NVDA Daily Risk Analysis Chart
          </h1>
          {dataSource && (
            <p className="text-xs md:text-sm text-gray-400 mt-1 md:mt-2 transition-opacity duration-300">
              Data Source: {dataSource}
            </p>
          )}
        </div>

        {/* Current Risk Assessment */}
        <div className="transition-all duration-500 ease-in-out mb-4 md:mb-8">
        <CurrentRiskAssessment currentRisk={currentRisk} currentPrice={currentPrice} />
        </div>

        {/* Risk Algorithm Explanation - Hide on small screens by default */}
        <div className="hidden md:block transition-all duration-300">
        <RiskAlgorithmExplanation riskStats={riskStats} />
        </div>
        
        {/* Collapsible explanation for mobile */}
        <div className="md:hidden mb-3">
          <details className="bg-gray-800 rounded-lg shadow-lg transition-all duration-300">
            <summary className="p-3 text-white font-semibold cursor-pointer hover:bg-gray-700 transition-colors text-sm">
              📊 Risk Algorithm Details
            </summary>
            <div className="px-3 pb-3">
              <RiskAlgorithmExplanation riskStats={riskStats} />
            </div>
          </details>
        </div>

        {/* Interactive Controls */}
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-lg font-bold mb-3 text-blue-400">Interactive Controls</h3>
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-semibold text-gray-300 mb-1">Zoom & Pan:</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-400">
                <li><strong>Desktop:</strong> Click and drag to select time range to zoom</li>
                <li><strong>Mobile:</strong> Pinch to zoom, drag to select time ranges</li>
                <li><strong>Mouse wheel:</strong> Zoom in/out at cursor position (desktop)</li>
                <li><strong>Pan:</strong> Ctrl+Drag (desktop) or drag when zoomed (mobile)</li>
                <li><strong>Reset:</strong> "Reset Zoom" button returns to 2019-present view</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-300 mb-1">Keyboard Shortcuts (Desktop):</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-400">
                <li><strong>Ctrl+1-4:</strong> Quick timeframe selection</li>
                <li><strong>Ctrl+L:</strong> Toggle linear/log scale</li>
                <li><strong>Ctrl+R:</strong> Reset zoom to 2019-present view</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Enhanced Controls */}
        <div className="mb-4 md:mb-6 space-y-3 md:space-y-4">
          {/* Time Range Selection with Touch Support */}
          <div 
            className="bg-gray-800 rounded-lg p-3 md:p-4 shadow-lg transition-all duration-300"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <h3 className="text-white font-semibold mb-2 md:mb-3 text-sm md:text-base">
              📅 Time Range
              <span className="md:hidden text-xs text-gray-400 ml-2">(Swipe to change)</span>
            </h3>
            <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 transition-all duration-300 ${
              isAnimating ? 'opacity-70 scale-98' : 'opacity-100 scale-100'
            }`}>
              {timeRanges.map((range) => {
                const rangeKey = range.label.toLowerCase().replace(/[^a-z]/g, '');
                return (
                  <button
                    key={range.label}
                    onClick={() => changeTimeRange(rangeKey)}
                    className={`px-2 md:px-3 py-2 rounded text-xs md:text-sm transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                      selectedTimeRange === rangeKey
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    title={range.description}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
            
            {/* Custom Date Range Inputs */}
            {selectedTimeRange === 'customrange' && (
              <div className="mt-3 md:mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                <div>
                  <label className="block text-white text-sm mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => setCustomStartDate(new Date(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-white text-sm mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => setCustomEndDate(new Date(e.target.value))}
                  />
                </div>
              </div>
            )}
            
            {/* Quick Action Buttons */}
            <div className="mt-3 md:mt-4 flex flex-wrap gap-2 items-center">
              <button
                onClick={exportData}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 md:px-3 py-1 rounded text-xs md:text-sm transition-all duration-200 transform hover:scale-105 active:scale-95"
              >
                📥 Export CSV
              </button>
              <span className="text-gray-400 text-xs animate-pulse">
                {data.length} points total
                {data.length > 0 && (
                  <span className="ml-2 text-xs">
                    ({format(data[0].date, 'yyyy-MM-dd')} to {format(data[data.length - 1].date, 'yyyy-MM-dd')})
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Scale and Interactive Controls */}
          <div className="bg-gray-800 rounded-lg p-3 md:p-4 shadow-lg transition-all duration-300">
            <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-3">
              <span className="text-white font-medium text-xs md:text-base">📈 Scale:</span>
              <button
                onClick={() => setIsLogScale(false)}
                className={`px-2 md:px-4 py-1 md:py-2 rounded transition-all duration-300 text-xs md:text-sm transform hover:scale-105 active:scale-95 ${
                  !isLogScale 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Linear
              </button>
              <button
                onClick={() => setIsLogScale(true)}
                className={`px-2 md:px-4 py-1 md:py-2 rounded transition-all duration-300 text-xs md:text-sm transform hover:scale-105 active:scale-95 ${
                  isLogScale 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Log
              </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <span className="text-white font-medium text-xs md:text-base">🔗 View:</span>
              <button
                onClick={() => setShowMovingAverages(!showMovingAverages)}
                className={`px-2 md:px-4 py-1 md:py-2 rounded transition-all duration-300 text-xs md:text-sm transform hover:scale-105 active:scale-95 ${
                  showMovingAverages 
                    ? 'bg-purple-600 text-white shadow-lg' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Show EMAs
              </button>
            </div>
            
            {/* Keyboard shortcuts hint */}
            <div className="mt-2 text-xs text-gray-400 transition-opacity duration-300">
              <span className="hidden md:inline">
                💡 Shortcuts: Ctrl+1-4 (timeframes), Ctrl+L (scale), Ctrl+R (reset zoom) • Show EMAs for trend context when zoomed
              </span>
              <span className="md:hidden">
                💡 Use "Show EMAs" to see trend lines when zoomed in • Pinch to zoom, Ctrl+Drag to pan
              </span>
            </div>
          </div>
        </div>

        {/* Risk Legend */}
        <div className="transition-all duration-300">
        <RiskLegend />
        </div>

        {/* Professional Chart */}
        <div className={`bg-gray-800 rounded-lg p-2 md:p-6 shadow-xl transition-all duration-500 relative ${
          isAnimating ? 'opacity-90 scale-99' : 'opacity-100 scale-100'
        }`}>
          {/* Reset Zoom Button Overlay */}
          <button
            onClick={resetZoom}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
          >
            🔍 Reset Zoom
          </button>
          
          <div style={{ height: `${chartHeight}px` }}>
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

        {/* Mobile-Optimized Statistics */}
        <div className="mt-4 md:mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-gray-800 rounded-lg p-3 md:p-4 shadow-lg transition-all duration-300 hover:shadow-xl">
            <h3 className="text-sm md:text-lg font-semibold text-white mb-1 md:mb-2">Data Points</h3>
            <p className="text-xl md:text-3xl font-bold text-blue-400 transition-all duration-300">{data.length}</p>
            <p className="text-xs md:text-sm text-gray-400">Daily data points</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-3 md:p-4 shadow-lg transition-all duration-300 hover:shadow-xl">
            <h3 className="text-sm md:text-lg font-semibold text-white mb-1 md:mb-2">Price Range</h3>
            <p className="text-xs md:text-sm text-gray-400">
              Low: <span className="text-red-400 font-semibold transition-colors duration-300">
                ${data.length > 0 ? Math.min(...data.map(d => d.price)).toFixed(2) : '0'}
              </span>
            </p>
            <p className="text-xs md:text-sm text-gray-400">
              High: <span className="text-green-400 font-semibold transition-colors duration-300">
                ${data.length > 0 ? Math.max(...data.map(d => d.price)).toFixed(2) : '0'}
              </span>
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-3 md:p-4 shadow-lg transition-all duration-300 hover:shadow-xl">
            <h3 className="text-sm md:text-lg font-semibold text-white mb-1 md:mb-2">Risk Range</h3>
            <p className="text-xs md:text-sm text-gray-400">
              Low: <span style={{ 
                color: data.length > 0 ? getRiskColor(Math.min(...data.map(d => d.risk))) : '#fff' 
              }} className="font-semibold transition-colors duration-300">
                {data.length > 0 ? Math.min(...data.map(d => d.risk)).toFixed(2) : '0'}
              </span>
            </p>
            <p className="text-xs md:text-sm text-gray-400">
              High: <span style={{ 
                color: data.length > 0 ? getRiskColor(Math.max(...data.map(d => d.risk))) : '#fff' 
              }} className="font-semibold transition-colors duration-300">
                {data.length > 0 ? Math.max(...data.map(d => d.risk)).toFixed(2) : '0'}
              </span>
            </p>
          </div>
        </div>

        {/* Enhanced Mobile Help Text */}
        <div className="md:hidden mt-3 bg-gray-800 rounded-lg p-3 transition-all duration-300">
          <p className="text-xs text-gray-400 mb-2">
            💡 <strong>Mobile Controls:</strong>
          </p>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• <strong>Drag Selection:</strong> Drag to select time range on chart</li>
            <li>• <strong>Pinch Zoom:</strong> Pinch to zoom in/out on chart for fine control</li>
            <li>• <strong>Time Selection:</strong> Use timeframe preset buttons for date ranges</li>
            <li>• <strong>Pan Around:</strong> Drag to move around when zoomed in</li>
            <li>• <strong>Reset View:</strong> Use "Reset Zoom" button to return to 2019-present</li>
          </ul>
          <div className="mt-2 text-xs text-yellow-300">
            📱 <strong>Pro Tip:</strong> Drag across the chart to select specific time periods!
          </div>
        </div>

        {/* Performance indicator */}
        {data.length > 3000 && (
          <div className="mt-4 bg-yellow-900 border border-yellow-600 rounded-lg p-3 transition-all duration-300">
            <p className="text-yellow-300 text-sm">
              ⚡ Large dataset ({data.length} daily points) - consider using a smaller time range for better performance on mobile devices.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 