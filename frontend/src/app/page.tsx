'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import MobileBottomNav from '@/components/MobileBottomNav';
import UserProfileBadge from '@/components/UserProfileBadge';
import FontSizeSwitcher from '@/components/FontSizeSwitcher';
import DashboardContent from '@/components/DashboardContent';
import AuthScreen from '@/components/AuthScreen';
import SubscriberPortal from '@/components/SubscriberPortal';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import { useAuth } from '@/context/AuthContext';
import { useMaintenance } from '@/context/MaintenanceContext';
import { AlertTriangle, Wrench } from 'lucide-react';

export default function Home() {
  const { user, profile, loading } = useAuth();
  const { isMaintenanceMode } = useMaintenance();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-white px-4 selection:bg-indigo-500">
        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-black text-white text-base shadow-xl shadow-indigo-600/30 animate-pulse">
            CF
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400 font-medium tracking-tight font-mono">Verifying Session...</span>
          </div>
        </div>
      </div>
    );
  }

  // 1. If maintenance mode is active, block anyone who is NOT an admin
  if (isMaintenanceMode && profile?.role !== 'admin') {
    return <MaintenanceScreen />;
  }

  if (!user && !profile) {
    return <AuthScreen />;
  }

  // DEDICATED SUBSCRIBER PORTAL FOR SUBSCRIBERS
  if (profile?.role === 'subscriber') {
    return <SubscriberPortal />;
  }

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return 'Workspace Dashboard';
      case 'chits':
        return 'Chit Groups & Enrollment';
      case 'members':
        return 'Members & Access Control';
      case 'communication':
        return 'Communication & WhatsApp Broadcaster';
      case 'auctions':
        return 'Live Bidding Engine';
      case 'reports':
        return 'Reports Center';
      case 'cash':
        return 'Treasury & Vault Ledger';
      case 'users':
        return 'Members & Access Control';
      case 'settings':
        return 'Settings & Profile Management';
      default:
        return 'Chit Funds Workspace';
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f2f3f8] text-gray-900 font-sans antialiased">
      {/* 1. Sidebar Navigation (Sticky on Desktop, Slide-over Drawer on Mobile) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        mobileOpen={mobileDrawerOpen}
        setMobileOpen={setMobileDrawerOpen}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Bar */}
        <header className="h-14 sm:h-16 border-b border-gray-200 bg-white flex items-center justify-between px-3.5 sm:px-6 sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center space-x-2.5 min-w-0">
            <h1 className="font-bold text-xs sm:text-base text-gray-900 tracking-tight uppercase truncate">
              {getTabTitle(activeTab)}
            </h1>
            {isMaintenanceMode && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                <Wrench size={10} className="text-amber-700" /> Maintenance Active
              </span>
            )}
          </div>

          {/* Right Header Actions: Font Scale Switcher + Authenticated User Profile (Desktop/Tablet) */}
          <div className="flex items-center space-x-2 sm:space-x-3.5 shrink-0">
            <FontSizeSwitcher />
            <div className="hidden md:block">
              <UserProfileBadge />
            </div>
          </div>
        </header>

        {/* Maintenance Alert Ribbon for Admin */}
        {isMaintenanceMode && (
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs sticky top-14 sm:top-16 z-20">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 animate-bounce" />
              <span>
                <strong>System Maintenance Mode is ON:</strong> Non-admin users (Subscribers &amp; Managers) are currently redirected to the Maintenance Notice.
              </span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-md text-slate-950">
              Admin Exclusive Access
            </span>
          </div>
        )}

        {/* 2. Main Content Board Canvas (Wide on desktop, touch-friendly with bottom-safe padding on mobile) */}
        <main className="flex-1 p-3.5 sm:p-6 pb-24 sm:pb-6 space-y-4 sm:space-y-6 overflow-y-auto w-full max-w-[1600px] mx-auto">
          {/* Dynamic Content Panel Board */}
          <div className="w-full">
            <DashboardContent activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        </main>

        {/* 3. Mobile Bottom Navigation Bar (Fixed bottom on smartphone screens) */}
        <MobileBottomNav 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onOpenDrawer={() => setMobileDrawerOpen(true)} 
        />
      </div>
    </div>
  );
}

