import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SimulationProvider } from "@/context/SimulationContext";
import { WalletProvider } from "@/context/WalletContext";
import ServiceWorkerCleanup from "@/components/ServiceWorkerCleanup";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chit Funds Manager - Admin Workspace",
  description: "Multi-admin chit fund dashboard with real-time balance sync and role simulation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-slate-950 text-slate-100 flex flex-col">
        <ServiceWorkerCleanup />
        <SimulationProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </SimulationProvider>
      </body>
    </html>
  );
}
