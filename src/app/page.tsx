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
import { AlertTriangle, Wrench, Menu, Search, Bell, Settings } from 'lucide-react';

export default function Home() {
  const { user, profile, loading } = useAuth();
  const { isMaintenanceMode } = useMaintenance();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141332] flex items-center justify-center text-white px-4 selection:bg-[#6359E9]">
        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#9C2CF3] to-[#3A6FF9] flex items-center justify-center font-black text-white text-lg shadow-xl shadow-[#6359E9]/30 animate-pulse">
            CF
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-4 h-4 border-2 border-[#64CFF6] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[#AEABD8] font-semibold tracking-tight">Verifying Midnight Session...</span>
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
        return 'Overview Dashboard';
      case 'chits':
        return (
          <>
            <span className="sm:hidden">Chit Groups</span>
            <span className="hidden sm:inline">Chit Groups &amp; Enrollment</span>
          </>
        );
      case 'members':
        return (
          <>
            <span className="sm:hidden">Members</span>
            <span className="hidden sm:inline">Members &amp; Access Control</span>
          </>
        );
      case 'communication':
        return (
          <>
            <span className="sm:hidden">Broadcaster</span>
            <span className="hidden sm:inline">Communication Broadcaster</span>
          </>
        );
      case 'auctions':
        return (
          <>
            <span className="sm:hidden">Live Bidding</span>
            <span className="hidden sm:inline">Live Bidding Arena</span>
          </>
        );
      case 'reports':
        return 'Reports Center';
      case 'cash':
        return (
          <>
            <span className="sm:hidden">Treasury</span>
            <span className="hidden sm:inline">Treasury &amp; Vault Ledger</span>
          </>
        );
      case 'users':
        return (
          <>
            <span className="sm:hidden">Members</span>
            <span className="hidden sm:inline">Members &amp; Access Control</span>
          </>
        );
      case 'settings':
        return 'Settings & Profile';
      default:
        return 'Chit Funds Workspace';
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
      {/* 1. Sidebar Navigation (Sticky on Desktop, Slide-over Drawer on Mobile) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        mobileOpen={mobileDrawerOpen} 
        setMobileOpen={setMobileDrawerOpen} 
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        
        {/* Top Header Bar matching Stitch top-navigation */}
        <header className="h-16 border-b border-slate-200/80 bg-white hidden md:flex items-center justify-between px-4 sm:px-8 sticky top-0 z-20 shadow-xs" data-purpose="top-navigation">
          {/* Left: Mobile Drawer Trigger + Page Heading */}
          <div className="flex items-center space-x-3 min-w-0">
            <button 
              onClick={() => setMobileDrawerOpen(true)}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors md:hidden"
              aria-label="Open navigation drawer"
            >
              <Menu size={18} />
            </button>

            <div className="flex items-center gap-2.5">
              <h1 className="font-display font-bold text-base sm:text-lg text-slate-900 tracking-tight flex items-center gap-2 truncate">
                {getTabTitle(activeTab)}
                {activeTab === 'dashboard' && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 hidden sm:inline-flex">
                    Live Cycle
                  </span>
                )}
              </h1>
              {isMaintenanceMode && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                  <Wrench size={10} className="text-amber-500" /> Maintenance
                </span>
              )}
            </div>
          </div>

          {/* Right Header Actions: Font Size Switcher + Profile Badge */}
          <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
            <FontSizeSwitcher />

            <div className="hidden sm:block">
              <UserProfileBadge />
            </div>

            {/* Mobile Profile Avatar */}
            <div className="sm:hidden w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>
        </header>

        {/* Maintenance Alert Ribbon for Admin */}
        {isMaintenanceMode && (
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs sticky top-16 z-20">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 animate-bounce" />
              <span>
                <strong>System Maintenance Mode is ON:</strong> Non-admin users are currently redirected to the Maintenance Notice.
              </span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-md text-slate-950">
              Admin Exclusive Access
            </span>
          </div>
        )}

        {/* 2. Main Content Board Canvas */}
        <main className="flex-1 p-4 sm:p-8 pb-24 sm:pb-8 space-y-6 overflow-y-auto w-full max-w-[1700px] mx-auto bg-slate-50" data-purpose="dashboard-workspace">
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

