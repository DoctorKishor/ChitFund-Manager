'use client';

import React, { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { 
  Lock, 
  Mail, 
  Phone, 
  Shield, 
  AlertCircle, 
  ArrowRight, 
  CheckCircle2, 
  QrCode, 
  Camera, 
  KeyRound, 
  Eye, 
  EyeOff
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
  const [rememberPhone, setRememberPhone] = useState(false);

  // Admin email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load saved identifiers (email/phone only) from localStorage on mount & clean up any legacy saved passwords/pins
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // Clean up any legacy sensitive credentials stored in localStorage
      localStorage.removeItem('cf_admin_saved_password');
      localStorage.removeItem('cf_admin_remember_password');
      localStorage.removeItem('cf_pin_saved_pin');
      localStorage.removeItem('cf_pin_remember_pin');

      // 1. Admin saved email
      const savedRememberEmail = localStorage.getItem('cf_admin_remember_email') === 'true';
      const savedEmail = localStorage.getItem('cf_admin_saved_email');
      if (savedRememberEmail && savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }

      // 2. PIN login saved phone
      const savedRememberPhone = localStorage.getItem('cf_pin_remember_phone') === 'true';
      const savedPhone = localStorage.getItem('cf_pin_saved_phone');
      if (savedRememberPhone && savedPhone) {
        setSubscriberPhone(savedPhone);
        setRememberPhone(true);
      }
    }
  }, []);

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
        setSuccessMsg('Passbook verified! Loading dashboard...');
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

      // Persist / Clear PIN Login credentials in localStorage
      if (typeof window !== 'undefined') {
        if (rememberPhone) {
          localStorage.setItem('cf_pin_remember_phone', 'true');
          localStorage.setItem('cf_pin_saved_phone', cleanPhone);
        } else {
          localStorage.removeItem('cf_pin_remember_phone');
          localStorage.removeItem('cf_pin_saved_phone');
        }

        if (rememberPhone) {
          localStorage.setItem('cf_pin_remember_phone', 'true');
          localStorage.setItem('cf_pin_saved_phone', cleanPhone);
        } else {
          localStorage.removeItem('cf_pin_remember_phone');
          localStorage.removeItem('cf_pin_saved_phone');
        }
      }

      const res = await loginWithPhoneAndMpin(cleanPhone, subscriberPin);
      if (res.success) {
        setSuccessMsg('Signed in! Loading portal...');
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

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      // Clear subscriber session keys in localStorage before admin login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cf_passbook_token_session');
        localStorage.removeItem('cf_subscriber_session_id');

        // Persist / Clear Admin email in localStorage
        if (rememberEmail) {
          localStorage.setItem('cf_admin_remember_email', 'true');
          localStorage.setItem('cf_admin_saved_email', cleanEmail);
        } else {
          localStorage.removeItem('cf_admin_remember_email');
          localStorage.removeItem('cf_admin_saved_email');
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) throw error;
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col justify-center items-center px-4 py-6 relative overflow-hidden font-sans">
      
      {/* Subtle Ambient Background Lighting */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-indigo-600/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b1a_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

      <div className="w-full max-w-sm sm:max-w-md relative z-10">
        
        {/* Main Card */}
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/60">
          
          {/* Brand Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-xl mb-3 shadow-lg shadow-indigo-600/30">
              CF
            </div>
            
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              ChitFund <span className="text-indigo-400">Manager</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">Community Chit Fund Ledger</p>
          </div>

          {/* Mode Selector Tabs (Clean, single-line, mobile-responsive) */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800/80 mb-5">
            <button
              type="button"
              onClick={() => {
                setAuthMode('qr_passbook');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                authMode === 'qr_passbook'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <QrCode size={13} className="shrink-0" />
              <span>Passbook</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('phone_pin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                authMode === 'phone_pin'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Phone size={13} className="shrink-0" />
              <span>PIN Login</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('admin_email');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                authMode === 'admin_email'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield size={13} className="shrink-0" />
              <span>Admin</span>
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: PASSBOOK QR SCANNER */}
          {authMode === 'qr_passbook' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col items-center justify-center text-center">
                
                {/* Laser Viewfinder */}
                <div className="relative mb-3">
                  <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner relative overflow-hidden">
                    {/* Vertical Laser Scan Animation */}
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_6px_#22d3ee] animate-laser-scan pointer-events-none" />
                    
                    <QrCode size={40} className="text-indigo-400" />
                  </div>

                  {/* Corner Brackets */}
                  <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-cyan-400 rounded-tl-sm shadow-[0_0_4px_#22d3ee]" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-cyan-400 rounded-tr-sm shadow-[0_0_4px_#22d3ee]" />
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-cyan-400 rounded-bl-sm shadow-[0_0_4px_#22d3ee]" />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-cyan-400 rounded-br-sm shadow-[0_0_4px_#22d3ee]" />
                </div>

                <h2 className="text-sm font-bold text-white">Scan Passbook QR</h2>
                <p className="text-xs text-slate-400 max-w-[240px] mt-0.5">
                  Point camera at the QR code on your physical chit book.
                </p>

                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  disabled={loading}
                  className="w-full mt-4 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
                >
                  <Camera size={15} />
                  <span>Open Camera Scanner</span>
                </button>
              </div>

              <p className="text-center text-[11px] text-slate-500">
                Tip: You can also scan directly with your phone's camera app.
              </p>
            </div>
          )}

          {/* TAB 2: SUBSCRIBER MOBILE & PIN LOGIN */}
          {authMode === 'phone_pin' && (
            <form onSubmit={handlePhonePinLogin} className="space-y-3.5 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mobile Number
                </label>
                <div className="relative flex rounded-xl bg-slate-950 border border-slate-800 focus-within:border-indigo-500 overflow-hidden transition-colors">
                  <div className="px-3 py-2.5 bg-slate-900 border-r border-slate-800 text-xs font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                    +91
                  </div>
                  <input
                    type="tel"
                    required
                    value={subscriberPhone}
                    onChange={(e) => setSubscriberPhone(e.target.value)}
                    placeholder="10-digit number"
                    maxLength={10}
                    className="w-full bg-transparent px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                  />
                </div>
                <div className="mt-1.5 flex items-center">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-[11px] text-slate-400 hover:text-slate-200 select-none">
                    <input
                      type="checkbox"
                      checked={rememberPhone}
                      onChange={(e) => setRememberPhone(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/40 cursor-pointer w-3.5 h-3.5"
                    />
                    <span>Remember Mobile Number</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  4-Digit MPIN
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <KeyRound size={14} />
                  </div>
                  <input
                    type="password"
                    required
                    value={subscriberPin}
                    onChange={(e) => setSubscriberPin(e.target.value)}
                    placeholder="Enter PIN (Default: 1234)"
                    maxLength={6}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono tracking-widest"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
              >
                {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight size={14} />
              </button>
            </form>
          )}

          {/* TAB 3: ADMIN SIGN-IN */}
          {authMode === 'admin_email' && (
            <form onSubmit={handleAdminAuth} className="space-y-3.5 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail size={14} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@chitfund.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="mt-1.5 flex items-center">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-[11px] text-slate-400 hover:text-slate-200 select-none">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(e) => setRememberEmail(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/40 cursor-pointer w-3.5 h-3.5"
                    />
                    <span>Remember Email</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock size={14} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
              >
                {loading ? 'Authenticating...' : 'Sign In as Administrator'}{' '}
                <ArrowRight size={14} />
              </button>

              <div className="pt-1 text-center">
                <span className="text-[11px] text-slate-500">
                  🔒 Restricted to authorized personnel
                </span>
              </div>
            </form>
          )}
        </div>
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
