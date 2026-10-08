import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import { AuthProvider } from "@/context/AuthContext";
import { MaintenanceProvider } from "@/context/MaintenanceContext";
import { OrganizationProvider } from "@/context/OrganizationContext";
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

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#141332",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Chit Funds Manager - Midnight Workspace",
  description: "Enterprise Chit Fund Management & Digital Banking Treasury",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Chit Funds Manager",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-800 flex flex-col selection:bg-brand-500 selection:text-white">
        <ServiceWorkerCleanup />
        <NetworkStatusBanner />
        <AuthProvider>
          <OrganizationProvider>
            <MaintenanceProvider>
              <WalletProvider>
                {children}
              </WalletProvider>
            </MaintenanceProvider>
          </OrganizationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
