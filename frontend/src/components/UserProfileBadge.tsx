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
    <div className="flex items-center space-x-3 bg-white border border-gray-200 rounded-full px-4 py-1.5 shadow-sm">
      <div className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
        {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
      </div>
      <div className="flex flex-col text-left">
        <span className="text-xs font-bold text-gray-900 leading-tight">
          {profile?.fullName || user?.email || 'Logged In User'}
        </span>
        <span className="text-[10px] text-gray-500">
          {profile?.phoneNumber || user?.email}
        </span>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${getRoleBadgeStyle(profile?.role)}`}>
        {profile?.role || 'Subscriber'}
      </span>
    </div>
  );
}
