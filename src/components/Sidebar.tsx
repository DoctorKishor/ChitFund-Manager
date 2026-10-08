'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { canAccessTab, MainTabId } from '@/utils/rbac';
import { 
  LayoutDashboard, 
  Gavel, 
  Vault, 
  Users, 
  BarChart3, 
  Briefcase, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  User,
  Lock,
  MessageSquare,
  ShieldCheck,
  Settings
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export default function Sidebar({ activeTab, setActiveTab, mobileOpen = false, setMobileOpen }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { profile, signOut } = useAuth();

  const activeUserRole = profile?.role || 'subscriber';

  const navItems: { id: MainTabId; name: string; icon: any }[] = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'chits', name: 'Chits', icon: Briefcase },
    { id: 'members', name: 'Members', icon: Users },
    { id: 'communication', name: 'Communication', icon: MessageSquare },
    { id: 'auctions', name: 'Auctions', icon: Gavel },
    { id: 'reports', name: 'Reports', icon: BarChart3 },
    { id: 'cash', name: 'Treasury', icon: Vault },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const handleTabClick = (tabId: MainTabId) => {
    if (!canAccessTab(activeUserRole, tabId)) {
      return; // Block restricted roles from accessing tab
    }
    setActiveTab(tabId);
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  };

  return (
    <>
      {/* ── Mobile Slide-Over Drawer (md:hidden) ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMobileOpen && setMobileOpen(false)}
          />

          {/* Drawer Sheet */}
          <aside className="fixed inset-y-0 left-0 w-[280px] max-w-[85vw] bg-[#1D1D41] border-r border-[#27264E] text-[#AEABD8] flex flex-col justify-between z-50 shadow-2xl animate-in slide-in-from-left duration-200">
            <div>
              {/* Header */}
              <div className="h-20 flex items-center justify-between px-6 border-b border-[#27264E] bg-[#1D1D41]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9C2CF3] to-[#3A6FF9] flex items-center justify-center font-black text-white shadow-lg shadow-[#6359E9]/30 text-base">
                    CF
                  </div>
                  <div>
                    <span className="font-extrabold text-xl text-white tracking-tight block leading-none">
                      ChitFunds<span className="text-[#64CFF6]">.</span>
                    </span>
                    <span className="text-[10px] text-[#AEABD8] font-semibold tracking-wider uppercase">Fintech Portal</span>
                  </div>
                </div>
                <button 
                  onClick={() => setMobileOpen && setMobileOpen(false)}
                  className="p-2 rounded-xl bg-[#27264E] hover:bg-[#3A3A5A] text-[#AEABD8] hover:text-white transition-colors"
                  aria-label="Close navigation"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="mt-6 px-4 space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isRestricted = !canAccessTab(activeUserRole, item.id);

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      disabled={isRestricted}
                      className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                        isRestricted 
                          ? 'opacity-30 cursor-not-allowed text-gray-500 bg-[#27264E]/30' 
                          : isActive
                            ? 'bg-[#6359E9] text-white shadow-lg shadow-[#6359E9]/30'
                            : 'hover:bg-[#27264E] text-[#AEABD8] hover:text-white active:bg-[#3A3A5A]'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <Icon size={20} className={isActive ? 'text-white' : 'text-[#AEABD8]'} />
                        <span>{item.name}</span>
                      </div>
                      {isRestricted && (
                        <Lock size={14} className="text-gray-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Account Info & Logout in Mobile Drawer */}
            <div className="p-4 border-t border-[#27264E] bg-[#141332]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#9C2CF3] to-[#3A6FF9] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                    {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col overflow-hidden text-left">
                    <span className="text-sm font-bold text-white truncate">
                      {profile?.fullName || 'User'}
                    </span>
                    <span className="text-xs text-[#AEABD8] truncate capitalize font-medium">
                      {activeUserRole}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => signOut()}
                  title="Sign Out"
                  className="p-2.5 rounded-xl text-[#AEABD8] hover:text-[#E41414] hover:bg-[#E41414]/15 bg-[#27264E] border border-[#3A3A5A] transition-all shrink-0 active:scale-95"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Desktop Fixed Sidebar (hidden on mobile, visible on md+) ── */}
      <aside 
        className={`hidden md:flex sticky top-0 left-0 h-screen bg-white border-r border-slate-200/80 text-slate-700 flex-col justify-between transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        } z-30 shrink-0 select-none shadow-xs`}
        data-purpose="app-sidebar"
      >
        {/* Header section with Brand Logo */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-md shadow-brand-500/20 text-white font-black text-sm tracking-tight font-display">
                  CF
                </div>
                <div>
                  <div className="font-display font-bold text-base text-slate-900 tracking-tight leading-none flex items-center gap-0.5">
                    ChitFunds<span className="text-brand-600">.Admin</span>
                  </div>
                </div>
              </div>
            )}
            {isCollapsed && (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-md shadow-brand-500/20 text-white font-black text-sm tracking-tight font-display mx-auto">
                CF
              </div>
            )}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          {/* Navigation Groups */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {/* 1. Main Management */}
            <div>
              {!isCollapsed && (
                <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Main Management</p>
              )}
              <nav className="space-y-1">
                {[
                  { id: 'dashboard' as MainTabId, name: 'Overview', icon: LayoutDashboard },
                  { id: 'chits' as MainTabId, name: 'Chits / Groups', icon: Briefcase, badge: 'Active' },
                  { id: 'members' as MainTabId, name: 'Members Directory', icon: Users },
                  { id: 'auctions' as MainTabId, name: 'Auctions & Bidding', icon: Gavel, dot: 'amber' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isRestricted = !canAccessTab(activeUserRole, item.id);

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      disabled={isRestricted}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group relative cursor-pointer ${
                        isRestricted
                          ? 'opacity-30 cursor-not-allowed text-slate-400'
                          : isActive
                          ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs shadow-brand-100'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                      }`}
                    >
                      <Icon size={17} className={isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'} />
                      {!isCollapsed && (
                        <>
                          <span className="truncate">{item.name}</span>
                          {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />}
                          {item.badge && !isActive && (
                            <span className="ml-auto text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                              {item.badge}
                            </span>
                          )}
                          {item.dot && !isActive && (
                            <span className="ml-auto w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          )}
                        </>
                      )}
                      {isRestricted && !isCollapsed && <Lock size={13} className="text-slate-400 ml-auto" />}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* 2. Financials */}
            <div>
              {!isCollapsed && (
                <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Financials</p>
              )}
              <nav className="space-y-1">
                {[
                  { id: 'cash' as MainTabId, name: 'Treasury', icon: Vault },
                  { id: 'reports' as MainTabId, name: 'Reports & Analytics', icon: BarChart3 },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isRestricted = !canAccessTab(activeUserRole, item.id);

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      disabled={isRestricted}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group relative cursor-pointer ${
                        isRestricted
                          ? 'opacity-30 cursor-not-allowed text-slate-400'
                          : isActive
                          ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs shadow-brand-100'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                      }`}
                    >
                      <Icon size={17} className={isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'} />
                      {!isCollapsed && (
                        <>
                          <span className="truncate">{item.name}</span>
                          {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />}
                        </>
                      )}
                      {isRestricted && !isCollapsed && <Lock size={13} className="text-slate-400 ml-auto" />}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* 3. System */}
            <div>
              {!isCollapsed && (
                <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">System</p>
              )}
              <nav className="space-y-1">
                {[
                  { id: 'communication' as MainTabId, name: 'Communication', icon: MessageSquare },
                  { id: 'settings' as MainTabId, name: 'Portal Settings', icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isRestricted = !canAccessTab(activeUserRole, item.id);

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      disabled={isRestricted}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group relative cursor-pointer ${
                        isRestricted
                          ? 'opacity-30 cursor-not-allowed text-slate-400'
                          : isActive
                          ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs shadow-brand-100'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                      }`}
                    >
                      <Icon size={17} className={isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'} />
                      {!isCollapsed && (
                        <>
                          <span className="truncate">{item.name}</span>
                          {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />}
                        </>
                      )}
                      {isRestricted && !isCollapsed && <Lock size={13} className="text-slate-400 ml-auto" />}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          {!isCollapsed ? (
            <div className="flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-200/70 shadow-xs">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-brand-600 text-white font-semibold text-xs flex items-center justify-center font-display shadow">
                  {profile?.fullName 
                    ? profile.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                    : 'CF'}
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-slate-900 truncate">
                  {profile?.fullName || 'Dr. Kishor Anbazhakan'}
                </h4>
                <p className="text-[11px] text-slate-500 font-mono truncate">
                  {activeUserRole.charAt(0).toUpperCase() + activeUserRole.slice(1)} · {profile?.phoneNumber || 'Admin'}
                </p>
              </div>
              <button 
                onClick={() => signOut()}
                className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-lg hover:bg-rose-50"
                title="Log out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-semibold text-xs flex items-center justify-center font-display shadow">
                  {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <button 
                onClick={() => signOut()}
                className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-lg"
                title="Log out"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
