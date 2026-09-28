'use client';

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, User } from 'lucide-react';

export default function UserProfileBadge() {
  const { profile, user } = useAuth();

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/10 text-red-600 border border-red-500/20';
      case 'manager':
        return 'bg-amber-500/10 text-amber-600 border border-amber-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20';
    }
  };

  return (
    <div className="flex items-center space-x-2 sm:space-x-3 bg-white border border-gray-200 rounded-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 shadow-xs shrink-0">
      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
        {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
      </div>
      <div className="flex flex-col text-left max-w-[90px] sm:max-w-[140px]">
        <span className="text-xs font-bold text-gray-900 leading-tight truncate">
          {profile?.fullName || user?.email?.split('@')[0] || 'User'}
        </span>
        <span className="text-[9px] sm:text-[10px] text-gray-500 truncate hidden sm:block">
          {profile?.phoneNumber || user?.email}
        </span>
      </div>
      <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full shrink-0 ${getRoleBadgeStyle(profile?.role)}`}>
        {profile?.role || 'Subscriber'}
      </span>
    </div>
  );
}

