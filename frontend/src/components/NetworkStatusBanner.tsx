'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetryConnection = async () => {
    setIsChecking(true);
    try {
      // Check live connection via ping or fetch
      const res = await fetch('/api/health-check', { method: 'HEAD', cache: 'no-store' }).catch(() => null);
      if (res || navigator.onLine) {
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
    } finally {
      setIsChecking(false);
    }
  };

  if (isOnline) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <WifiOff size={32} />
        </div>

        <div>
          <h3 className="text-lg font-bold text-white tracking-tight">No Internet Connection</h3>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            ChitFund Manager requires an active network connection to safeguard treasury balances, auction bids, and live member ledger sync.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
          Please reconnect to mobile data or Wi-Fi to continue.
        </div>

        <button
          type="button"
          onClick={handleRetryConnection}
          disabled={isChecking}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 transition-all active:scale-[0.98]"
        >
          {isChecking ? (
            <>
              <RefreshCw className="animate-spin" size={15} /> Checking Network...
            </>
          ) : (
            <>
              <RefreshCw size={15} /> Retry Connection
            </>
          )}
        </button>
      </div>
    </div>
  );
}
