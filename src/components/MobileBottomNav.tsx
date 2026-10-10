'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { triggerHapticFeedback } from '@/utils/haptics';
import { canAccessTab, MainTabId } from '@/utils/rbac';
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Gavel, 
  Plus,
  MoreHorizontal,
  Vault,
  BarChart3,
  MessageSquare,
  Settings,
  X,
  Coins,
  Check,
  Landmark,
  MinusCircle,
  Bell,
  ChevronRight
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenDrawer?: () => void;
  onQuickRecord?: () => void;
}

interface MoreNavOption {
  id: MainTabId;
  name: string;
  desc: string;
  icon: any;
  iconColor: string;
  bgColor: string;
}

export default function MobileBottomNav({ 
  activeTab, 
  setActiveTab, 
  onOpenDrawer,
  onQuickRecord 
}: MobileBottomNavProps) {
  const { profile } = useAuth();
  const activeUserRole = profile?.role || 'subscriber';
  const isSubscriber = activeUserRole === 'subscriber';

  // Bottom Sheet State for "More" Navigation
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  // Stack of 4 Cards State for Center "+" Button
  const [isActionStackOpen, setIsActionStackOpen] = useState(false);

  const handleToggleActionStack = () => {
    triggerHapticFeedback('light');
    setIsMoreSheetOpen(false);
    setIsActionStackOpen(prev => !prev);
  };

  const handleActionClick = (actionType: 'collect' | 'atm' | 'personal_draw' | 'remind') => {
    triggerHapticFeedback('light');
    setIsActionStackOpen(false);

    if (actionType === 'collect') {
      if (onQuickRecord) {
        onQuickRecord();
      } else {
        window.dispatchEvent(new CustomEvent('open-quick-collect'));
      }
    } else if (actionType === 'atm') {
      window.dispatchEvent(new CustomEvent('open-quick-atm'));
    } else if (actionType === 'personal_draw') {
      window.dispatchEvent(new CustomEvent('open-quick-personal-draw'));
    } else if (actionType === 'remind') {
      window.dispatchEvent(new CustomEvent('open-send-reminders'));
    }
  };

  const handleSelectTab = (tabId: string) => {
    triggerHapticFeedback('light');
    setActiveTab(tabId);
    setIsMoreSheetOpen(false);
    setIsActionStackOpen(false);
  };

  // Full list of secondary tabs available inside the "More" bottom sheet
  const moreOptions: MoreNavOption[] = [
    {
      id: 'members',
      name: 'Members',
      desc: 'Directory & Passbooks',
      icon: Users,
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50 border-indigo-100',
    },
    {
      id: 'cash',
      name: 'Treasury',
      desc: 'Cash Box & 3 Banks',
      icon: Vault,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50 border-amber-100',
    },
    {
      id: 'reports',
      name: 'Reports',
      desc: 'P&L, Dues & Export',
      icon: BarChart3,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50 border-emerald-100',
    },
    {
      id: 'communication',
      name: 'Broadcast',
      desc: 'WhatsApp & SMS Alerts',
      icon: MessageSquare,
      iconColor: 'text-sky-600',
      bgColor: 'bg-sky-50 border-sky-100',
    },
    {
      id: 'settings',
      name: 'Settings',
      desc: 'Roles & Admin Controls',
      icon: Settings,
      iconColor: 'text-slate-600',
      bgColor: 'bg-slate-100 border-slate-200',
    },
  ];

  // Filter based on user RBAC permissions
  const accessibleMoreOptions = moreOptions.filter(opt => canAccessTab(activeUserRole, opt.id));

  // Determine which icon and label to show on the 5th tab button
  const getFifthTabInfo = () => {
    const activeMoreOption = moreOptions.find(opt => opt.id === activeTab);
    if (activeMoreOption) {
      return {
        label: activeMoreOption.name,
        icon: activeMoreOption.icon,
        isActive: true,
      };
    }
    return {
      label: 'More',
      icon: MoreHorizontal,
      isActive: false,
    };
  };

  const fifthTab = getFifthTabInfo();
  const FifthTabIcon = fifthTab.icon;

  return (
    <>
      {/* ── Quick Actions Stack Backdrop ── */}
      {isActionStackOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 transition-opacity animate-in fade-in duration-200 md:hidden"
          onClick={() => setIsActionStackOpen(false)}
        />
      )}

      {/* ── Quick Actions Stack of 4 Cards ── */}
      {isActionStackOpen && (
        <div 
          className="fixed bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4.25rem))] inset-x-3 sm:inset-x-6 max-w-sm mx-auto z-50 flex flex-col gap-2 animate-in slide-in-from-bottom-5 fade-in duration-200 md:hidden select-none"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-2 pb-0.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-white drop-shadow-md flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
              Quick Actions
            </span>
            <button
              type="button"
              onClick={() => setIsActionStackOpen(false)}
              className="text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2.5 py-0.5 rounded-full cursor-pointer"
            >
              <span>Dismiss</span>
              <X size={12} />
            </button>
          </div>

          {/* Card 1: Quick Collect Payment */}
          <button
            type="button"
            onClick={() => handleActionClick('collect')}
            className="w-full bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-slate-200/90 shadow-xl shadow-slate-950/20 flex items-center justify-between gap-3 text-left active:scale-[0.98] transition-all cursor-pointer hover:bg-white hover:border-emerald-300 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0 group-hover:scale-105 transition-transform">
                <Coins size={20} className="stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 truncate">
                    Quick Collect Payment
                  </span>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                    Collect
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                  Record subscriber cash or bank installment
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>

          {/* Card 2: ATM Withdrawal */}
          <button
            type="button"
            onClick={() => handleActionClick('atm')}
            className="w-full bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-slate-200/90 shadow-xl shadow-slate-950/20 flex items-center justify-between gap-3 text-left active:scale-[0.98] transition-all cursor-pointer hover:bg-white hover:border-sky-300 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0 group-hover:scale-105 transition-transform">
                <Landmark size={20} className="stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 truncate">
                    ATM Withdrawal
                  </span>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">
                    Relocate
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                  Debit bank account to Physical Cash Box
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>

          {/* Card 3: Personal Expense */}
          <button
            type="button"
            onClick={() => handleActionClick('personal_draw')}
            className="w-full bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-slate-200/90 shadow-xl shadow-slate-950/20 flex items-center justify-between gap-3 text-left active:scale-[0.98] transition-all cursor-pointer hover:bg-white hover:border-rose-300 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/25 shrink-0 group-hover:scale-105 transition-transform">
                <MinusCircle size={20} className="stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 truncate">
                    Personal Expense
                  </span>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                    Spend
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                  Log petrol, office or organizer cash draw
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>

          {/* Card 4: Send Reminders */}
          <button
            type="button"
            onClick={() => handleActionClick('remind')}
            className="w-full bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-slate-200/90 shadow-xl shadow-slate-950/20 flex items-center justify-between gap-3 text-left active:scale-[0.98] transition-all cursor-pointer hover:bg-white hover:border-indigo-300 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0 group-hover:scale-105 transition-transform">
                <Bell size={20} className="stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 truncate">
                    Send Reminders
                  </span>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                    WhatsApp
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                  Send 1-click WhatsApp alerts to pending dues
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        </div>
      )}

      {/* ── Fixed Bottom Tab Bar ── */}
      <nav 
        className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-40 shadow-nav md:hidden" 
        data-purpose="tab-bar-navigation"
      >
        <div className="flex items-center justify-between relative max-w-md mx-auto">
          {/* Tab 1: Overview Dashboard */}
          <button
            type="button"
            onClick={() => handleSelectTab('dashboard')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
              activeTab === 'dashboard' ? 'text-brand-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <LayoutDashboard 
                size={20} 
                strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} 
                className={activeTab === 'dashboard' ? 'fill-current' : ''} 
              />
            </div>
            <span className="text-[10px] mt-1 tracking-tight">
              Overview
            </span>
          </button>

          {/* Tab 2: Chits */}
          <button
            type="button"
            onClick={() => handleSelectTab('chits')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
              activeTab === 'chits' ? 'text-brand-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <Briefcase size={20} strokeWidth={activeTab === 'chits' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] mt-1 tracking-tight">
              Chits
            </span>
          </button>

          {/* Center Elevated Floating Action Button (Quick Actions Trigger) */}
          {!isSubscriber && (
            <div className="relative -top-5 flex justify-center flex-1">
              <button
                onClick={handleToggleActionStack}
                aria-label={isActionStackOpen ? "Close Quick Actions" : "Open Quick Actions"}
                className={`w-12 h-12 rounded-full active:scale-95 text-white shadow-float flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg z-50 ${
                  isActionStackOpen
                    ? 'bg-slate-900 rotate-45 ring-4 ring-brand-500/30 shadow-slate-900/40'
                    : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/35'
                }`}
                type="button"
              >
                <Plus size={22} className={`stroke-[2.5] transition-transform duration-300 ${isActionStackOpen ? 'rotate-90' : ''}`} />
              </button>
            </div>
          )}

          {/* Tab 3: Auctions */}
          <button
            type="button"
            onClick={() => handleSelectTab('auctions')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
              activeTab === 'auctions' ? 'text-brand-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <Gavel size={20} strokeWidth={activeTab === 'auctions' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] mt-1 tracking-tight">
              Auctions
            </span>
          </button>

          {/* Tab 4: More / Dynamic Active Secondary Tab */}
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback('light');
              setIsActionStackOpen(false);
              setIsMoreSheetOpen(true);
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer relative ${
              fifthTab.isActive ? 'text-brand-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div className="w-6 h-6 flex items-center justify-center relative">
              <FifthTabIcon size={20} strokeWidth={fifthTab.isActive ? 2.5 : 2} />
              {/* Subtle indicator dot if a secondary tab is active */}
              {fifthTab.isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-600 absolute -top-0.5 -right-0.5" />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight truncate max-w-[54px]">
              {fifthTab.label}
            </span>
          </button>
        </div>
      </nav>

      {/* ── Option 1: "More" Navigation Bottom Sheet ── */}
      {isMoreSheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMoreSheetOpen(false)}
          />

          {/* Bottom Sheet Modal Sheet */}
          <div 
            className="relative bg-white rounded-t-3xl border-t border-slate-200 z-50 p-4 sm:p-5 pb-[max(2rem,env(safe-area-inset-bottom))] max-w-lg mx-auto w-full shadow-2xl animate-in slide-in-from-bottom duration-200 space-y-4"
          >
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />

            {/* Header */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  All Portal Workspaces
                </h3>
                <p className="text-[11px] text-slate-500">
                  Navigate across all desktop tabs
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsMoreSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Grid of Workspaces */}
            <div className="grid grid-cols-2 gap-2.5">
              {accessibleMoreOptions.map((opt) => {
                const Icon = opt.icon;
                const isCurrent = activeTab === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectTab(opt.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between min-h-[82px] active:scale-[0.98] ${
                      isCurrent
                        ? 'bg-brand-50/80 border-brand-500 ring-2 ring-brand-500/20 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${opt.bgColor}`}>
                        <Icon size={17} className={opt.iconColor} />
                      </div>
                      {isCurrent && (
                        <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0">
                          <Check size={12} className="stroke-[3]" />
                        </span>
                      )}
                    </div>

                    <div className="mt-2 min-w-0">
                      <span className={`text-xs block truncate ${isCurrent ? 'font-black text-brand-950' : 'font-bold text-slate-900'}`}>
                        {opt.name}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate block">
                        {opt.desc}
                      </span>
                    </div>
                  </button>
                );
              })}

              {/* Quick Collection Shortcut Tile */}
              {!isSubscriber && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreSheetOpen(false);
                    handleActionClick('collect');
                  }}
                  className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[82px] active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center border bg-emerald-100 border-emerald-200 text-emerald-700">
                      <Coins size={17} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-200/60 px-1.5 py-0.2 rounded-md">
                      Action
                    </span>
                  </div>

                  <div className="mt-2 min-w-0">
                    <span className="text-xs font-black text-emerald-950 block truncate">
                      Record Payment
                    </span>
                    <span className="text-[10px] text-emerald-700 truncate block">
                      Fast Universal Modal
                    </span>
                  </div>
                </button>
              )}
            </div>

            {/* User Session Info footer */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'A'}
                </div>
                <span className="font-semibold text-slate-800 truncate">
                  {profile?.fullName || 'Organizer'}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                {profile?.role || 'Admin'}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
