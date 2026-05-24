import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";

import { Providers } from "@/components/providers";
import { WalletBar } from "@/components/wallet-bar";

export const metadata: Metadata = {
  title: "BharatMarket",
  description: "Sports-first decentralized prediction markets on Polygon Amoy."
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap"
});

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${inter.variable} ${spaceGrotesk.variable} text-slate-100`}>
        <Providers>
          <div className="mx-auto min-h-screen max-w-[1440px] px-3 py-4 sm:px-5 lg:px-8">
            <WalletBar />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
