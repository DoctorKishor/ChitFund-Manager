import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import { AuthProvider } from "@/context/AuthContext";
import { MaintenanceProvider } from "@/context/MaintenanceContext";
import ServiceWorkerCleanup from "@/components/ServiceWorkerCleanup";
import NetworkStatusBanner from "@/components/NetworkStatusBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chit Funds Manager - Workspace",
  description: "Chit fund workspace with real-time balance sync",
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
        <NetworkStatusBanner />
        <AuthProvider>
          <MaintenanceProvider>
            <WalletProvider>
              {children}
            </WalletProvider>
          </MaintenanceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
