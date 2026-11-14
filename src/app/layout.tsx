import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import { AuthProvider } from "@/context/AuthContext";
import { MaintenanceProvider } from "@/context/MaintenanceContext";
import { OrganizationProvider } from "@/context/OrganizationContext";
import { SystemSettingsProvider } from "@/context/SystemSettingsContext";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import NetworkStatusBanner from "@/components/NetworkStatusBanner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0B0F19",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Chit Funds Manager",
  description: "Enterprise Chit Fund Management & Digital Banking Treasury",
  applicationName: "Chit Funds Manager",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
      className={`${inter.variable} ${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-800 flex flex-col selection:bg-brand-500 selection:text-white">
        <ServiceWorkerRegistration />
        <NetworkStatusBanner />
        <AuthProvider>
          <OrganizationProvider>
            <SystemSettingsProvider>
              <MaintenanceProvider>
                <WalletProvider>
                  {children}
                </WalletProvider>
              </MaintenanceProvider>
            </SystemSettingsProvider>
          </OrganizationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
