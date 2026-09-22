'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase/client';
import { triggerHapticFeedback } from '@/utils/haptics';
import {
  User,
  Lock,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  RefreshCw,
  Sliders,
  Save,
  LogOut,
  Info
} from 'lucide-react';

type SettingsSubTab = 'profile' | 'security';

export default function SettingsManager() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('profile');

  // Profile Form State
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [email] = useState(profile?.email || user?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Security / Password Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Sync profile data when context changes
  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setPhoneNumber(profile.phoneNumber || '');
    }
  }, [profile]);

  const normalizePhoneDigits = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  };

  // 1. Save Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    const cleanName = fullName.trim();
    const cleanPhone = normalizePhoneDigits(phoneNumber);

    if (!cleanName) {
      setProfileErrorMsg('Please provide a valid full name.');
      triggerHapticFeedback('warning');
      return;
    }

    if (cleanPhone && cleanPhone.length !== 10) {
      setProfileErrorMsg('Mobile number must be exactly 10 digits.');
      triggerHapticFeedback('warning');
      return;
    }

    try {
      setIsSavingProfile(true);

      if (profile?.id) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: cleanName,
            phone_number: cleanPhone,
          })
          .eq('id', profile.id);

        if (error) throw error;
      }

      // Also update auth metadata if signed in via Supabase user
      if (user) {
        await supabase.auth.updateUser({
          data: {
            full_name: cleanName,
            phone_number: cleanPhone,
          },
        });
      }

      await refreshProfile();
      setProfileSuccessMsg('Profile updated successfully!');
      triggerHapticFeedback('success');
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'Failed to update profile.');
      triggerHapticFeedback('error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 2. Update Admin Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccessMsg(null);
    setPasswordErrorMsg(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordErrorMsg('New password must be at least 6 characters long.');
      triggerHapticFeedback('warning');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('Passwords do not match. Please verify and try again.');
      triggerHapticFeedback('warning');
      return;
    }

    try {
      setIsUpdatingPassword(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordSuccessMsg('Your administrator password has been updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      triggerHapticFeedback('success');
    } catch (err: any) {
      setPasswordErrorMsg(err.message || 'Failed to update password. Please check your session.');
      triggerHapticFeedback('error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Top Header Ribbon ── */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-500/20 shrink-0">
              <Sliders size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                Settings &amp; Profile Management
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage your administrator account details and security password
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              <ShieldCheck size={14} />
              <span className="capitalize">{profile?.role || 'Administrator'} Role</span>
            </span>
          </div>
        </div>

        {/* Subtab Selector */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none border-t border-gray-150 mt-5 pt-4">
          <button
            type="button"
            onClick={() => setActiveSubTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
              activeSubTab === 'profile'
                ? 'bg-gray-900 text-white shadow-xs'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
            }`}
          >
            <User size={14} />
            <span>Profile &amp; Account</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
              activeSubTab === 'security'
                ? 'bg-gray-900 text-white shadow-xs'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
            }`}
          >
            <Lock size={14} />
            <span>Security &amp; Password</span>
          </button>
        </div>
      </div>

      {/* ── SUB-TAB 1: PROFILE & ACCOUNT ── */}
      {activeSubTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Main Profile Form */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-3xl p-6 sm:p-7 shadow-2xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-gray-900">Administrator Profile</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Update your name and primary mobile number associated with your administrator account.
              </p>
            </div>

            {profileSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            {profileErrorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Full Name *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <User size={15} />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Kishor Anbazhakan"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-600 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Registered Mobile Number *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Phone size={15} />
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-600 rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono font-semibold text-gray-900 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Used for OTP verifications and internal audit signatures.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Admin Email Address (Supabase Auth)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail size={15} />
                  </div>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-gray-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Authenticated via Supabase Auth. Email changes require security verification.</p>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Saving Changes...
                    </>
                  ) : (
                    <>
                      <Save size={14} /> Save Profile Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Account Summary & Badge Card */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Account Overview</h4>
              
              <div className="flex items-center space-x-3.5 pb-4 border-b border-gray-100">
                <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-gray-900 truncate">
                    {profile?.fullName || 'Administrator'}
                  </h4>
                  <span className="text-xs text-gray-500 truncate block">
                    {profile?.phoneNumber || email}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">Access Tier</span>
                  <span className="font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md uppercase text-[10px]">
                    {profile?.role || 'Admin'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">Database Profile ID</span>
                  <span className="font-mono text-gray-700 font-semibold text-[11px] truncate max-w-[120px]">
                    {profile?.id || 'Active'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 font-medium">Realtime Ledger</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Connected
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Info size={14} className="text-indigo-600" />
                <span>Need Role Delegation?</span>
              </div>
              <p className="text-[11px] text-indigo-800">
                You can assign manager roles or invite operational staff in the <strong>Access Control</strong> tab.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 2: SECURITY & PASSWORD ── */}
      {activeSubTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-3xl p-6 sm:p-7 shadow-2xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-gray-900">Change Administrator Password</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Set a strong, new password for your administrator account.
              </p>
            </div>

            {passwordSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{passwordSuccessMsg}</span>
              </div>
            )}

            {passwordErrorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{passwordErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  New Administrator Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock size={15} />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-600 rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono font-semibold text-gray-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <KeyRound size={15} />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-600 rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono font-semibold text-gray-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-[11px] text-gray-600 space-y-1">
                <span className="font-bold text-gray-800 block">Password Requirements:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-gray-500">
                  <li className={newPassword.length >= 6 ? 'text-emerald-700 font-semibold' : ''}>
                    At least 6 characters long
                  </li>
                  <li className={newPassword && newPassword === confirmPassword ? 'text-emerald-700 font-semibold' : ''}>
                    Passwords must match
                  </li>
                </ul>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {isUpdatingPassword ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Updating Password...
                    </>
                  ) : (
                    <>
                      <Lock size={14} /> Update Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Session Safety Card */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Session Security</h4>
              
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-700" />
                  <span>Secure SSL &amp; RLS Protected</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Every query is strictly isolated by PostgreSQL Row-Level Security policies.
                </p>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <LogOut size={14} /> End Active Session / Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
