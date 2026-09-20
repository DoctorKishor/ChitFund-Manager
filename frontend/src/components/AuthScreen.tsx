'use client';

import React, { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { 
  Lock, 
  Mail, 
  Phone, 
  User, 
  Shield, 
  AlertCircle, 
  ArrowRight, 
  CheckCircle2, 
  QrCode, 
  Camera, 
  KeyRound, 
  Sparkles 
} from 'lucide-react';
import PassbookScannerModal from './PassbookScannerModal';

interface AuthScreenProps {
  onSuccess?: () => void;
}

type AuthMode = 'qr_passbook' | 'phone_pin' | 'admin_email';

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const { loginWithPassbookToken, loginWithPhoneAndMpin } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('qr_passbook');

  // Scanner modal state
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Phone + PIN state
  const [subscriberPhone, setSubscriberPhone] = useState('');
  const [subscriberPin, setSubscriberPin] = useState('');

  // Admin email state
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const normalizePhoneDigits = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  };

  // 1. Handle Passbook QR Scan
  const handlePassbookScan = async (scannedToken: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsScannerOpen(false);

    try {
      setLoading(true);
      const res = await loginWithPassbookToken(scannedToken);
      if (res.success) {
        setSuccessMsg('Passbook verified! Loading subscriber dashboard...');
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.error || 'Invalid or unassigned passbook QR code.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Phone + MPIN Login
  const handlePhonePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanPhone = normalizePhoneDigits(subscriberPhone);
    if (cleanPhone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!subscriberPin.trim()) {
      setErrorMsg('Please enter your 4-digit PIN (Default is 1234).');
      return;
    }

    try {
      setLoading(true);
      const res = await loginWithPhoneAndMpin(cleanPhone, subscriberPin);
      if (res.success) {
        setSuccessMsg('Signed in successfully! Loading subscriber portal...');
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.error || 'Failed to sign in.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Admin Email/Password Login
  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    setLoading(true);

    try {
      if (isSignUp) {
        const coreDigits = normalizePhoneDigits(adminPhone);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone_number: coreDigits,
              role: 'admin',
            },
          },
        });

        if (error) throw error;

        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName,
            phone_number: coreDigits,
            role: 'admin',
          });
        }

        setSuccessMsg('Admin account created! Logging you in...');
        if (onSuccess) onSuccess();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Glow Header */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-xl mb-2.5 shadow-lg shadow-indigo-500/25">
            CF
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">ChitFund Manager</h2>
          <p className="text-xs text-slate-400 mt-1">High-Trust Community Chit Fund Ledger</p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => {
              setAuthMode('qr_passbook');
              setErrorMsg(null);
            }}
            className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
              authMode === 'qr_passbook'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode size={13} /> Passbook QR
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('phone_pin');
              setErrorMsg(null);
            }}
            className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
              authMode === 'phone_pin'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Phone size={13} /> Mobile & PIN
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('admin_email');
              setErrorMsg(null);
            }}
            className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
              authMode === 'admin_email'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield size={13} /> Admin
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: PASSBOOK QR INSTANT ACCESS */}
        {authMode === 'qr_passbook' && (
          <div className="space-y-4 animate-in fade-in duration-200 text-center py-2">
            <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <QrCode size={36} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Scan Physical Passbook</h3>
                <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                  Point camera at the QR code on your physical pocket book for instant passwordless login.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
              >
                <Camera size={16} /> Open Camera Scanner
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-[10px] text-slate-400">
              💡 <strong>Tip:</strong> You can also scan the QR sticker directly with Google Lens or your phone's camera app to open the app automatically.
            </div>
          </div>
        )}

        {/* TAB 2: SUBSCRIBER MOBILE & PIN LOGIN */}
        {authMode === 'phone_pin' && (
          <form onSubmit={handlePhonePinLogin} className="space-y-4 animate-in fade-in duration-200">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Registered Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Phone size={15} />
                </div>
                <input
                  type="tel"
                  required
                  value={subscriberPhone}
                  onChange={(e) => setSubscriberPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                4-Digit MPIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound size={15} />
                </div>
                <input
                  type="password"
                  required
                  value={subscriberPin}
                  onChange={(e) => setSubscriberPin(e.target.value)}
                  placeholder="Enter PIN (Default: 1234)"
                  maxLength={6}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono tracking-widest"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Default MPIN is 1234 unless updated.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
            >
              {loading ? 'Authenticating...' : 'Sign In to Subscriber Portal'} <ArrowRight size={14} />
            </button>
          </form>
        )}

        {/* TAB 3: ADMIN SIGN-IN */}
        {authMode === 'admin_email' && (
          <form onSubmit={handleAdminAuth} className="space-y-4 animate-in fade-in duration-200">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User size={15} />
                    </div>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Admin Name"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mobile Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Phone size={15} />
                    </div>
                    <input
                      type="tel"
                      required
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      placeholder="10-digit mobile"
                      maxLength={10}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Admin Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail size={15} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@chitfund.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock size={15} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
            >
              {loading ? 'Processing...' : isSignUp ? 'Create Admin Account' : 'Sign In as Administrator'}{' '}
              <ArrowRight size={14} />
            </button>

            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrorMsg(null);
                }}
                className="text-xs text-indigo-400 hover:underline"
              >
                {isSignUp ? 'Already an admin? Sign in' : 'Create new administrator account'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Camera QR Scanner Modal */}
      <PassbookScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handlePassbookScan}
        title="Scan Member Passbook"
        subtitle="Point camera at the QR code on the physical pocket book"
      />
    </div>
  );
}
