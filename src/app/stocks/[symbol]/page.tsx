import StockRiskChart from '@/components/StockRiskChart';
import { STOCK_CONFIGS } from '@/types/stock-analysis';

interface StockPageProps {
  params: {
    symbol: string;
  };
}

export default function StockPage({ params }: StockPageProps) {
  const symbol = params.symbol.toUpperCase();
  const stockConfig = STOCK_CONFIGS[symbol];
  
  return (
    <StockRiskChart 
      symbol={symbol}
      companyName={stockConfig?.name}
    />
  );
}

// Generate static paths for known stocks
export async function generateStaticParams() {
  return Object.keys(STOCK_CONFIGS).map((symbol) => ({
    symbol: symbol.toLowerCase(),
  }));
} 