import StockRiskChart from '@/components/StockRiskChart';

export default function Home() {
  return (
    <div>
      {/* NVDA Chart (default) */}
      <StockRiskChart symbol="NVDA" useCSV={true} />
    </div>
  );
}
