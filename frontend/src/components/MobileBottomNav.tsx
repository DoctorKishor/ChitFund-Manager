'use client';

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Gavel, 
  Vault, 
  Menu 
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenDrawer: () => void;
}

export default function MobileBottomNav({ 
  activeTab, 
  setActiveTab, 
  onOpenDrawer 
}: MobileBottomNavProps) {
  const { profile } = useAuth();
  const activeUserRole = profile?.role || 'subscriber';
  const isUserAdminOrManager = activeUserRole === 'admin' || activeUserRole === 'manager';

  const bottomItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'chits', name: 'Chits', icon: Briefcase },
    { id: 'members', name: 'Members', icon: Users },
    { id: 'auctions', name: 'Auctions', icon: Gavel },
    ...(isUserAdminOrManager 
      ? [{ id: 'cash', name: 'Treasury', icon: Vault }]
      : []
    ),
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:hidden">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 active:scale-95 min-w-[56px] ${
                isActive 
                  ? 'text-gray-900 font-bold' 
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`}
            >
              <div className={`p-1 rounded-lg transition-all ${
                isActive ? 'bg-gray-900 text-white shadow-xs' : 'text-current'
              }`}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${
                isActive ? 'text-gray-900 font-bold' : 'text-gray-500'
              }`}>
                {item.name}
              </span>
            </button>
          );
        })}

        {/* More Drawer Button */}
        <button
          onClick={onOpenDrawer}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-gray-400 hover:text-gray-600 active:scale-95 min-w-[56px]"
          aria-label="Open full menu"
        >
          <div className="p-1 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
            <Menu size={18} strokeWidth={2} />
          </div>
          <span className="text-[10px] mt-0.5 font-medium text-gray-500">
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
