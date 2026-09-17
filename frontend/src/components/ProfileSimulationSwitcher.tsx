'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSimulation, Profile } from '../context/SimulationContext';
import { UserSquare, ShieldAlert, ChevronDown, Check, User } from 'lucide-react';

export default function ProfileSimulationSwitcher() {
  const { simulatedUser, testProfiles, switchSimulatedUser } = useSimulation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadgeColor = (role: Profile['role']) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'manager':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'subscriber':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Switcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2.5 px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold shadow-sm transition-all duration-200"
      >
        <span className="flex h-2 w-2 relative shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
        <UserSquare size={16} className="text-indigo-400" />
        <span className="max-w-[150px] truncate">
          Simulating: <span className="text-indigo-300 font-bold">{simulatedUser.fullName}</span>
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-800 bg-slate-950 p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-3 py-2 border-b border-slate-900 mb-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldAlert size={12} className="text-indigo-400" />
              Role Simulation Panel
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Swap workspace profiles to preview dashboard metrics, navigation gates, and transaction permissions.
            </p>
          </div>
          
          <div className="space-y-0.5 max-h-[240px] overflow-y-auto">
            {testProfiles.map((profile) => {
              const isSelected = profile.id === simulatedUser.id;
              return (
                <button
                  key={profile.id}
                  onClick={() => {
                    switchSimulatedUser(profile.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-all duration-150 ${
                    isSelected 
                      ? 'bg-slate-900 text-white font-medium' 
                      : 'hover:bg-slate-900/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 overflow-hidden mr-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'bg-slate-900 text-slate-500'
                    }`}>
                      <User size={14} />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-semibold truncate text-[11px]">
                        {profile.fullName}
                      </span>
                      <span className="text-[9px] text-slate-500 truncate mt-0.5">
                        {profile.phoneNumber}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${getRoleBadgeColor(profile.role)}`}>
                      {profile.role}
                    </span>
                    {isSelected && (
                      <Check size={14} className="text-indigo-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
