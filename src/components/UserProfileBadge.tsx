'use client';

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, User } from 'lucide-react';

export default function UserProfileBadge() {
  const { profile, user } = useAuth();

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-[#E41414]/20 text-[#FF4B4A] border border-[#E41414]/40';
      case 'manager':
        return 'bg-[#FFBB38]/20 text-[#FFBB38] border border-[#FFBB38]/40';
      default:
        return 'bg-[#02B15A]/20 text-[#02B15A] border border-[#02B15A]/40';
    }
  };

  return (
    <div className="flex items-center space-x-2.5 sm:space-x-3 bg-[#27264E] border border-[#3A3A5A] rounded-full px-3 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.25)] shrink-0">
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-[#9C2CF3] to-[#3A6FF9] text-white flex items-center justify-center text-xs font-black shrink-0 shadow-md shadow-[#6359E9]/30">
        {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
      </div>
      <div className="flex flex-col text-left max-w-[90px] sm:max-w-[140px]">
        <span className="text-xs font-bold text-white leading-tight truncate">
          {profile?.fullName || user?.email?.split('@')[0] || 'User'}
        </span>
        <span className="text-[9px] sm:text-[10px] text-[#AEABD8] truncate hidden sm:block font-medium">
          {profile?.phoneNumber || user?.email}
        </span>
      </div>
      <span className={`text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${getRoleBadgeStyle(profile?.role)}`}>
        {profile?.role || 'Subscriber'}
      </span>
    </div>
  );
}

