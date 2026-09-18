'use client';

import React, { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { Lock, Mail, Phone, User, Shield, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { UserRole } from '@/context/AuthContext';

interface AuthScreenProps {
  onSuccess?: () => void;
}

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const normalizePhoneDigits = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (isSignUp) {
      const coreDigits = normalizePhoneDigits(phoneNumber);
      if (!phoneNumber.trim() || coreDigits.length === 0) {
        setErrorMsg('Please enter a valid 10-digit mobile number.');
        return;
      }
      if (coreDigits.length < 10) {
        setErrorMsg(`Phone number is too short (${coreDigits.length}/10 digits). Please enter exactly 10 digits.`);
        return;
      }
      if (coreDigits.length > 10) {
        setErrorMsg(`Phone number has too many digits (${coreDigits.length}/10 digits). Please enter exactly 10 digits.`);
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const coreDigits = normalizePhoneDigits(phoneNumber);
        // Sign Up Flow
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone_number: coreDigits,
              role: 'subscriber',
            },
          },
        });

        if (error) throw error;

        // Insert into public.profiles
        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName,
            phone_number: coreDigits,
            role: 'subscriber',
          });

          if (profileError) {
            console.warn('Profile creation note:', profileError.message);
          }
        }

        setSuccessMsg('Account created successfully! Logging you in...');
        if (onSuccess) onSuccess();
      } else {
        // Sign In Flow
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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow Header */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-xl mb-3 shadow-lg shadow-indigo-500/20">
            CF
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">ChitFund Manager</h2>
          <p className="text-xs text-slate-400 mt-1">
            {isSignUp ? 'Create your subscriber account' : 'Sign in to access your dashboard'}
          </p>
        </div>

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Kishor"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Phone Number (10 Digits)</label>
                  {phoneNumber.trim() && (
                    <span className={`text-[10px] font-bold ${
                      normalizePhoneDigits(phoneNumber).length === 10
                        ? 'text-emerald-400'
                        : normalizePhoneDigits(phoneNumber).length < 10
                          ? 'text-amber-400'
                          : 'text-rose-400'
                    }`}>
                      {normalizePhoneDigits(phoneNumber).length === 10
                        ? '✓ Valid 10 digits'
                        : `${normalizePhoneDigits(phoneNumber).length}/10 digits`}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 9842235740"
                    className={`w-full bg-slate-950 border rounded-lg pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono ${
                      !phoneNumber.trim()
                        ? 'border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                        : normalizePhoneDigits(phoneNumber).length === 10
                          ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                          : 'border-amber-500/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                    }`}
                  />
                </div>
                {phoneNumber.trim() && normalizePhoneDigits(phoneNumber).length !== 10 && (
                  <p className="text-[10px] text-amber-400 font-medium mt-1">
                    ⚠️ Must be exactly 10 digits ({normalizePhoneDigits(phoneNumber).length > 10 ? `${normalizePhoneDigits(phoneNumber).length - 10} digits too many` : `${10 - normalizePhoneDigits(phoneNumber).length} digits remaining`})
                  </p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Switch Mode */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
          >
            {isSignUp
              ? 'Already have an account? Sign In'
              : "Don't have an account yet? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
