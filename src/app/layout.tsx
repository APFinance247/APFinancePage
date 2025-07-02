import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NVDA Daily Risk Analysis Chart",
  description: "Interactive daily risk analysis chart for NVIDIA stock with color-coded risk levels based on moving averages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-900 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
