'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOrganization, computeInitials } from '@/context/OrganizationContext';
import { supabase } from '@/utils/supabase/client';
import { triggerHapticFeedback } from '@/utils/haptics';
import SlideToConfirm from './SlideToConfirm';
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
  Info,
  Database,
  Trash2,
  AlertTriangle,
  Layers,
  Flame,
  X,
  Coins,
  Users,
  Trophy,
  History,
  Building2,
  Sparkles,
  Landmark,
  BadgeCheck,
  Check
} from 'lucide-react';

type SettingsSubTab = 'organization' | 'profile' | 'security' | 'database';

interface DatabaseStats {
  groupsCount: number;
  membershipsCount: number;
  subscribersCount: number;
  transactionsCount: number;
  auctionLogsCount: number;
  auditLogsCount: number;
}

export default function SettingsManager() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const {
    organizationName: globalOrgName,
    organizationTagline: globalOrgTagline,
    organizationInitials: globalOrgInitials,
    updateOrganizationSettings,
  } = useOrganization();

  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('organization');

  // Organization Branding Form State
  const [orgNameInput, setOrgNameInput] = useState(globalOrgName);
  const [orgTaglineInput, setOrgTaglineInput] = useState(globalOrgTagline);
  const [orgInitialsInput, setOrgInitialsInput] = useState(globalOrgInitials);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [orgSuccessMsg, setOrgSuccessMsg] = useState<string | null>(null);
  const [orgErrorMsg, setOrgErrorMsg] = useState<string | null>(null);

  // Sync organization state when global context updates
  useEffect(() => {
    setOrgNameInput(globalOrgName);
    setOrgTaglineInput(globalOrgTagline);
    setOrgInitialsInput(globalOrgInitials);
  }, [globalOrgName, globalOrgTagline, globalOrgInitials]);

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

  // Database Management / Reset States
  const [dbStats, setDbStats] = useState<DatabaseStats>({
    groupsCount: 0,
    membershipsCount: 0,
    subscribersCount: 0,
    transactionsCount: 0,
    auctionLogsCount: 0,
    auditLogsCount: 0,
  });
  const [loadingDbStats, setLoadingDbStats] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [isResettingDb, setIsResettingDb] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);

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

  // Fetch live database statistics for test data
  const fetchDbStats = useCallback(async () => {
    try {
      setLoadingDbStats(true);
      const [
        { count: groupsCount },
        { count: membershipsCount },
        { count: subscribersCount },
        { count: transactionsCount },
        { count: auctionLogsCount },
        { count: auditLogsCount },
      ] = await Promise.all([
        supabase.from('chit_groups').select('*', { count: 'exact', head: true }),
        supabase.from('group_members').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'subscriber'),
        supabase.from('transactions').select('*', { count: 'exact', head: true }),
        supabase.from('auction_logs').select('*', { count: 'exact', head: true }),
        supabase.from('security_audit_logs').select('*', { count: 'exact', head: true }),
      ]);

      setDbStats({
        groupsCount: groupsCount || 0,
        membershipsCount: membershipsCount || 0,
        subscribersCount: subscribersCount || 0,
        transactionsCount: transactionsCount || 0,
        auctionLogsCount: auctionLogsCount || 0,
        auditLogsCount: auditLogsCount || 0,
      });
    } catch (err) {
      console.error('Failed to load database stats:', err);
    } finally {
      setLoadingDbStats(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'database') {
      fetchDbStats();
    }
  }, [activeSubTab, fetchDbStats]);

  // Save Organization Branding Settings
  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgSuccessMsg(null);
    setOrgErrorMsg(null);

    const cleanName = orgNameInput.trim();
    if (!cleanName) {
      setOrgErrorMsg('Please enter a valid Chit Funds / Organization Name.');
      triggerHapticFeedback('warning');
      return;
    }

    try {
      setIsSavingOrg(true);
      triggerHapticFeedback('light');

      const computed = orgInitialsInput.trim() || computeInitials(cleanName);
      const res = await updateOrganizationSettings({
        name: cleanName,
        tagline: orgTaglineInput.trim(),
        initials: computed,
      });

      if (!res.success) {
        setOrgErrorMsg(res.error || 'Failed to update organization settings.');
        triggerHapticFeedback('error');
      } else {
        setOrgSuccessMsg('Organization branding saved successfully! Applied globally across all tabs, reports, and receipts.');
        triggerHapticFeedback('success');
      }
    } catch (err: any) {
      console.error('Save organization failed:', err);
      setOrgErrorMsg(err.message || 'An unexpected error occurred.');
      triggerHapticFeedback('error');
    } finally {
      setIsSavingOrg(false);
    }
  };

  // Save Profile Changes
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

  // Update Admin Password
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

  // Execute Complete Test Database Reset / Purge
  const handleExecuteDatabaseReset = async () => {
    if (confirmKeyword.trim().toUpperCase() !== 'RESET') {
      setResetErrorMsg('Please type RESET in capital letters to confirm database purge.');
      triggerHapticFeedback('warning');
      return;
    }

    try {
      setIsResettingDb(true);
      setResetErrorMsg(null);
      setResetSuccessMsg(null);

      const { data: rpcRes, error } = await supabase.rpc('reset_test_database', {
        p_confirm_phrase: 'WIPE_ALL_DATA',
      });

      if (error || (rpcRes && !rpcRes.success)) {
        const errorDetail = rpcRes?.error || error?.message;
        console.warn('RPC reset_test_database returned error, attempting direct cascade reset:', errorDetail);

        try {
          await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('auction_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('group_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('chit_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('passbook_inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('profiles').delete().eq('role', 'subscriber');
          await supabase.from('global_treasury').update({
            current_balance: 0,
            pending_verification_balance: 0,
            last_updated_by: profile?.id || null
          }).neq('wallet_type', '');
        } catch (directErr: any) {
          throw new Error(errorDetail || directErr.message || 'Database reset failed.');
        }
      }

      triggerHapticFeedback('success');
      setResetSuccessMsg('Database test data cleared successfully! All groups, transactions, auctions, and test subscribers wiped. Treasury vaults reset to ₹0.');
      setShowResetModal(false);
      setConfirmKeyword('');
      await fetchDbStats();
    } catch (err: any) {
      console.error('Failed to reset database:', err);
      setResetErrorMsg(err.message || 'An error occurred while resetting the database.');
      triggerHapticFeedback('error');
    } finally {
      setIsResettingDb(false);
    }
  };

  return (
    <div className="w-full bg-slate-50 min-h-screen text-slate-800 antialiased flex flex-col font-sans">
      
      {/* ═══════════════════════════════════════════════════════════════════
          MOBILE VIEW (360px Native Android feel — block lg:hidden)
          Spacious, Clean, Touch-First UI with Zero Unnecessary Clutter
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="block lg:hidden w-full max-w-sm mx-auto bg-[#F8FAFC] min-h-screen flex flex-col shadow-xl border-x border-slate-200/80 pb-24">
        
        {/* Android Status Bar & Top Bar */}
        <header className="bg-white/95 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100 pt-2">
          {/* Status Bar simulation */}
          <div className="px-4 pt-1 pb-1 flex justify-between items-center text-xs font-semibold text-slate-900 tracking-tight">
            <span>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            <div className="flex items-center space-x-1.5">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 18.25A10.93 10.93 0 0 1 1 12C1 5.92 5.92 1 12 1s11 4.92 11 11c0 2.34-.73 4.51-1.98 6.29l-.62-.62A8.96 8.96 0 0 0 21 12c0-4.97-4.03-9-9-9z"></path><circle cx="12" cy="18" r="2"></circle></svg>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98A16.88 16.88 0 0 0 12 4z"></path></svg>
              <div className="w-5 h-2.5 border border-slate-800 rounded-xs p-0.5 flex items-center">
                <div className="w-full h-full bg-slate-800 rounded-2xs"></div>
              </div>
            </div>
          </div>

          {/* App Header */}
          <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100/80">
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 leading-tight">Portal Settings</h1>
              <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                System Controls &amp; Branding
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 border border-brand-200">
              Admin
            </span>
          </div>

          {/* Subtab Segmented Chips */}
          <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100">
            <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => { setActiveSubTab('organization'); triggerHapticFeedback('light'); }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'organization'
                    ? 'bg-brand-500 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 size={13} />
                <span>Branding</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveSubTab('profile'); triggerHapticFeedback('light'); }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'profile'
                    ? 'bg-brand-500 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <User size={13} />
                <span>Profile</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveSubTab('security'); triggerHapticFeedback('light'); }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'security'
                    ? 'bg-brand-500 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Lock size={13} />
                <span>Security</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveSubTab('database'); triggerHapticFeedback('light'); }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'database'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <Database size={13} />
                <span>Database</span>
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Tab Content Body */}
        <div className="p-3.5 space-y-3.5 flex-1">
          
          {/* ── MOBILE SUBTAB 1: BRANDING ── */}
          {activeSubTab === 'organization' && (
            <div className="space-y-3">
              {/* Live Mini Preview Banner */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-3.5 rounded-2xl shadow-card border border-indigo-500/20">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                  <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider flex items-center gap-1">
                    <Sparkles size={11} className="text-emerald-400" />
                    <span>Live Branding Preview</span>
                  </span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.2 rounded font-mono font-bold">
                    ACTIVE
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-brand-500 text-white font-black flex items-center justify-center text-sm shadow-md shrink-0">
                    {orgInitialsInput.trim() || computeInitials(orgNameInput || 'CF')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-black uppercase tracking-wide truncate text-white">
                      {orgNameInput.trim() || 'KISHOR CHIT FUNDS'}
                    </h3>
                    <p className="text-[10px] text-indigo-200 truncate mt-0.5">
                      {orgTaglineInput.trim() || 'TRUSTED COMMUNITY CHIT FUNDS'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Feedback messages */}
              {orgSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{orgSuccessMsg}</span>
                </div>
              )}
              {orgErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{orgErrorMsg}</span>
                </div>
              )}

              {/* Form Card */}
              <form onSubmit={handleSaveOrganization} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card space-y-3 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Organization Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={orgNameInput}
                      onChange={(e) => setOrgNameInput(e.target.value)}
                      placeholder="e.g. KISHOR CHIT FUNDS"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 uppercase focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Official Tagline
                  </label>
                  <input
                    type="text"
                    value={orgTaglineInput}
                    onChange={(e) => setOrgTaglineInput(e.target.value)}
                    placeholder="e.g. TRUSTED CHIT FUNDS"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 uppercase focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Logo Initials (2-3 Chars)
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={orgInitialsInput}
                    onChange={(e) => setOrgInitialsInput(e.target.value.toUpperCase())}
                    placeholder={computeInitials(orgNameInput || 'CF')}
                    className="w-24 bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-900 uppercase focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingOrg}
                  className="w-full mt-2 py-3 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingOrg ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={14} /> Save Organization Branding
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ── MOBILE SUBTAB 2: PROFILE ── */}
          {activeSubTab === 'profile' && (
            <div className="space-y-3">
              {/* Profile Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center text-base shadow-sm">
                  {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-slate-900 truncate">
                    {profile?.fullName || 'Administrator'}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono truncate">{profile?.phoneNumber || email}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                  {profile?.role || 'Admin'}
                </span>
              </div>

              {profileSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}
              {profileErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{profileErrorMsg}</span>
                </div>
              )}

              {/* Profile Form */}
              <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card space-y-3 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Kishor Anbazhakan"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Registered Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Auth Email Address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 cursor-not-allowed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full mt-2 py-3 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={14} /> Update Profile Details
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ── MOBILE SUBTAB 3: SECURITY ── */}
          {activeSubTab === 'security' && (
            <div className="space-y-3">
              {passwordSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{passwordSuccessMsg}</span>
                </div>
              )}
              {passwordErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{passwordErrorMsg}</span>
                </div>
              )}

              {/* Password Form Card */}
              <form onSubmit={handleUpdatePassword} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-2">
                  Change Administrator Password
                </h4>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-xl px-3 py-2 pr-10 text-xs font-mono font-semibold text-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-xl px-3 py-2 pr-10 text-xs font-mono font-semibold text-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full mt-2 py-3 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingPassword ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Updating...
                    </>
                  ) : (
                    <>
                      <Lock size={14} /> Update Password
                    </>
                  )}
                </button>
              </form>

              {/* End Active Session Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>Session Security</span>
                </div>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <LogOut size={14} /> Sign Out of Admin Account
                </button>
              </div>
            </div>
          )}

          {/* ── MOBILE SUBTAB 4: DATABASE ── */}
          {activeSubTab === 'database' && (
            <div className="space-y-3">
              {resetSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{resetSuccessMsg}</span>
                </div>
              )}
              {resetErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{resetErrorMsg}</span>
                </div>
              )}

              {/* Database Telemetry Grid (2 Cols) */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Groups</span>
                  <p className="text-lg font-black font-mono text-slate-900 mt-0.5">
                    {loadingDbStats ? '...' : dbStats.groupsCount}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Tickets</span>
                  <p className="text-lg font-black font-mono text-slate-900 mt-0.5">
                    {loadingDbStats ? '...' : dbStats.membershipsCount}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Subscribers</span>
                  <p className="text-lg font-black font-mono text-slate-900 mt-0.5">
                    {loadingDbStats ? '...' : dbStats.subscribersCount}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Transactions</span>
                  <p className="text-lg font-black font-mono text-slate-900 mt-0.5">
                    {loadingDbStats ? '...' : dbStats.transactionsCount}
                  </p>
                </div>
              </div>

              {/* Danger Zone Purge Card */}
              <div className="bg-white border-2 border-rose-200 rounded-2xl p-4 shadow-card space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
                  <Flame size={16} className="text-rose-600" />
                  <span>Danger Zone: Database Reset</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Wipes test groups, tickets, and transactions. Admin account &amp; tables remain intact.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmKeyword('');
                    setResetErrorMsg(null);
                    setShowResetModal(true);
                    triggerHapticFeedback('warning');
                  }}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Trash2 size={15} />
                  <span>Purge Test Database</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          DESKTOP VIEW (1440px / hidden lg:flex flex-col)
          Full-width, Two-Pane Institutional Fintech Layout
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col flex-1 w-full">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between flex-shrink-0 z-20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold font-display text-slate-900 tracking-tight whitespace-nowrap">
                Portal Settings &amp; System Management
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Admin Security Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/70">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Role: <strong className="capitalize text-slate-900">{profile?.role || 'Administrator'}</strong></span>
            </span>
          </div>
        </header>

        {/* Workspace Body */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="w-full max-w-[1550px] mx-auto space-y-6">

            {/* Subtab Selector Ribbon */}
            <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setActiveSubTab('organization'); triggerHapticFeedback('light'); }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                    activeSubTab === 'organization'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 size={14} className={activeSubTab === 'organization' ? 'text-brand-600' : 'text-slate-400'} />
                  <span>Chit Funds Branding</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveSubTab('profile'); triggerHapticFeedback('light'); }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                    activeSubTab === 'profile'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User size={14} className={activeSubTab === 'profile' ? 'text-brand-600' : 'text-slate-400'} />
                  <span>Profile &amp; Account</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveSubTab('security'); triggerHapticFeedback('light'); }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                    activeSubTab === 'security'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Lock size={14} className={activeSubTab === 'security' ? 'text-brand-600' : 'text-slate-400'} />
                  <span>Security &amp; Password</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveSubTab('database'); triggerHapticFeedback('light'); }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                    activeSubTab === 'database'
                      ? 'bg-rose-600 text-white shadow-2xs font-bold'
                      : 'text-rose-700 hover:bg-rose-100/50'
                  }`}
                >
                  <Database size={14} />
                  <span>Database &amp; Test Purge</span>
                </button>
              </div>

              <span className="text-xs text-slate-400 font-mono pr-2">
                Supabase RLS Protected
              </span>
            </div>

            {/* ── DESKTOP SUBTAB 1: ORGANIZATION BRANDING ── */}
            {activeSubTab === 'organization' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left 7-Cols: Form Card */}
                <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                      <Building2 size={18} className="text-brand-600" />
                      <span>Chit Funds Organization Branding</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Applied globally across Receipt PNGs, PDF Reports, WhatsApp Broadcasts, and Passbook sheets.
                    </p>
                  </div>

                  {orgSuccessMsg && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span>{orgSuccessMsg}</span>
                    </div>
                  )}

                  {orgErrorMsg && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-600 shrink-0" />
                      <span>{orgErrorMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveOrganization} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Chit Funds / Organization Name *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Building2 size={15} />
                        </div>
                        <input
                          type="text"
                          required
                          value={orgNameInput}
                          onChange={(e) => setOrgNameInput(e.target.value)}
                          placeholder="e.g. KISHOR CHIT FUNDS"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 focus:outline-none uppercase transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Primary business title rendered at top of all receipts and passbooks.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Official Tagline / Subtitle
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Sparkles size={15} />
                        </div>
                        <input
                          type="text"
                          value={orgTaglineInput}
                          onChange={(e) => setOrgTaglineInput(e.target.value)}
                          placeholder="e.g. TRUSTED COMMUNITY CHIT FUNDS"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-slate-800 focus:outline-none uppercase transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Brand Monogram / Logo Initials (2-3 chars)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Landmark size={15} />
                        </div>
                        <input
                          type="text"
                          maxLength={3}
                          value={orgInitialsInput}
                          onChange={(e) => setOrgInitialsInput(e.target.value.toUpperCase())}
                          placeholder={computeInitials(orgNameInput || 'CF')}
                          className="w-32 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono font-black text-slate-900 focus:outline-none uppercase transition-all"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingOrg}
                        className="bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingOrg ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Saving...
                          </>
                        ) : (
                          <>
                            <Save size={14} /> Save Organization Branding
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right 5-Cols: Live Branding Preview */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-card border border-indigo-500/20 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-emerald-400" />
                        <span>Live Visual Identity Preview</span>
                      </span>
                      <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                        ACTIVE
                      </span>
                    </div>

                    {/* Monogram + Title Header */}
                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-xl border border-white/10 flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-indigo-500 text-white font-black flex items-center justify-center text-base shadow-md shrink-0">
                        {orgInitialsInput.trim() || computeInitials(orgNameInput || 'CF')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black uppercase tracking-wider text-white truncate">
                          {orgNameInput.trim() || 'KISHOR CHIT FUNDS'}
                        </h4>
                        <p className="text-[11px] text-emerald-300 font-bold tracking-wider uppercase truncate mt-0.5">
                          {orgTaglineInput.trim() || 'TRUSTED COMMUNITY CHIT FUNDS'}
                        </p>
                      </div>
                    </div>

                    {/* Sync Checklist */}
                    <div className="space-y-2 text-xs pt-1">
                      <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">
                        Synchronized Across All Outputs:
                      </span>
                      <ul className="space-y-1.5 text-[11px] text-slate-300">
                        <li className="flex items-center gap-2">
                          <BadgeCheck size={14} className="text-emerald-400 shrink-0" />
                          <span>Payment Receipt PNGs &amp; Share Slips</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <BadgeCheck size={14} className="text-emerald-400 shrink-0" />
                          <span>Monthly Ledger Statements &amp; PDF Reports</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <BadgeCheck size={14} className="text-emerald-400 shrink-0" />
                          <span>Live Auction Minutes &amp; WhatsApp Templates</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ── DESKTOP SUBTAB 2: PROFILE & ACCOUNT ── */}
            {activeSubTab === 'profile' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left 7-Cols: Profile Form */}
                <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="font-display font-bold text-base text-slate-900">
                      Administrator Profile Details
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Update your administrator name and primary contact number.
                    </p>
                  </div>

                  {profileSuccessMsg && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span>{profileSuccessMsg}</span>
                    </div>
                  )}

                  {profileErrorMsg && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-600 shrink-0" />
                      <span>{profileErrorMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Full Name *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User size={15} />
                        </div>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Dr. Kishor Anbazhakan"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Registered Mobile Number *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Phone size={15} />
                        </div>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="10-digit mobile number"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono font-semibold text-slate-900 focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Admin Email Address (Supabase Auth)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail size={15} />
                        </div>
                        <input
                          type="email"
                          disabled
                          value={email}
                          className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-slate-500 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingProfile ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Saving...
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

                {/* Right 5-Cols: Account Overview */}
                <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Overview</h4>

                  <div className="flex items-center space-x-3.5 pb-4 border-b border-slate-100">
                    <div className="w-12 h-12 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-base shadow-sm">
                      {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {profile?.fullName || 'Administrator'}
                      </h4>
                      <span className="text-xs text-slate-500 truncate block">
                        {profile?.phoneNumber || email}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Access Tier</span>
                      <span className="font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md uppercase text-[10px]">
                        {profile?.role || 'Admin'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Database Profile ID</span>
                      <span className="font-mono text-slate-800 font-semibold text-[11px] truncate max-w-[140px]">
                        {profile?.id || 'Active'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">Realtime Channel</span>
                      <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Connected
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ── DESKTOP SUBTAB 3: SECURITY & PASSWORD ── */}
            {activeSubTab === 'security' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left 7-Cols: Password Change */}
                <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="font-display font-bold text-base text-slate-900">
                      Change Administrator Password
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Set a strong password for your administrator account.
                    </p>
                  </div>

                  {passwordSuccessMsg && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span>{passwordSuccessMsg}</span>
                    </div>
                  )}

                  {passwordErrorMsg && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-600 shrink-0" />
                      <span>{passwordErrorMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        New Administrator Password *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock size={15} />
                        </div>
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono font-semibold text-slate-900 focus:outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Confirm New Password *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <KeyRound size={15} />
                        </div>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat new password"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono font-semibold text-slate-900 focus:outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="submit"
                        disabled={isUpdatingPassword}
                        className="bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isUpdatingPassword ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Updating...
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

                {/* Right 5-Cols: Security Card */}
                <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Session Security</h4>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-600" />
                      <span>PostgreSQL Row-Level Security</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      All queries are verified against caller authorization credentials in real-time.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="w-full py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                      <LogOut size={14} /> End Active Session / Sign Out
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* ── DESKTOP SUBTAB 4: DATABASE & TEST DATA ── */}
            {activeSubTab === 'database' && (
              <div className="space-y-6">
                {resetSuccessMsg && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{resetSuccessMsg}</span>
                  </div>
                )}
                {resetErrorMsg && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                    <span>{resetErrorMsg}</span>
                  </div>
                )}

                {/* 6 Metric Telemetry Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Chit Groups</span>
                      <Layers size={14} className="text-brand-600" />
                    </div>
                    <p className="text-2xl font-black text-slate-900 font-mono">
                      {loadingDbStats ? '...' : dbStats.groupsCount}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Active &amp; Draft</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Tickets</span>
                      <Users size={14} className="text-indigo-600" />
                    </div>
                    <p className="text-2xl font-black text-slate-900 font-mono">
                      {loadingDbStats ? '...' : dbStats.membershipsCount}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Enrolled Members</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Subscribers</span>
                      <User size={14} className="text-purple-600" />
                    </div>
                    <p className="text-2xl font-black text-slate-900 font-mono">
                      {loadingDbStats ? '...' : dbStats.subscribersCount}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Registered Profiles</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Transactions</span>
                      <Coins size={14} className="text-emerald-600" />
                    </div>
                    <p className="text-2xl font-black text-slate-900 font-mono">
                      {loadingDbStats ? '...' : dbStats.transactionsCount}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Ledger Receipts</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Auctions</span>
                      <Trophy size={14} className="text-amber-500" />
                    </div>
                    <p className="text-2xl font-black text-slate-900 font-mono">
                      {loadingDbStats ? '...' : dbStats.auctionLogsCount}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Live Sessions</span>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Audit Logs</span>
                      <History size={14} className="text-slate-400" />
                    </div>
                    <p className="text-2xl font-black text-slate-900 font-mono">
                      {loadingDbStats ? '...' : dbStats.auditLogsCount}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Security Trails</span>
                  </div>
                </div>

                {/* Danger Zone Card */}
                <div className="bg-white border-2 border-rose-200 rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center space-x-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg shrink-0">
                        <Flame size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          Danger Zone: Test Database Reset
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Clear test data from Supabase before publishing or initiating new simulation rounds.
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                      Admin Exclusive
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/70 space-y-2">
                      <div className="font-bold text-rose-700 flex items-center gap-1.5">
                        <Trash2 size={14} />
                        <span>Data That Will Be Wiped:</span>
                      </div>
                      <ul className="space-y-1 text-slate-600 text-[11px] list-disc pl-4">
                        <li>All <strong className="text-slate-900">Chit Groups</strong> &amp; enrolled tickets</li>
                        <li>All <strong className="text-slate-900">Auction Logs</strong> &amp; bidding history</li>
                        <li>All <strong className="text-slate-900">Payment Transactions</strong> &amp; receipts</li>
                        <li>All <strong className="text-slate-900">Test Subscriber Profiles</strong></li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/70 space-y-2">
                      <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                        <ShieldCheck size={14} />
                        <span>Preserved System Structures:</span>
                      </div>
                      <ul className="space-y-1 text-slate-600 text-[11px] list-disc pl-4">
                        <li><strong className="text-slate-900">PostgreSQL Schema</strong>, tables, RLS policies</li>
                        <li><strong className="text-slate-900">Administrator Accounts</strong> (Dr. Kishor Anbazhakan)</li>
                        <li><strong className="text-slate-900">4 Treasury Vaults</strong> (balances reset to ₹0)</li>
                      </ul>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      ⚠️ This operation cannot be undone. Always verify you are ready to wipe test records.
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmKeyword('');
                        setResetErrorMsg(null);
                        setShowResetModal(true);
                        triggerHapticFeedback('warning');
                      }}
                      className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 size={15} />
                      <span>Delete Test Database &amp; Reset</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        </main>

      </div>

      {/* ── 2-STEP CONFIRMATION MODAL (SHARED MOBILE & DESKTOP) ── */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 w-full max-w-lg space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-150 text-slate-900">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    Confirm Database Test Purge
                  </h4>
                  <p className="text-xs text-slate-500">
                    Irreversible administrative operation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-rose-800">
                <Flame size={14} className="text-rose-600" />
                <span>You are about to purge all testing data:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-rose-900 pt-1">
                <div>• {dbStats.groupsCount} Chit Groups</div>
                <div>• {dbStats.membershipsCount} Enrolled Tickets</div>
                <div>• {dbStats.subscribersCount} Test Members</div>
                <div>• {dbStats.transactionsCount} Transactions</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Type <span className="font-mono text-rose-600 font-black">RESET</span> below to unlock confirmation:
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Type RESET here"
                value={confirmKeyword}
                onChange={(e) => setConfirmKeyword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 rounded-xl px-4 py-2.5 text-xs font-mono font-bold tracking-widest text-slate-900 focus:outline-none uppercase"
              />
            </div>

            <div className="pt-2">
              <SlideToConfirm
                onConfirm={handleExecuteDatabaseReset}
                disabled={confirmKeyword.trim().toUpperCase() !== 'RESET' || isResettingDb}
                isLoading={isResettingDb}
                label="Slide to Wipe All Test Data"
                confirmedLabel="Database Wiped!"
                loadingLabel="Purging Test Data..."
                colorVariant="red"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResettingDb}
                className="border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                Cancel / Keep Data
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
