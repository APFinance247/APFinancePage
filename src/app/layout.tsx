import type { Metadata } from "next";
import "./globals.css";
import StockSelector from "@/components/StockSelector";

export const metadata: Metadata = {
  title: "Stock Risk Analysis Chart",
  description: "Interactive daily risk analysis chart for various stocks with color-coded risk levels based on moving averages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-900 text-white antialiased">
        <StockSelector />
        <main>{children}</main>
      </body>
    </html>
  );
}
