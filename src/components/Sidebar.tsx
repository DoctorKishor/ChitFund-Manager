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
        className={`hidden md:flex sticky top-0 left-0 h-screen bg-[#1D1D41] border-r border-[#27264E] text-[#AEABD8] flex-col justify-between transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        } z-40 shrink-0`}
      >
        {/* Header section with Logo */}
        <div>
          <div className="h-20 flex items-center justify-between px-6 border-b border-[#27264E] bg-[#1D1D41]">
            {!isCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#9C2CF3] to-[#3A6FF9] flex items-center justify-center font-black text-white shadow-lg shadow-[#6359E9]/30 text-sm">
                  CF
                </div>
                <div>
                  <span className="font-extrabold text-xl text-white tracking-tight block leading-none">
                    ChitFunds<span className="text-[#64CFF6]">.</span>
                  </span>
                  <span className="text-[10px] text-[#AEABD8] font-semibold tracking-wider uppercase">Fintech Portal</span>
                </div>
              </div>
            )}
            {isCollapsed && (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#9C2CF3] to-[#3A6FF9] flex items-center justify-center font-black text-white shadow-lg shadow-[#6359E9]/30 text-sm mx-auto">
                CF
              </div>
            )}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg bg-[#27264E] hover:bg-[#3A3A5A] text-[#AEABD8] hover:text-white transition-colors duration-200"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 px-3 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isRestricted = !canAccessTab(activeUserRole, item.id);

              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  disabled={isRestricted}
                  className={`w-full flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 relative group ${
                    isRestricted 
                      ? 'opacity-30 cursor-not-allowed text-gray-500' 
                      : isActive
                        ? 'bg-[#6359E9] text-white shadow-lg shadow-[#6359E9]/30 font-bold'
                        : 'hover:bg-[#27264E] hover:text-white text-[#AEABD8]'
                  }`}
                >
                  <div className="flex items-center space-x-3.5 w-full">
                    <Icon size={20} className={isActive ? 'text-white' : 'text-[#AEABD8] group-hover:text-white'} />
                    {!isCollapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                  </div>

                  {/* Restricted / Lock indicator */}
                  {isRestricted && !isCollapsed && (
                    <Lock size={14} className="text-gray-500 shrink-0" />
                  )}

                  {/* Collapsed Tooltip */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#141332] border border-[#27264E] text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 shadow-xl">
                      {item.name} {isRestricted ? '(Restricted)' : ''}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Account Info & Profile */}
        <div className="p-4 border-t border-[#27264E] bg-[#1D1D41]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#9C2CF3] to-[#3A6FF9] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              {!isCollapsed && (
                <div className="flex flex-col overflow-hidden text-left">
                  <span className="text-sm font-bold text-white truncate">
                    {profile?.fullName || 'User'}
                  </span>
                  <span className="text-xs text-[#AEABD8] truncate capitalize font-medium">
                    {activeUserRole}
                  </span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button 
                onClick={() => signOut()}
                title="Sign Out"
                className="p-2 rounded-xl text-[#AEABD8] hover:text-[#E41414] hover:bg-[#E41414]/15 transition-all duration-200 shrink-0"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
