import type { Metadata } from "next";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";

import { Providers } from "@/components/providers";
import { WalletBar } from "@/components/wallet-bar";

export const metadata: Metadata = {
  title: "BharatMarket",
  description: "Sports-first decentralized prediction markets on Polygon Amoy."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="text-slate-100">
        <Providers>
          <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <WalletBar />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
