'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { triggerHapticFeedback } from '@/utils/haptics';
import { 
  Lock, 
  Mail, 
  Phone, 
  Shield, 
  ShieldCheck,
  AlertCircle, 
  ArrowRight, 
  CheckCircle2, 
  QrCode, 
  Camera, 
  KeyRound, 
  Eye, 
  EyeOff,
  Sparkles,
  BookOpen,
  UserCheck
} from 'lucide-react';
import PassbookScannerModal from './PassbookScannerModal';

interface AuthScreenProps {
  onSuccess?: () => void;
}

type PortalDoor = 'staff' | 'subscriber';
type SubscriberSubMode = 'qr' | 'pin';

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const { loginWithPassbookToken, loginWithPhoneAndMpin } = useAuth();
  
  // Primary door: 'staff' for Email/Password, 'subscriber' for Passbook QR / MPIN
  const [portalDoor, setPortalDoor] = useState<PortalDoor>('staff');
  const [subscriberMode, setSubscriberMode] = useState<SubscriberSubMode>('qr');

  // Scanner modal state
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Subscriber Phone + PIN state
  const [subscriberPhone, setSubscriberPhone] = useState('');
  const [subscriberPin, setSubscriberPin] = useState('');
  const [rememberPhone, setRememberPhone] = useState(false);

  // Staff Work Email + Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load saved identifiers on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cf_admin_saved_password');
      localStorage.removeItem('cf_admin_remember_password');
      localStorage.removeItem('cf_pin_saved_pin');
      localStorage.removeItem('cf_pin_remember_pin');

      // Staff saved email
      const savedRememberEmail = localStorage.getItem('cf_staff_remember_email') === 'true' || 
                                 localStorage.getItem('cf_admin_remember_email') === 'true';
      const savedEmail = localStorage.getItem('cf_staff_saved_email') || 
                         localStorage.getItem('cf_admin_saved_email');
      if (savedRememberEmail && savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }

      // Subscriber saved phone
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
        triggerHapticFeedback('success');
        setSuccessMsg('Passbook verified! Loading subscriber portal...');
        if (onSuccess) onSuccess();
      } else {
        triggerHapticFeedback('error');
        setErrorMsg(res.error || 'Invalid or unassigned passbook QR code.');
      }
    } catch (err: any) {
      triggerHapticFeedback('error');
      setErrorMsg(err.message || 'Passbook verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Subscriber Phone + MPIN Login
  const handlePhonePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanPhone = normalizePhoneDigits(subscriberPhone);
    if (cleanPhone.length !== 10) {
      triggerHapticFeedback('warning');
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!subscriberPin.trim()) {
      triggerHapticFeedback('warning');
      setErrorMsg('Please enter your 4-digit PIN (Default is 1234).');
      return;
    }

    try {
      setLoading(true);

      if (typeof window !== 'undefined') {
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
        triggerHapticFeedback('success');
        setSuccessMsg('Signed in! Loading subscriber portal...');
        if (onSuccess) onSuccess();
      } else {
        triggerHapticFeedback('error');
        setErrorMsg(res.error || 'Failed to sign in.');
      }
    } catch (err: any) {
      triggerHapticFeedback('error');
      setErrorMsg(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Staff Email + Password Login
  const handleStaffAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      triggerHapticFeedback('warning');
      setErrorMsg('Please enter your staff work email and password.');
      return;
    }

    setLoading(true);

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cf_passbook_token_session');
        localStorage.removeItem('cf_phone_subscriber_session');
        localStorage.removeItem('cf_subscriber_session_id');

        if (rememberEmail) {
          localStorage.setItem('cf_staff_remember_email', 'true');
          localStorage.setItem('cf_staff_saved_email', cleanEmail);
        } else {
          localStorage.removeItem('cf_staff_remember_email');
          localStorage.removeItem('cf_staff_saved_email');
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) throw error;
      triggerHapticFeedback('success');
      setSuccessMsg('Staff credentials verified! Opening workspace...');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      triggerHapticFeedback('error');
      setErrorMsg(err.message || 'Authentication failed. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-4 py-6 sm:py-12 relative overflow-hidden font-sans selection:bg-indigo-600 selection:text-white">
      
      {/* Subtle Ambient Background Lighting */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#64748b15_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      <div className="w-full max-w-[440px] relative z-10">
        
        {/* Main Glassmorphic Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-xl shadow-slate-200/60">
          
          {/* Brand Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-700 text-white font-black text-xl mb-3 shadow-lg shadow-indigo-600/25 ring-4 ring-indigo-50">
              CF
            </div>
            
            <h1 className="text-2xl font-black tracking-tight text-slate-900 font-display">
              ChitFund <span className="text-indigo-600">Manager</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">Enterprise Community Ledger &amp; Treasury</p>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              PRIMARY DOOR SELECTOR (STAFF vs SUBSCRIBER PASSBOOK)
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 mb-5">
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback('light');
                setPortalDoor('staff');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                portalDoor === 'staff'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80 ring-1 ring-slate-950/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <ShieldCheck size={16} className={portalDoor === 'staff' ? 'text-indigo-600' : 'text-slate-400'} />
              <span>Staff &amp; Team</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback('light');
                setPortalDoor('subscriber');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                portalDoor === 'subscriber'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80 ring-1 ring-slate-950/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <BookOpen size={16} className={portalDoor === 'subscriber' ? 'text-emerald-600' : 'text-slate-400'} />
              <span>Subscriber</span>
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              DOOR 1: STAFF & TEAM EMAIL / PASSWORD LOGIN
              ═══════════════════════════════════════════════════════════════ */}
          {portalDoor === 'staff' && (
            <form onSubmit={handleStaffAuth} className="space-y-4 animate-in fade-in duration-150">
              <div className="px-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Staff Workspace Authentication</span>
                <p className="text-xs text-slate-400 mt-0.5">Admin, Managers, Collections Agents, Auction Clerks, Auditors</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Staff Email</label>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    autoCapitalize="none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@chitfund.com"
                    className="w-full bg-white border border-slate-200/90 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition-all shadow-2xs font-medium"
                  />
                </div>
                <div className="mt-2 flex items-center">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-[11px] text-slate-500 hover:text-slate-700 select-none font-medium">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(e) => setRememberEmail(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600/30 cursor-pointer w-3.5 h-3.5"
                    />
                    <span>Remember Staff Email</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Password</label>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-white border border-slate-200/90 rounded-xl pl-10 pr-11 py-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 font-mono transition-all shadow-2xs font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/25 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In to Workspace'}
                <ArrowRight size={16} />
              </button>

              <div className="pt-2 text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 text-slate-500 text-[11px] font-medium border border-slate-200/80">
                  <UserCheck size={12} className="text-indigo-500" />
                  <span>New staff account? Contact Dr. Kishor (Admin)</span>
                </span>
              </div>
            </form>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              DOOR 2: SUBSCRIBER PASSBOOK PORTAL (QR SCAN & MPIN)
              ═══════════════════════════════════════════════════════════════ */}
          {portalDoor === 'subscriber' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Subscriber Sub-toggle: QR vs PIN */}
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setSubscriberMode('qr');
                    setErrorMsg(null);
                  }}
                  className={`py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    subscriberMode === 'qr'
                      ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <QrCode size={13} />
                  <span>Passbook QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setSubscriberMode('pin');
                    setErrorMsg(null);
                  }}
                  className={`py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    subscriberMode === 'pin'
                      ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Phone size={13} />
                  <span>Phone &amp; PIN</span>
                </button>
              </div>

              {/* Sub-tab A: Passbook QR Scanner */}
              {subscriberMode === 'qr' && (
                <div className="p-5 rounded-2xl bg-emerald-50/40 border border-emerald-100 flex flex-col items-center justify-center text-center space-y-3.5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm relative overflow-hidden">
                      <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_8px_#10b981] animate-laser-scan pointer-events-none" />
                      <QrCode size={42} className="text-emerald-600" />
                    </div>
                    <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-600 rounded-tl-xs" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-600 rounded-tr-xs" />
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-600 rounded-bl-xs" />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-600 rounded-br-xs" />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Scan Pocket Passbook QR</h2>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed max-w-[240px]">
                      Point your phone camera at the official QR sticker on your physical chit passbook.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/25 cursor-pointer"
                  >
                    <Camera size={16} />
                    <span>Open Camera Scanner</span>
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
                    <Sparkles size={12} className="text-emerald-500 shrink-0" />
                    <span>Tip: Works directly with your standard phone camera app.</span>
                  </div>
                </div>
              )}

              {/* Sub-tab B: Subscriber Mobile & MPIN Login */}
              {subscriberMode === 'pin' && (
                <form onSubmit={handlePhonePinLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Mobile Number</label>
                    <div className="relative flex rounded-xl bg-white border border-slate-200/90 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/10 overflow-hidden transition-all shadow-2xs">
                      <div className="px-3.5 py-3 bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-1 shrink-0">
                        +91
                      </div>
                      <input
                        type="tel"
                        required
                        value={subscriberPhone}
                        onChange={(e) => setSubscriberPhone(e.target.value)}
                        placeholder="10-digit mobile number"
                        maxLength={10}
                        className="w-full bg-transparent px-3.5 py-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none font-mono font-medium"
                      />
                    </div>
                    <div className="mt-2 flex items-center">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-[11px] text-slate-500 hover:text-slate-700 select-none font-medium">
                        <input
                          type="checkbox"
                          checked={rememberPhone}
                          onChange={(e) => setRememberPhone(e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600/30 cursor-pointer w-3.5 h-3.5"
                        />
                        <span>Remember Mobile Number</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">4-Digit Passbook PIN</label>
                    <div className="relative flex items-center">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <KeyRound size={16} />
                      </div>
                      <input
                        type="password"
                        required
                        value={subscriberPin}
                        onChange={(e) => setSubscriberPin(e.target.value)}
                        placeholder="••••"
                        maxLength={6}
                        className="w-full bg-white border border-slate-200/90 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 font-mono tracking-widest transition-all shadow-2xs font-semibold"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
                      Default PIN is <span className="font-mono font-bold text-slate-600">1234</span> unless updated.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/25 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Authenticating...' : 'Sign In to Passbook'}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Footer Security Badge */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <Shield size={13} className="text-indigo-600 shrink-0" />
            <span>Encrypted Community Ledger &amp; Treasury</span>
          </div>
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
