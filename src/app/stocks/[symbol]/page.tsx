import StockRiskChart from '@/components/StockRiskChart';
import { STOCK_CONFIGS } from '@/types/stock-analysis';
import type { Metadata } from 'next';

type PageProps = {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();
  const stockConfig = STOCK_CONFIGS[upperSymbol];
  const companyName = stockConfig?.name || upperSymbol;

  return {
    title: `${companyName} (${upperSymbol}) Risk Analysis`,
    description: `Historical risk analysis and price chart for ${companyName} (${upperSymbol}).`,
  };
}

export default async function StockPage({ params }: PageProps) {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();
  const stockConfig = STOCK_CONFIGS[upperSymbol];
  
  return (
    <StockRiskChart 
      symbol={upperSymbol}
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