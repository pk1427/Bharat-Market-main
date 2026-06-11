import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";

import { Providers } from "@/components/providers";
import { WalletBar } from "@/components/wallet-bar";

export const metadata: Metadata = {
  title: "BharatMarket",
  description: "Sports-first decentralized prediction markets on Polygon Amoy."
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap"
});

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${geist.variable} ${geistMono.variable} text-[color:var(--text-primary)]`}>
        <Providers>
          <div className="mx-auto min-h-screen max-w-[1440px] px-3 pb-4 sm:px-5 lg:px-8">
            <WalletBar />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
