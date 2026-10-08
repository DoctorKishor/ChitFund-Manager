'use client';

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, User } from 'lucide-react';

export default function UserProfileBadge() {
  const { profile, user } = useAuth();

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-rose-50 text-rose-700 border border-rose-200/60';
      case 'manager':
        return 'bg-amber-50 text-amber-700 border border-amber-200/60';
      default:
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
    }
  };

  return (
    <div className="flex items-center space-x-2.5 sm:space-x-3 bg-slate-100 border border-slate-200/80 rounded-full px-3 py-1.5 shadow-xs shrink-0">
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
        {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
      </div>
      <div className="flex flex-col text-left max-w-[90px] sm:max-w-[140px]">
        <span className="text-xs font-bold text-slate-900 leading-tight truncate">
          {profile?.fullName || user?.email?.split('@')[0] || 'User'}
        </span>
        <span className="text-[10px] text-slate-500 truncate hidden sm:block font-mono">
          {profile?.phoneNumber || user?.email}
        </span>
      </div>
      <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${getRoleBadgeStyle(profile?.role)}`}>
        {profile?.role || 'Subscriber'}
      </span>
    </div>
  );
}

