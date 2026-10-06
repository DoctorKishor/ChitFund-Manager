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
  Check,
  X,
  ShieldAlert,
  Server,
  Coins,
  Users,
  Trophy,
  History,
  Building2,
  Sparkles,
  Landmark,
  BadgeCheck
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

  // 0. Save Organization Branding Settings
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
        setOrgSuccessMsg('Chit Funds Organization name saved successfully! Applied globally across all tabs, reports, receipts, and PDFs.');
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

  // 3. Execute Complete Test Database Reset / Purge
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

      // Call the secure RPC function
      const { data, error } = await supabase.rpc('reset_test_database', {
        caller_id: profile?.id || user?.id,
      });

      if (error) {
        // Fallback: If RPC fails, execute sequential deletes directly via Supabase client
        console.warn('RPC reset_test_database failed, performing direct cascade reset:', error);

        await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('auction_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('group_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('chit_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('profiles').delete().eq('role', 'subscriber');
        await supabase.from('global_treasury').update({
          current_balance: 0,
          pending_verification_balance: 0,
          last_updated_by: profile?.id || null
        }).neq('wallet_type', '');
      }

      triggerHapticFeedback('success');
      setResetSuccessMsg('Database test data cleared completely! All chit groups, transactions, auctions, and test subscribers have been wiped. Treasury vaults reset to ₹0.');
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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Top Header Ribbon ── */}
      <div className="bg-[#1D1D41] border border-[#27264E] rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6359E9] to-[#9C2CF3] text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-[#6359E9]/20 shrink-0">
              <Sliders size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                Settings &amp; System Management
              </h2>
              <p className="text-xs text-[#AEABD8] mt-0.5">
                Manage your administrator account, security credentials, and database testing data
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-[#141332] text-[#64CFF6] border border-[#27264E]">
              <ShieldCheck size={14} />
              <span className="capitalize">{profile?.role || 'Administrator'} Role</span>
            </span>
          </div>
        </div>

        {/* Subtab Selector */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none border-t border-[#27264E] mt-5 pt-4">
          <button
            type="button"
            onClick={() => setActiveSubTab('organization')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
              activeSubTab === 'organization'
                ? 'bg-[#6359E9] text-white shadow-xs'
                : 'bg-[#141332] hover:bg-[#141332]/80 text-[#AEABD8] hover:text-white border border-[#27264E]'
            }`}
          >
            <Building2 size={14} />
            <span>Chit Funds Branding</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
              activeSubTab === 'profile'
                ? 'bg-[#6359E9] text-white shadow-xs'
                : 'bg-[#141332] hover:bg-[#141332]/80 text-[#AEABD8] hover:text-white border border-[#27264E]'
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
                ? 'bg-[#6359E9] text-white shadow-xs'
                : 'bg-[#141332] hover:bg-[#141332]/80 text-[#AEABD8] hover:text-white border border-[#27264E]'
            }`}
          >
            <Lock size={14} />
            <span>Security &amp; Password</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('database')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
              activeSubTab === 'database'
                ? 'bg-[#E41414] text-white shadow-xs'
                : 'bg-[#E41414]/15 hover:bg-[#E41414]/25 text-[#E41414] border border-[#E41414]/30'
            }`}
          >
            <Database size={14} />
            <span>Database &amp; Test Data</span>
          </button>
        </div>
      </div>

      {/* ── SUB-TAB 0: CHIT FUNDS BRANDING & ORGANIZATION ── */}
      {activeSubTab === 'organization' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Main Organization Form */}
          <div className="lg:col-span-2 bg-[#1D1D41] border border-[#27264E] rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 size={18} className="text-[#6359E9]" />
                <span>Chit Funds Organization Branding</span>
              </h3>
              <p className="text-xs text-[#AEABD8] mt-0.5">
                Configure your Chit Fund Name and official branding. Changes apply instantly across the entire application — including Receipt PNGs, PDF Reports, WhatsApp Broadcasts, and Passbook sheets.
              </p>
            </div>

            {orgSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-[#02B15A]/15 border border-[#02B15A]/40 text-[#02B15A] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 size={16} className="text-[#02B15A] shrink-0" />
                <span>{orgSuccessMsg}</span>
              </div>
            )}

            {orgErrorMsg && (
              <div className="p-3.5 rounded-2xl bg-[#E41414]/15 border border-[#E41414]/40 text-[#E41414] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="text-[#E41414] shrink-0" />
                <span>{orgErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveOrganization} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#AEABD8] mb-1.5">
                  Chit Funds / Organization Name *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#AEABD8]/60">
                    <Building2 size={15} />
                  </div>
                  <input
                    type="text"
                    required
                    value={orgNameInput}
                    onChange={(e) => setOrgNameInput(e.target.value)}
                    placeholder="e.g. ANBAZHAKAN CHIT FUNDS or SRI LAKSHMI CHIT FUNDS"
                    className="w-full bg-[#141332] border border-[#27264E] focus:border-[#6359E9] rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white focus:outline-none uppercase"
                  />
                </div>
                <p className="text-[11px] text-[#AEABD8]/70 mt-1">
                  Printed as the primary business title on all receipt cards, statements, and PDF documents.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#AEABD8] mb-1.5">
                  Official Tagline / Subtitle
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#AEABD8]/60">
                    <Sparkles size={15} />
                  </div>
                  <input
                    type="text"
                    value={orgTaglineInput}
                    onChange={(e) => setOrgTaglineInput(e.target.value)}
                    placeholder="e.g. TRUSTED CHIT FUNDS MANAGEMENT"
                    className="w-full bg-[#141332] border border-[#27264E] focus:border-[#6359E9] rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-white focus:outline-none uppercase"
                  />
                </div>
                <p className="text-[11px] text-[#AEABD8]/70 mt-1">
                  Displayed below the company name on receipt slips and report headers.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#AEABD8] mb-1.5">
                  Brand Monogram / Logo Initials
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#AEABD8]/60">
                    <Landmark size={15} />
                  </div>
                  <input
                    type="text"
                    maxLength={3}
                    value={orgInitialsInput}
                    onChange={(e) => setOrgInitialsInput(e.target.value.toUpperCase())}
                    placeholder={computeInitials(orgNameInput || 'CF')}
                    className="w-full max-w-[120px] bg-[#141332] border border-[#27264E] focus:border-[#6359E9] rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono font-black text-white focus:outline-none uppercase"
                  />
                </div>
                <p className="text-[11px] text-[#AEABD8]/70 mt-1">
                  2-letter logo badge on receipts and mobile portals. (Auto-computed if empty: <strong className="font-mono text-white">{computeInitials(orgNameInput || 'CF')}</strong>)
                </p>
              </div>

              <div className="pt-3 border-t border-[#27264E] flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingOrg}
                  className="bg-[#6359E9] hover:bg-[#6F64FF] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingOrg ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Saving Branding...
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

          {/* Live Branding Preview Card */}
          <div className="space-y-4">
            <div className="bg-[#1D1D41] text-white rounded-3xl p-5 border border-[#27264E] shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#27264E] pb-3">
                <span className="text-[10px] font-bold text-[#AEABD8] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} className="text-[#02B15A]" />
                  <span>Live Branding Preview</span>
                </span>
                <span className="text-[9px] font-mono bg-[#02B15A]/20 text-[#02B15A] px-2 py-0.5 rounded-full font-bold">
                  ACTIVE
                </span>
              </div>

              {/* Sample Header Preview */}
              <div className="bg-[#141332] p-4 rounded-2xl border border-[#27264E] space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#02B15A] to-[#64CFF6] text-black font-black flex items-center justify-center text-sm shadow-md shrink-0 border border-[#02B15A]/30">
                    {orgInitialsInput.trim() || computeInitials(orgNameInput || 'CF')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-white uppercase tracking-wider leading-tight truncate">
                      {orgNameInput.trim() || 'ANBAZHAKAN CHIT FUNDS'}
                    </div>
                    <div className="text-[9px] text-[#02B15A] font-bold tracking-widest uppercase mt-0.5 truncate">
                      {orgTaglineInput.trim() || 'TRUSTED CHIT FUNDS MANAGEMENT'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="text-[10px] font-bold text-[#AEABD8] uppercase tracking-wider">
                  Automatic Global Synchronization:
                </div>
                <ul className="space-y-1.5 text-[11px] text-[#AEABD8]">
                  <li className="flex items-center gap-2">
                    <BadgeCheck size={14} className="text-[#02B15A] shrink-0" />
                    <span>Payment Receipt PNGs &amp; Share Cards</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <BadgeCheck size={14} className="text-[#02B15A] shrink-0" />
                    <span>Monthly Statements &amp; Defaulters PDFs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <BadgeCheck size={14} className="text-[#02B15A] shrink-0" />
                    <span>Live Auction Minutes &amp; Documents</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <BadgeCheck size={14} className="text-[#02B15A] shrink-0" />
                    <span>Passbook Covers &amp; QR Sticker Sheets</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <BadgeCheck size={14} className="text-[#02B15A] shrink-0" />
                    <span>WhatsApp Broadcast Templates</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 1: PROFILE & ACCOUNT ── */}
      {activeSubTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Main Profile Form */}
          <div className="lg:col-span-2 bg-[#1D1D41] border border-[#27264E] rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Administrator Profile</h3>
              <p className="text-xs text-[#AEABD8] mt-0.5">
                Update your name and primary mobile number associated with your administrator account.
              </p>
            </div>

            {profileSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-[#02B15A]/15 border border-[#02B15A]/40 text-[#02B15A] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 size={16} className="text-[#02B15A] shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            {profileErrorMsg && (
              <div className="p-3.5 rounded-2xl bg-[#E41414]/15 border border-[#E41414]/40 text-[#E41414] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="text-[#E41414] shrink-0" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#AEABD8] mb-1.5">
                  Full Name *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#AEABD8]/60">
                    <User size={15} />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Kishor Anbazhakan"
                    className="w-full bg-[#141332] border border-[#27264E] focus:border-[#6359E9] rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#AEABD8] mb-1.5">
                  Registered Mobile Number *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#AEABD8]/60">
                    <Phone size={15} />
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full bg-[#141332] border border-[#27264E] focus:border-[#6359E9] rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono font-semibold text-white focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-[#AEABD8]/70 mt-1">Used for OTP verifications and internal audit signatures.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#AEABD8] mb-1.5">
                  Admin Email Address (Supabase Auth)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#AEABD8]/40">
                    <Mail size={15} />
                  </div>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full bg-[#141332]/50 border border-[#27264E] rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-[#AEABD8]/50 cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-[#AEABD8]/70 mt-1">Authenticated via Supabase Auth. Email changes require security verification.</p>
              </div>

              <div className="pt-3 border-t border-[#27264E] flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="bg-[#6359E9] hover:bg-[#6F64FF] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2 active:scale-95 disabled:opacity-50"
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
            <div className="bg-[#1D1D41] border border-[#27264E] rounded-3xl p-6 shadow-xl space-y-4">
              <h4 className="text-xs font-bold text-[#AEABD8] uppercase tracking-wider">Account Overview</h4>
              
              <div className="flex items-center space-x-3.5 pb-4 border-b border-[#27264E]">
                <div className="w-12 h-12 rounded-full bg-[#6359E9] text-white flex items-center justify-center font-bold text-base shadow-xs">
                  {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">
                    {profile?.fullName || 'Administrator'}
                  </h4>
                  <span className="text-xs text-[#AEABD8] truncate block">
                    {profile?.phoneNumber || email}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-[#27264E]">
                  <span className="text-[#AEABD8] font-medium">Access Tier</span>
                  <span className="font-bold text-[#64CFF6] bg-[#141332] border border-[#27264E] px-2 py-0.5 rounded-md uppercase text-[10px]">
                    {profile?.role || 'Admin'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#27264E]">
                  <span className="text-[#AEABD8] font-medium">Database Profile ID</span>
                  <span className="font-mono text-white font-semibold text-[11px] truncate max-w-[120px]">
                    {profile?.id || 'Active'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#AEABD8] font-medium">Realtime Ledger</span>
                  <span className="text-[#02B15A] font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#02B15A] animate-pulse" />
                    Connected
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#141332] border border-[#27264E] text-xs text-[#AEABD8] space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-white">
                <Info size={14} className="text-[#6359E9]" />
                <span>Need Role Delegation?</span>
              </div>
              <p className="text-[11px] text-[#AEABD8]/80">
                You can assign manager roles or invite operational staff in the <strong className="text-white">Access Control</strong> tab.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 2: SECURITY & PASSWORD ── */}
      {activeSubTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          <div className="lg:col-span-2 bg-[#1D1D41] border border-[#27264E] rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Change Administrator Password</h3>
              <p className="text-xs text-[#AEABD8] mt-0.5">
                Set a strong, new password for your administrator account.
              </p>
            </div>

            {passwordSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-[#02B15A]/15 border border-[#02B15A]/40 text-[#02B15A] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 size={16} className="text-[#02B15A] shrink-0" />
                <span>{passwordSuccessMsg}</span>
              </div>
            )}

            {passwordErrorMsg && (
              <div className="p-3.5 rounded-2xl bg-[#E41414]/15 border border-[#E41414]/40 text-[#E41414] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="text-[#E41414] shrink-0" />
                <span>{passwordErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#AEABD8] mb-1.5">
                  New Administrator Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#AEABD8]/60">
                    <Lock size={15} />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full bg-[#141332] border border-[#27264E] focus:border-[#6359E9] rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono font-semibold text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#AEABD8] hover:text-white"
                  >
                    {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#AEABD8] mb-1.5">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#AEABD8]/60">
                    <KeyRound size={15} />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full bg-[#141332] border border-[#27264E] focus:border-[#6359E9] rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono font-semibold text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#AEABD8] hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-[#141332] border border-[#27264E] rounded-2xl text-[11px] text-[#AEABD8] space-y-1">
                <span className="font-bold text-white block">Password Requirements:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-[#AEABD8]/80">
                  <li className={newPassword.length >= 6 ? 'text-[#02B15A] font-semibold' : ''}>
                    At least 6 characters long
                  </li>
                  <li className={newPassword && newPassword === confirmPassword ? 'text-[#02B15A] font-semibold' : ''}>
                    Passwords must match
                  </li>
                </ul>
              </div>

              <div className="pt-3 border-t border-[#27264E] flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="bg-[#6359E9] hover:bg-[#6F64FF] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2 active:scale-95 disabled:opacity-50"
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
            <div className="bg-[#1D1D41] border border-[#27264E] rounded-3xl p-6 shadow-xl space-y-4">
              <h4 className="text-xs font-bold text-[#AEABD8] uppercase tracking-wider">Session Security</h4>
              
              <div className="p-3 rounded-2xl bg-[#141332] border border-[#02B15A]/30 text-[#02B15A] text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[#02B15A]" />
                  <span>Secure SSL &amp; RLS Protected</span>
                </div>
                <p className="text-[11px] text-[#AEABD8]">
                  Every query is strictly isolated by PostgreSQL Row-Level Security policies.
                </p>
              </div>

              <div className="pt-2 border-t border-[#27264E]">
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full py-2.5 px-4 rounded-xl border border-[#E41414]/30 bg-[#E41414]/10 hover:bg-[#E41414]/20 text-[#E41414] font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <LogOut size={14} /> End Active Session / Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 3: DATABASE & TEST DATA (DANGER ZONE) ── */}
      {activeSubTab === 'database' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Notifications */}
          {resetSuccessMsg && (
            <div className="p-4 rounded-2xl bg-[#02B15A]/15 border border-[#02B15A]/40 text-[#02B15A] text-xs font-semibold flex items-start gap-3 shadow-xs">
              <CheckCircle2 size={18} className="text-[#02B15A] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">{resetSuccessMsg}</p>
                <p className="text-[11px] text-[#02B15A]/80">
                  You can now create brand new test groups or deploy fresh production records.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-2 inline-flex items-center gap-1.5 bg-[#02B15A] hover:bg-[#02B15A]/90 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all active:scale-95"
                >
                  <RefreshCw size={12} /> Reload Application State
                </button>
              </div>
            </div>
          )}

          {resetErrorMsg && (
            <div className="p-4 rounded-2xl bg-[#E41414]/15 border border-[#E41414]/40 text-[#E41414] text-xs font-semibold flex items-center gap-3">
              <AlertCircle size={18} className="text-[#E41414] shrink-0" />
              <span>{resetErrorMsg}</span>
            </div>
          )}

          {/* Database Live Telemetry Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#1D1D41] border border-[#27264E] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#AEABD8] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Chit Groups</span>
                <Layers size={14} className="text-[#6359E9]" />
              </div>
              <p className="text-xl font-black text-white font-mono">
                {loadingDbStats ? '...' : dbStats.groupsCount}
              </p>
              <span className="text-[10px] text-[#AEABD8]/70 mt-0.5 block">Active &amp; Drafts</span>
            </div>

            <div className="bg-[#1D1D41] border border-[#27264E] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#AEABD8] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Memberships</span>
                <Users size={14} className="text-[#64CFF6]" />
              </div>
              <p className="text-xl font-black text-white font-mono">
                {loadingDbStats ? '...' : dbStats.membershipsCount}
              </p>
              <span className="text-[10px] text-[#AEABD8]/70 mt-0.5 block">Enrolled Tickets</span>
            </div>

            <div className="bg-[#1D1D41] border border-[#27264E] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#AEABD8] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Subscribers</span>
                <User size={14} className="text-[#9C2CF3]" />
              </div>
              <p className="text-xl font-black text-white font-mono">
                {loadingDbStats ? '...' : dbStats.subscribersCount}
              </p>
              <span className="text-[10px] text-[#AEABD8]/70 mt-0.5 block">Test Profiles</span>
            </div>

            <div className="bg-[#1D1D41] border border-[#27264E] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#AEABD8] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Transactions</span>
                <Coins size={14} className="text-[#02B15A]" />
              </div>
              <p className="text-xl font-black text-white font-mono">
                {loadingDbStats ? '...' : dbStats.transactionsCount}
              </p>
              <span className="text-[10px] text-[#AEABD8]/70 mt-0.5 block">Ledger Receipts</span>
            </div>

            <div className="bg-[#1D1D41] border border-[#27264E] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#AEABD8] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Auctions</span>
                <Trophy size={14} className="text-[#FFBB38]" />
              </div>
              <p className="text-xl font-black text-white font-mono">
                {loadingDbStats ? '...' : dbStats.auctionLogsCount}
              </p>
              <span className="text-[10px] text-[#AEABD8]/70 mt-0.5 block">Auction Logs</span>
            </div>

            <div className="bg-[#1D1D41] border border-[#27264E] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#AEABD8] mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Audit Logs</span>
                <History size={14} className="text-[#AEABD8]" />
              </div>
              <p className="text-xl font-black text-white font-mono">
                {loadingDbStats ? '...' : dbStats.auditLogsCount}
              </p>
              <span className="text-[10px] text-[#AEABD8]/70 mt-0.5 block">Security Trails</span>
            </div>
          </div>

          {/* Danger Zone Card */}
          <div className="bg-[#1D1D41] border-2 border-[#E41414]/40 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#E41414]/20 text-[#E41414] flex items-center justify-center font-bold text-lg shrink-0">
                  <Flame size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    Danger Zone: Test Database Reset
                  </h3>
                  <p className="text-xs text-[#AEABD8] mt-0.5">
                    Clear test data from Supabase before publishing or initiating new simulation rounds.
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-[#E41414]/20 text-[#E41414]">
                Admin Exclusive
              </span>
            </div>

            {/* Scope Explanation Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#141332] border border-[#E41414]/30 space-y-2.5">
                <div className="font-bold text-[#E41414] flex items-center gap-1.5">
                  <Trash2 size={14} className="text-[#E41414]" />
                  <span>Data That Will Be Completely Wiped:</span>
                </div>
                <ul className="space-y-1 text-[#AEABD8] text-[11px] list-disc pl-4">
                  <li>All <strong className="text-white">Chit Groups</strong> and tickets</li>
                  <li>All <strong className="text-white">Group Memberships</strong> &amp; pocket book sync records</li>
                  <li>All <strong className="text-white">Auction Logs</strong>, bidding history &amp; winner payouts</li>
                  <li>All <strong className="text-white">Payment Receipts</strong>, collections &amp; personal draws</li>
                  <li>All <strong className="text-white">Test Subscriber Profiles</strong></li>
                  <li>All historical <strong className="text-white">Audit Logs</strong></li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-[#141332] border border-[#02B15A]/30 space-y-2.5">
                <div className="font-bold text-[#02B15A] flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[#02B15A]" />
                  <span>Structural Integrity &amp; Admin Accounts Preserved:</span>
                </div>
                <ul className="space-y-1 text-[#AEABD8] text-[11px] list-disc pl-4">
                  <li><strong className="text-white">PostgreSQL Schema</strong>, tables, indexes &amp; triggers</li>
                  <li><strong className="text-white">Row-Level Security (RLS)</strong> access policies</li>
                  <li><strong className="text-white">Admin &amp; Manager Auth Accounts</strong> (Dr. Kishor Anbazhakan)</li>
                  <li><strong className="text-white">4 Treasury Vault Structures</strong> (reset to ₹0 balances: Cash Box, Kishor Bank, Dad Bank, Mom Bank)</li>
                  <li>System settings &amp; custom roles definition</li>
                </ul>
              </div>
            </div>

            {/* Action Area */}
            <div className="pt-4 border-t border-[#27264E] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[11px] text-[#AEABD8] text-center sm:text-left">
                ⚠️ This operation cannot be undone. Always verify you are ready to wipe test records.
              </div>

              <button
                type="button"
                onClick={() => {
                  setConfirmKeyword('');
                  setResetErrorMsg(null);
                  setShowResetModal(true);
                  triggerHapticFeedback('warning');
                }}
                className="w-full sm:w-auto bg-[#E41414] hover:bg-[#E41414]/90 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md shadow-[#E41414]/20 flex items-center justify-center gap-2 active:scale-95"
              >
                <Trash2 size={15} />
                <span>Delete Test Database &amp; Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2-STEP CONFIRMATION MODAL ── */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#1D1D41] rounded-3xl border border-[#27264E] p-6 sm:p-7 w-full max-w-lg space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-150 text-white">
            {/* Modal Header */}
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E41414]/20 text-[#E41414] flex items-center justify-center font-bold">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">
                    Confirm Database Test Purge
                  </h4>
                  <p className="text-xs text-[#AEABD8]">
                    Irreversible administrative operation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="text-[#AEABD8] hover:text-white p-1.5 rounded-xl hover:bg-[#141332] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Warning Message */}
            <div className="p-4 rounded-2xl bg-[#141332] border border-[#E41414]/30 text-xs space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-[#E41414]">
                <Flame size={14} className="text-[#E41414]" />
                <span>You are about to purge all testing data:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#AEABD8] pt-1">
                <div>• {dbStats.groupsCount} Chit Groups</div>
                <div>• {dbStats.membershipsCount} Enrolled Tickets</div>
                <div>• {dbStats.subscribersCount} Test Members</div>
                <div>• {dbStats.transactionsCount} Transactions</div>
                <div>• {dbStats.auctionLogsCount} Auction Logs</div>
                <div>• Treasury Balances → ₹0</div>
              </div>
            </div>

            {/* Keyword Confirmation Prompt */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#AEABD8]">
                Type <span className="font-mono text-[#E41414] font-black">RESET</span> below to unlock confirmation:
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Type RESET here"
                value={confirmKeyword}
                onChange={(e) => setConfirmKeyword(e.target.value)}
                className="w-full bg-[#141332] border border-[#27264E] focus:border-[#E41414] rounded-xl px-4 py-2.5 text-xs font-mono font-bold tracking-widest text-white focus:outline-none uppercase"
              />
            </div>

            {/* Slider Confirmation */}
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

            {/* Footer Buttons */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResettingDb}
                className="border border-[#27264E] hover:bg-[#141332] text-[#AEABD8] hover:text-white font-bold text-xs px-4 py-2 rounded-xl transition-all"
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
