'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, ShieldAlert, ArrowRight, Lock } from 'lucide-react';
import AppLogo from '@/components/AppLogo';

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [pingFailed, setPingFailed] = useState<boolean>(false);

  const checkConnectivity = useCallback(async () => {
    setIsChecking(true);
    setPingFailed(false);
    try {
      // 1. Check navigator.onLine first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
        setPingFailed(true);
        return false;
      }

      // 2. Perform live network ping with no-store cache to verify real data throughput
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`/api-health.json?_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (res && (res.status === 200 || res.ok)) {
        setIsOnline(true);
        setPingFailed(false);
        return true;
      } else {
        // Fallback to checking online status
        if (navigator.onLine) {
          setIsOnline(true);
          return true;
        }
        setIsOnline(false);
        setPingFailed(true);
        return false;
      }
    } catch {
      if (navigator.onLine) {
        setIsOnline(true);
        return true;
      }
      setIsOnline(false);
      setPingFailed(true);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initial check
    if (!navigator.onLine) {
      setIsOnline(false);
    }

    const handleOnlineEvent = () => {
      checkConnectivity();
    };

    const handleOfflineEvent = () => {
      setIsOnline(false);
      setPingFailed(true);
    };

    window.addEventListener('online', handleOnlineEvent);
    window.addEventListener('offline', handleOfflineEvent);

    return () => {
      window.removeEventListener('online', handleOnlineEvent);
      window.removeEventListener('offline', handleOfflineEvent);
    };
  }, [checkConnectivity]);

  if (isOnline) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-barrier-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#090D1A]/90 backdrop-blur-xl animate-in fade-in duration-200 select-none overflow-y-auto"
    >
      <div className="bg-[#111827] border border-rose-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-rose-950/40 text-center space-y-5 my-auto ring-1 ring-white/10 relative overflow-hidden">
        {/* Subtle Top Crimson Ambient Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Brand App Logo & Offline Indicator */}
        <div className="flex flex-col items-center justify-center relative z-10">
          <AppLogo size={64} className="mb-3.5" />
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/35 text-rose-400 text-[11px] font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>Active Network Required</span>
          </div>
        </div>

        {/* Barrier Heading & Explanation */}
        <div className="space-y-2 relative z-10">
          <h2 id="offline-barrier-title" className="text-xl sm:text-2xl font-black text-white tracking-tight font-display">
            No Internet Connection
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            Chit Funds Manager requires an active network connection to safeguard live treasury balances, live bidding auctions, and encrypted member ledgers.
          </p>
        </div>

        {/* Security / Offline Notice Box */}
        <div className="p-3.5 rounded-2xl bg-[#0B0F19] border border-slate-800 text-left space-y-1 relative z-10">
          <div className="flex items-center gap-2 text-slate-300 text-xs font-bold">
            <Lock size={13} className="text-amber-400 shrink-0" />
            <span>Offline Security Barrier Active</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal pl-5">
            Offline access is restricted to prevent ledger desynchronization. Please connect to Wi-Fi or mobile data to unlock your workspace.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-1 relative z-10">
          <button
            type="button"
            onClick={() => checkConnectivity()}
            disabled={isChecking}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-rose-700 to-indigo-700 hover:from-rose-500 hover:to-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isChecking ? (
              <>
                <RefreshCw className="animate-spin" size={15} />
                <span>Checking Connection...</span>
              </>
            ) : (
              <>
                <RefreshCw size={15} />
                <span>Retry Connection</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
