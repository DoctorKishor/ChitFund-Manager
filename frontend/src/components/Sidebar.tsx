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
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setMobileOpen && setMobileOpen(false)}
          />

          {/* Drawer Sheet */}
          <aside className="fixed inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white border-r border-gray-200 text-gray-700 flex flex-col justify-between z-50 shadow-2xl animate-in slide-in-from-left duration-200">
            <div>
              {/* Header */}
              <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 bg-white">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center font-bold text-white shadow-sm text-sm">
                    CF
                  </div>
                  <div>
                    <span className="font-bold text-base text-gray-900 tracking-tight block leading-none">
                      ChitFunds
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">Workspace</span>
                  </div>
                </div>
                <button 
                  onClick={() => setMobileOpen && setMobileOpen(false)}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                  aria-label="Close navigation"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="mt-4 px-3 space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isRestricted = !canAccessTab(activeUserRole, item.id);

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      disabled={isRestricted}
                      className={`w-full flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                        isRestricted 
                          ? 'opacity-40 cursor-not-allowed text-gray-400 bg-gray-50' 
                          : isActive
                            ? 'bg-gray-900 text-white shadow-md shadow-gray-900/10'
                            : 'hover:bg-gray-100 text-gray-700 active:bg-gray-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon size={19} className={isActive ? 'text-white' : 'text-gray-500'} />
                        <span>{item.name}</span>
                      </div>
                      {isRestricted && (
                        <Lock size={14} className="text-gray-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Account Info & Logout in Mobile Drawer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                    {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col overflow-hidden text-left">
                    <span className="text-sm font-bold text-gray-900 truncate">
                      {profile?.fullName || 'User'}
                    </span>
                    <span className="text-xs text-gray-500 truncate capitalize font-medium">
                      {activeUserRole}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => signOut()}
                  title="Sign Out"
                  className="p-2.5 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 bg-white border border-gray-200 transition-all shrink-0 active:scale-95"
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
        className={`hidden md:flex sticky top-0 left-0 h-screen bg-white border-r border-gray-200 text-gray-700 flex-col justify-between transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-72'
        } z-40 shrink-0`}
      >
        {/* Header section with Logo */}
        <div>
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 bg-white">
            {!isCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center font-bold text-white shadow-sm">
                  CF
                </div>
                <span className="font-semibold text-lg text-gray-900 tracking-wide">
                  ChitFunds
                </span>
              </div>
            )}
            {isCollapsed && (
              <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center font-bold text-white shadow mx-auto">
                CF
              </div>
            )}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors duration-200"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isRestricted = !canAccessTab(activeUserRole, item.id);

              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  disabled={isRestricted}
                  className={`w-full flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative group ${
                    isRestricted 
                      ? 'opacity-40 cursor-not-allowed text-gray-400' 
                      : isActive
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'hover:bg-gray-100 hover:text-gray-900 text-gray-600'
                  }`}
                >
                  <div className="flex items-center space-x-3 w-full">
                    <Icon size={20} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-900'} />
                    {!isCollapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                  </div>

                  {/* Restricted / Lock indicator */}
                  {isRestricted && !isCollapsed && (
                    <Lock size={14} className="text-gray-400 shrink-0" />
                  )}

                  {/* Collapsed Tooltip */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 shadow-md">
                      {item.name} {isRestricted ? '(Restricted)' : ''}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Account Info & Profile */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 border border-gray-200 shrink-0">
                <User size={20} />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col overflow-hidden text-left">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {profile?.fullName || 'User'}
                  </span>
                  <span className="text-xs text-gray-500 truncate capitalize">
                    {activeUserRole}
                  </span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button 
                onClick={() => signOut()}
                title="Sign Out"
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 transition-all duration-200 shrink-0"
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
