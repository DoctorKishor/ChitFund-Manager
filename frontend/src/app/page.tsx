'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopStatusRibbon from '@/components/TopStatusRibbon';
import ProfileSimulationSwitcher from '@/components/ProfileSimulationSwitcher';
import DashboardContent from '@/components/DashboardContent';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return 'Workspace Dashboard';
      case 'chits':
        return 'Chit Groups & Enrollment';
      case 'members':
        return 'Member Matrix & Broadcaster';
      case 'auctions':
        return 'Live Bidding Engine';
      case 'reports':
        return 'Reports Center';
      case 'cash':
        return 'Cash Vault & Treasury Ledger';
      default:
        return 'Chit Funds Workspace';
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f2f3f8] text-gray-900 font-sans antialiased">
      {/* 1. Sidebar Navigation Viewport (Sticky & Collapsible) */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Bar */}
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 sticky top-0 z-30">
          <div>
            <h1 className="font-bold text-sm md:text-base text-gray-900 tracking-tight uppercase">
              {getTabTitle(activeTab)}
            </h1>
          </div>

          {/* 3. Profile Simulation Switcher overlay */}
          <ProfileSimulationSwitcher />
        </header>

        {/* 2. Main Content Board Canvas (Wide, auto-reflowing container) */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto w-full max-w-[1600px] mx-auto">
          {/* Top Status Ribbon (Multi-wallet summary asset pills) */}
          <TopStatusRibbon />

          {/* Dynamic Content Panel Board */}
          <div className="w-full">
            <DashboardContent activeTab={activeTab} />
          </div>
        </main>
      </div>
    </div>
  );
}
