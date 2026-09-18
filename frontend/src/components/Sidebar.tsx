'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
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
  MessageSquare
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { profile, signOut } = useAuth();

  const activeUserRole = profile?.role || 'subscriber';
  const isUserAdminOrManager = activeUserRole === 'admin' || activeUserRole === 'manager';

  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
    { id: 'chits', name: 'Chits', icon: Briefcase, adminOnly: false },
    { id: 'members', name: 'Members', icon: Users, adminOnly: false },
    { id: 'communication', name: 'Communication', icon: MessageSquare, adminOnly: false },
    { id: 'auctions', name: 'Auctions', icon: Gavel, adminOnly: false },
    { id: 'reports', name: 'Reports', icon: BarChart3, adminOnly: false },
    { id: 'cash', name: 'Cash Handling', icon: Vault, adminOnly: true },
  ];

  const handleTabClick = (itemId: string, adminOnly: boolean) => {
    if (adminOnly && !isUserAdminOrManager) {
      return; // Block subscribers from admin-only sections
    }
    setActiveTab(itemId);
  };

  return (
    <aside 
      className={`sticky top-0 left-0 h-screen bg-white border-r border-gray-200 text-gray-700 flex flex-col justify-between transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-72'
      } z-40`}
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
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="mt-6 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isRestricted = item.adminOnly && !isUserAdminOrManager;

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id, item.adminOnly)}
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

      {/* Account Info & Profile Switcher */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 border border-gray-200 shrink-0">
              <User size={20} />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {profile?.fullName || 'User'}
                </span>
                <span className="text-xs text-gray-500 truncate capitalize">
                  {activeUserRole} (Supabase)
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
  );
}
