import StockRiskChart from '@/components/StockRiskChart';
import { STOCK_CONFIGS } from '@/types/stock-analysis';
import type { Metadata } from 'next';

interface StockPageProps {
  params: {
    symbol: string;
  };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: StockPageProps): Promise<Metadata> {
  const symbol = params.symbol.toUpperCase();
  const stockConfig = STOCK_CONFIGS[symbol];
  const companyName = stockConfig?.name || symbol;

  return {
    title: `${companyName} (${symbol}) Risk Analysis`,
    description: `Historical risk analysis and price chart for ${companyName} (${symbol}).`,
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