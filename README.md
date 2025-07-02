# NVDA Risk Analysis Chart

An interactive, mobile-friendly risk analysis chart for NVIDIA stock with advanced technical indicators and intuitive navigation controls.

## ✨ Interactive Features

### 🎯 Timeframe Selection
- **Quick Presets**: 2021-Present (default), 2020-Present, 2018-Present, 2015-Present, All Data
- **Custom Range**: Select any date range with date pickers
- **Mobile-Optimized**: Default 2021-Present view for optimal mobile performance
- **Smooth Transitions**: Animated timeframe changes with visual feedback

### 📱 Mobile-First Design
- **Touch Gestures**: Swipe left/right on timeframe section to navigate periods
- **Responsive Layout**: Optimized for all screen sizes (320px+)
- **Touch-Friendly**: Large buttons and swipe areas for easy interaction
- **Performance Aware**: Automatic warnings for large datasets on mobile

### 🔍 Advanced Zoom & Navigation
- **Drag-to-Zoom**: Click and drag to select any area for instant zoom
- **Mouse Wheel Zoom**: Precise zoom control with scroll wheel
- **Pinch-to-Zoom**: Native touch zoom support on mobile devices
- **Smart Panning**: Hold Ctrl+Drag to pan around when zoomed in
- **One-Click Reset**: Quick return to full view with "Reset Zoom"
- **Auto-Rescaling**: Automatic axis adjustment when zooming

### ⌨️ Power User Features
- **Keyboard Shortcuts**:
  - `Ctrl+1-4`: Quick timeframe selection
  - `Ctrl+L`: Toggle linear/logarithmic scale
  - `Ctrl+R`: Reset zoom and return to default view
  - `Ctrl+Drag`: Pan around the chart when zoomed
- **Data Export**: Export filtered data as CSV for external analysis
- **Scale Toggle**: Switch between linear and logarithmic price scales

### 🎨 Enhanced User Experience
- **Smooth Animations**: Fluid transitions between states
- **Loading States**: Beautiful loading indicators with progress feedback
- **Error Handling**: Graceful fallbacks with helpful error messages
- **Accessibility**: Full keyboard navigation and screen reader support
- **Performance Indicators**: Real-time feedback on chart performance

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the interactive chart.

## 📊 Risk Algorithm v4.0

Advanced technical risk calculation using:
- **Moving Average Deviations**: 8/21-week EMA, 50/200-week SMA analysis
- **Rolling Percentiles**: 3-year historical context for all indicators  
- **Elevation Duration**: Time-based risk amplification for sustained highs
- **Peak Proximity**: Distance from 52-week highs analysis
- **Volatility Intelligence**: Crash vs bubble pattern recognition
- **Market Regime**: 52-week momentum and trend analysis

### Risk Scale (1-10)
- **1-3**: Low Risk (Deep purple) - Strong value territory
- **4-6**: Moderate Risk (Green) - Fair value range  
- **7-8**: High Risk (Orange) - Elevated valuations
- **8+**: Extreme Risk (Yellow) - Top 5% historical deviations

## 📱 Mobile Usage Tips

1. **Default View**: Chart opens with 2021-Present for optimal mobile performance
2. **Touch Navigation**: Swipe left/right on the timeframe section to change periods
3. **Zoom Controls**: Drag to select area or pinch-to-zoom for detailed analysis
4. **Data Export**: Tap "Export CSV" to download current view data
5. **Performance**: Smaller timeframes load faster on mobile devices

## 🎯 Desktop Power Features

1. **Keyboard Shortcuts**: Use Ctrl+number keys for rapid timeframe switching
2. **Drag Zoom**: Click and drag to select any chart region for instant zoom
3. **Wheel Zoom**: Use mouse wheel for precise zoom control
4. **Ctrl+Pan**: Hold Ctrl and drag to pan around when zoomed in
5. **Scale Toggle**: Switch between linear/log scales for different perspectives
6. **Multi-Monitor**: Chart scales beautifully on large displays

## 🔧 Technical Details

### Data Sources
- **Primary**: Yahoo Finance API (free, no key required)
- **Fallback**: Finnhub API for enhanced reliability
- **Update Frequency**: Weekly data with real-time current price

### Performance Optimizations
- **Efficient Filtering**: Optimized data processing for smooth interactions
- **Memory Management**: Smart data loading and cleanup
- **Responsive Rendering**: Adaptive chart sizing based on device capabilities
- **Touch Optimization**: Hardware-accelerated animations and gestures

## 🎨 Customization

The chart supports extensive customization through:
- **Color Themes**: Risk-based color gradients with professional styling
- **Chart Types**: Scatter plot with customizable dot sizes and opacity
- **Data Display**: Configurable tooltip information and formatting
- **Export Options**: Multiple data export formats and selections

## 🔮 Future Enhancements

- [ ] Real-time price updates with WebSocket connections
- [ ] Multiple stock symbol support
- [ ] Custom risk calculation parameters
- [ ] Historical backtesting interface
- [ ] Portfolio-level risk analysis
- [ ] Social sharing of chart views
- [ ] Dark/light theme toggle
- [ ] Advanced technical indicator overlays

## 📈 Chart Navigation Guide

### Quick Start (Mobile)
1. Open chart → defaults to 2021-Present view
2. Swipe left/right on timeframe area to change periods
3. Tap any timeframe button for instant navigation
4. Use "Export CSV" to save current data

### Advanced Usage (Desktop)
1. Use keyboard shortcuts for rapid navigation
2. Enable "Brush Zoom" for precise selection
3. Toggle between linear/log scales as needed
4. Export filtered data for external analysis

## 💡 Performance Tips

- **Mobile**: Use shorter timeframes (2021-Present) for best performance
- **Desktop**: All timeframes perform well, use "All Data" for complete analysis
- **Large Datasets**: Chart shows performance warnings when appropriate
- **Export**: CSV export includes only currently filtered/visible data

## 🛠️ Development

### Component Structure
```
src/
├── app/
│   ├── api/
│   │   ├── nvda-data-yahoo/     # Primary data source
│   │   └── nvda-data/           # Fallback data source
│   ├── globals.css              # Custom animations & mobile styles
│   ├── layout.tsx               # Root layout with metadata
│   └── page.tsx                 # Home page
└── components/
    └── NVDARiskChart.tsx        # Main interactive chart component
```

### Key Features Implementation
- **Touch Gestures**: React touch event handlers with gesture recognition
- **Keyboard Shortcuts**: Global event listeners with conflict prevention
- **Data Filtering**: Memoized calculations for performance
- **Responsive Design**: CSS Grid and Flexbox with breakpoint optimization
- **Animations**: CSS transitions with reduced-motion support
- **Professional Charts**: Chart.js with zoom plugin for interactive visualization
- **SSR Compatibility**: Dynamic imports to prevent server-side rendering issues

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests for any improvements.

---

**Built with**: Next.js, React, Chart.js, TypeScript, Tailwind CSS
**Optimized for**: All devices, touch interfaces, keyboard navigation
**Accessibility**: WCAG 2.1 AA compliant with full keyboard support
