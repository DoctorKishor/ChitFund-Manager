'use client';

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Gavel, 
  Plus 
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenDrawer: () => void;
  onQuickRecord?: () => void;
}

export default function MobileBottomNav({ 
  activeTab, 
  setActiveTab, 
  onOpenDrawer,
  onQuickRecord 
}: MobileBottomNavProps) {
  const { profile } = useAuth();
  const isSubscriber = profile?.role === 'subscriber';

  const handleTriggerQuickRecord = () => {
    if (onQuickRecord) {
      onQuickRecord();
    } else {
      window.dispatchEvent(new CustomEvent('open-quick-collect'));
    }
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-40 shadow-nav md:hidden" data-purpose="tab-bar-navigation">
      <div className="flex items-center justify-between relative max-w-md mx-auto">
        {/* Tab 1: Dashboard (Active) */}
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
            activeTab === 'dashboard' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <LayoutDashboard size={20} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} className={activeTab === 'dashboard' ? 'fill-current' : ''} />
          </div>
          <span className={`text-[10px] mt-1 tracking-tight ${activeTab === 'dashboard' ? 'font-bold' : 'font-medium'}`}>
            Overview
          </span>
        </button>

        {/* Tab 2: Chits */}
        <button
          type="button"
          onClick={() => setActiveTab('chits')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
            activeTab === 'chits' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <Briefcase size={20} strokeWidth={activeTab === 'chits' ? 2.5 : 2} />
          </div>
          <span className={`text-[10px] mt-1 tracking-tight ${activeTab === 'chits' ? 'font-bold' : 'font-medium'}`}>
            Chits
          </span>
        </button>

        {/* Center Floating Action Button (Quick New Transaction / Record) */}
        {!isSubscriber && (
          <div className="relative -top-5 flex justify-center flex-1">
            <button
              onClick={handleTriggerQuickRecord}
              aria-label="Add transaction or entry"
              className="w-12 h-12 rounded-full bg-brand-600 hover:bg-brand-700 active:scale-95 text-white shadow-float flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-brand-500/35"
              type="button"
            >
              <Plus size={22} className="stroke-[2.5]" />
            </button>
          </div>
        )}

        {/* Tab 3: Auctions */}
        <button
          type="button"
          onClick={() => setActiveTab('auctions')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
            activeTab === 'auctions' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <Gavel size={20} strokeWidth={activeTab === 'auctions' ? 2.5 : 2} />
          </div>
          <span className={`text-[10px] mt-1 tracking-tight ${activeTab === 'auctions' ? 'font-bold' : 'font-medium'}`}>
            Auctions
          </span>
        </button>

        {/* Tab 4: Members / Menu */}
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
            activeTab === 'members' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <Users size={20} strokeWidth={activeTab === 'members' ? 2.5 : 2} />
          </div>
          <span className={`text-[10px] mt-1 tracking-tight ${activeTab === 'members' ? 'font-bold' : 'font-medium'}`}>
            Members
          </span>
        </button>
      </div>
    </nav>
  );
}
