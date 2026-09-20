'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { QrCode, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';

function PassbookResolverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithPassbookToken } = useAuth();
  const [status, setStatus] = useState<'resolving' | 'success' | 'error'>('resolving');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = searchParams.get('key');

  useEffect(() => {
    let isMounted = true;

    async function resolvePassbook() {
      if (!token) {
        setStatus('error');
        setErrorMessage('No passbook key found in this QR code URL.');
        return;
      }

      setStatus('resolving');
      const res = await loginWithPassbookToken(token);

      if (!isMounted) return;

      if (res.success) {
        setStatus('success');
        setTimeout(() => {
          router.replace('/');
        }, 800);
      } else {
        setStatus('error');
        setErrorMessage(res.error || 'Invalid or revoked passbook QR code.');
      }
    }

    resolvePassbook();

    return () => {
      isMounted = false;
    };
  }, [token, loginWithPassbookToken, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative text-center">
        
        {/* Brand Header */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-2xl mb-4 shadow-lg shadow-indigo-500/25">
          CF
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Passbook Digital Key</h2>
        <p className="text-xs text-slate-400 mt-1 mb-8">Instant Subscriber Portal Authentication</p>

        {status === 'resolving' && (
          <div className="space-y-4 animate-in fade-in duration-300 py-6">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-ping" />
              <div className="relative w-16 h-16 rounded-full border-4 border-t-indigo-500 border-r-indigo-500 border-b-transparent border-l-transparent animate-spin flex items-center justify-center bg-slate-800/80">
                <QrCode className="text-indigo-400" size={24} />
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-200">Authenticating Physical Passbook...</p>
            <p className="text-xs text-slate-500 font-mono">Verifying secure token with Supabase</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 animate-in zoom-in-95 duration-300 py-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={36} />
            </div>
            <p className="text-base font-bold text-emerald-400">Passbook Verified!</p>
            <p className="text-xs text-slate-400">Loading your live ledger, payment history & auction portal...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-5 animate-in fade-in duration-300 py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertCircle size={32} />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-400">Authentication Failed</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                {errorMessage || 'This passbook QR code is invalid, unassigned, or has been revoked by the administrator.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.replace('/')}
              className="w-full mt-4 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
            >
              Go to Sign-In Screen <ArrowRight size={14} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default function PassbookPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <RefreshCw className="animate-spin text-indigo-400" size={28} />
        </div>
      }
    >
      <PassbookResolverContent />
    </Suspense>
  );
}
