'use client';

import React, { useState } from 'react';
import { useMaintenance } from '@/context/MaintenanceContext';
import { useAuth } from '@/context/AuthContext';
import AuthScreen from '@/components/AuthScreen';
import {
  Wrench,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Clock,
  Lock,
  Phone,
  MessageCircle,
  AlertTriangle,
  Server,
  KeyRound,
  ArrowRight
} from 'lucide-react';

export default function MaintenanceScreen() {
  const { maintenanceMessage, refreshMaintenance } = useMaintenance();
  const { user, profile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshMaintenance();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  if (showAdminLogin) {
    return (
      <div className="relative">
        <div className="fixed top-4 left-4 z-50">
          <button
            type="button"
            onClick={() => setShowAdminLogin(false)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg"
          >
            ← Back to Maintenance Notice
          </button>
        </div>
        <AuthScreen />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col justify-between items-center px-4 py-8 relative overflow-hidden font-sans select-none">
      
      {/* ── AMBIENT GLOW EFFECTS ── */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* ── TOP HEADER LOGO ── */}
      <header className="w-full max-w-4xl flex items-center justify-between z-10 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center font-black text-white text-sm shadow-lg shadow-amber-500/20">
            CF
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-white block">Chit Fund Manager</span>
            <span className="text-[10px] text-amber-400/90 font-mono font-semibold uppercase tracking-wider">
              System Maintenance Active
            </span>
          </div>
        </div>

        {/* Admin Login Trigger */}
        <button
          type="button"
          onClick={() => setShowAdminLogin(true)}
          className="text-xs font-bold text-slate-400 hover:text-amber-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
        >
          <KeyRound size={13} className="text-amber-400" />
          <span>Admin Access</span>
        </button>
      </header>

      {/* ── MAIN CONTENT HERO CARD ── */}
      <main className="my-auto w-full max-w-lg z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl relative text-center space-y-6">
          
          {/* Animated Icon Avatar */}
          <div className="relative inline-flex items-center justify-center mx-auto">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center shadow-xl shadow-amber-500/10 relative">
              <Wrench className="text-amber-400 animate-bounce duration-1000" size={38} />
              
              {/* Sparkle Badges */}
              <div className="absolute -top-2 -right-2 w-7 h-7 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/40">
                <Sparkles size={14} />
              </div>
            </div>
          </div>

          {/* Heading & Notice */}
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Portal Under Maintenance</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              We&apos;ll Be Right Back!
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
              {maintenanceMessage || 'Our team is currently performing scheduled system upgrades, security audits, and performance tuning to serve you better.'}
            </p>
          </div>

          {/* System Status Indicators */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 text-left">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-0.5">
                <Server size={13} />
                <span>Portal Services</span>
              </div>
              <p className="text-[11px] text-slate-400">Temporarily paused</p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-0.5">
                <ShieldCheck size={13} />
                <span>Financial Data</span>
              </div>
              <p className="text-[11px] text-slate-400">100% Safe &amp; Synchronized</p>
            </div>
          </div>

          {/* Actions: Refresh & WhatsApp Helpline */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Checking Status...' : 'Check Status'}</span>
            </button>

            <a
              href="https://wa.me/919943609010?text=Hello%20Admin,%20checking%20about%20chit%20funds%20portal%20maintenance."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all"
            >
              <MessageCircle size={15} className="text-emerald-400" />
              <span>Contact Support</span>
            </a>
          </div>

        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="w-full max-w-4xl text-center text-slate-500 text-xs z-10 pb-2">
        <p>© {new Date().getFullYear()} Chit Funds Management System. Authorized administrative personnel can sign in anytime.</p>
      </footer>

    </div>
  );
}
