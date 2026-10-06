'use client';

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { canAccessTab, MainTabId } from '@/utils/rbac';
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

  const allPossibleItems: { id: MainTabId; name: string; icon: any }[] = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'chits', name: 'Chits', icon: Briefcase },
    { id: 'members', name: 'Members', icon: Users },
    { id: 'auctions', name: 'Auctions', icon: Gavel },
    { id: 'cash', name: 'Treasury', icon: Vault },
  ];

  const bottomItems = allPossibleItems.filter(item => canAccessTab(activeUserRole, item.id));

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#1D1D41]/95 backdrop-blur-md border-t border-[#27264E] px-3 py-2 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] md:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 active:scale-95 min-w-[56px] relative ${
                isActive 
                  ? 'text-[#64CFF6] font-bold' 
                  : 'text-[#AEABD8] hover:text-white font-medium'
              }`}
            >
              {isActive && (
                <div className="absolute -top-2 w-8 h-1 bg-[#64CFF6] rounded-full shadow-[0_0_8px_#64CFF6]" />
              )}
              <div className={`p-1.5 rounded-xl transition-all ${
                isActive ? 'text-[#64CFF6] bg-[#6359E9]/30 shadow-inner' : 'text-[#AEABD8]'
              }`}>
                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight font-semibold ${
                isActive ? 'text-[#64CFF6]' : 'text-[#AEABD8]'
              }`}>
                {item.name}
              </span>
            </button>
          );
        })}

        {/* More Drawer Button */}
        <button
          onClick={onOpenDrawer}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-2xl text-[#AEABD8] hover:text-white active:scale-95 min-w-[56px]"
          aria-label="Open full menu"
        >
          <div className="p-1.5 rounded-xl text-[#AEABD8] hover:bg-[#27264E] transition-colors">
            <Menu size={19} strokeWidth={2} />
          </div>
          <span className="text-[10px] mt-0.5 font-semibold text-[#AEABD8]">
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
