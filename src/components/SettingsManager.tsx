'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOrganization, computeInitials } from '@/context/OrganizationContext';
import { useMaintenance } from '@/context/MaintenanceContext';
import { supabase } from '@/utils/supabase/client';
import { triggerHapticFeedback } from '@/utils/haptics';
import { generateQrDataUrl } from '@/utils/qrCodeGenerator';
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
  Check,
  Gavel,
  Percent,
  QrCode,
  MessageSquare,
  Clock,
  Calendar,
  Copy,
  Download,
  FileDown,
  Shield,
  Smartphone,
  ShieldAlert,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

type SettingsSubTab = 
  | 'organization' 
  | 'chit_rules' 
  | 'upi_gateway' 
  | 'notifications' 
  | 'security' 
  | 'database' 
  | 'profile';

// ── Configuration Interfaces ──

export interface ChitRulesConfig {
  defaultFloorDiscountPercent: number; // e.g. 40
  defaultBidStep: number; // e.g. 1000
  defaultAuctionTime: string; // e.g. "19:00"
  defaulterGraceDays: number; // e.g. 5
  allowPartialPayments: boolean;
  autoTriggerLaabaSeetu: boolean;
}

export interface UpiGatewayConfig {
  enabled: boolean;
  vpa: string; // e.g. 9943609010@ibl
  payeeName: string; // e.g. Dr. Kishor Anbazhakan
  defaultVault: 'kishor_bank' | 'cash_in_hand' | 'dad_bank' | 'mom_bank';
  allowCustomAmount: boolean;
}

export interface NotificationPreferencesConfig {
  defaultLanguage: 'ta' | 'en';
  autoPromptReceipt: boolean;
  preAuctionNoticeDays: number; // 1, 2, 3, 5
  organizerHelpdeskPhone: string;
  receiptFooterMessage: string;
}

export interface PortalSecurityConfig {
  defaultMemberMpin: string; // "1234"
  cashBoxSafetyThreshold: number; // 150000
  sessionInactivityMinutes: number; // 15, 30, 60, 0
}

interface DatabaseStats {
  groupsCount: number;
  membershipsCount: number;
  subscribersCount: number;
  transactionsCount: number;
  auctionLogsCount: number;
  auditLogsCount: number;
}

// ── Default Fallbacks ──

const DEFAULT_CHIT_RULES: ChitRulesConfig = {
  defaultFloorDiscountPercent: 40,
  defaultBidStep: 1000,
  defaultAuctionTime: '19:00',
  defaulterGraceDays: 5,
  allowPartialPayments: true,
  autoTriggerLaabaSeetu: true,
};

const DEFAULT_UPI_GATEWAY: UpiGatewayConfig = {
  enabled: true,
  vpa: '9943609010@ibl',
  payeeName: 'Dr. Kishor Anbazhakan',
  defaultVault: 'kishor_bank',
  allowCustomAmount: true,
};

const DEFAULT_NOTIFICATIONS: NotificationPreferencesConfig = {
  defaultLanguage: 'ta',
  autoPromptReceipt: true,
  preAuctionNoticeDays: 2,
  organizerHelpdeskPhone: '9943609010',
  receiptFooterMessage: 'நன்றி! உங்கள் சேமிப்பு உங்கள் எதிர்காலம்.',
};

const DEFAULT_PORTAL_SECURITY: PortalSecurityConfig = {
  defaultMemberMpin: '1234',
  cashBoxSafetyThreshold: 150000,
  sessionInactivityMinutes: 30,
};

export default function SettingsManager() {
  const { user, profile, refreshProfile, signOut, canPerformAction } = useAuth();
  const { isMaintenanceMode, maintenanceMessage, toggleMaintenanceMode } = useMaintenance();

  // Granular Action Permissions
  const canMaintenance = canPerformAction('system:maintenance_mode');
  const canBranding = canPerformAction('system:branding');
  const canResetDatabase = canPerformAction('system:reset_database') ||
    profile?.role?.toLowerCase() === 'admin' ||
    profile?.role?.toLowerCase() === 'administrator';

  const {
    organizationName: globalOrgName,
    organizationTagline: globalOrgTagline,
    organizationInitials: globalOrgInitials,
    updateOrganizationSettings,
  } = useOrganization();

  // Active Subtab
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('organization');

  // ── 1. Organization Branding State ──
  const [orgNameInput, setOrgNameInput] = useState(globalOrgName);
  const [orgTaglineInput, setOrgTaglineInput] = useState(globalOrgTagline);
  const [orgInitialsInput, setOrgInitialsInput] = useState(globalOrgInitials);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [orgSuccessMsg, setOrgSuccessMsg] = useState<string | null>(null);
  const [orgErrorMsg, setOrgErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setOrgNameInput(globalOrgName);
    setOrgTaglineInput(globalOrgTagline);
    setOrgInitialsInput(globalOrgInitials);
  }, [globalOrgName, globalOrgTagline, globalOrgInitials]);

  // ── 2. Chit Rules & Auction Defaults State ──
  const [chitRules, setChitRules] = useState<ChitRulesConfig>(DEFAULT_CHIT_RULES);
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [rulesSuccessMsg, setRulesSuccessMsg] = useState<string | null>(null);
  const [rulesErrorMsg, setRulesErrorMsg] = useState<string | null>(null);

  // ── 3. UPI Gateway State ──
  const [upiConfig, setUpiConfig] = useState<UpiGatewayConfig>(DEFAULT_UPI_GATEWAY);
  const [isSavingUpi, setIsSavingUpi] = useState(false);
  const [upiSuccessMsg, setUpiSuccessMsg] = useState<string | null>(null);
  const [upiErrorMsg, setUpiErrorMsg] = useState<string | null>(null);
  const [upiTestAmount, setUpiTestAmount] = useState<number>(10000);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedUpiUri, setCopiedUpiUri] = useState<boolean>(false);

  // ── 4. Notifications & WhatsApp Automation State ──
  const [notifConfig, setNotifConfig] = useState<NotificationPreferencesConfig>(DEFAULT_NOTIFICATIONS);
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);
  const [notifSuccessMsg, setNotifSuccessMsg] = useState<string | null>(null);
  const [notifErrorMsg, setNotifErrorMsg] = useState<string | null>(null);

  // ── 5. Security & Maintenance Policy State ──
  const [securityConfig, setSecurityConfig] = useState<PortalSecurityConfig>(DEFAULT_PORTAL_SECURITY);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [securitySuccessMsg, setSecuritySuccessMsg] = useState<string | null>(null);
  const [securityErrorMsg, setSecurityErrorMsg] = useState<string | null>(null);
  const [localMaintMessage, setLocalMaintMessage] = useState(maintenanceMessage);
  const [isTogglingMaint, setIsTogglingMaint] = useState(false);

  // Profile Form State
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [email] = useState(profile?.email || user?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Password Update Form State
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
  const [showClearAuditModal, setShowClearAuditModal] = useState(false);
  const [isClearingAuditLogs, setIsClearingAuditLogs] = useState(false);

  // Disaster Recovery / Full Backup States
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [lastBackupSha, setLastBackupSha] = useState<string | null>(null);

  // Initialize cached settings from localStorage and sync from Supabase system_settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedRules = localStorage.getItem('chitfund_chit_rules_defaults');
      if (cachedRules) {
        try { setChitRules(JSON.parse(cachedRules)); } catch (_) {}
      }
      const cachedUpi = localStorage.getItem('chitfund_upi_payment_gateway');
      if (cachedUpi) {
        try { setUpiConfig(JSON.parse(cachedUpi)); } catch (_) {}
      }
      const cachedNotif = localStorage.getItem('chitfund_notification_preferences');
      if (cachedNotif) {
        try { setNotifConfig(JSON.parse(cachedNotif)); } catch (_) {}
      }
      const cachedSec = localStorage.getItem('chitfund_portal_security_policy');
      if (cachedSec) {
        try { setSecurityConfig(JSON.parse(cachedSec)); } catch (_) {}
      }
      const cachedBackupTime = localStorage.getItem('chitfund_last_backup_time');
      if (cachedBackupTime) setLastBackupTime(cachedBackupTime);
      const cachedBackupSha = localStorage.getItem('chitfund_last_backup_sha');
      if (cachedBackupSha) setLastBackupSha(cachedBackupSha);
    }
  }, []);

  // Fetch all Cloud System Settings on mount
  const fetchCloudSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value');

      if (error) {
        console.warn('Error fetching system_settings:', error.message);
        return;
      }

      if (data && Array.isArray(data)) {
        data.forEach((row) => {
          if (row.key === 'chit_rules_defaults' && row.value) {
            setChitRules((prev) => ({ ...prev, ...(row.value as any) }));
            if (typeof window !== 'undefined') {
              localStorage.setItem('chitfund_chit_rules_defaults', JSON.stringify(row.value));
            }
          } else if (row.key === 'upi_payment_gateway' && row.value) {
            setUpiConfig((prev) => ({ ...prev, ...(row.value as any) }));
            if (typeof window !== 'undefined') {
              localStorage.setItem('chitfund_upi_payment_gateway', JSON.stringify(row.value));
            }
          } else if (row.key === 'notification_preferences' && row.value) {
            setNotifConfig((prev) => ({ ...prev, ...(row.value as any) }));
            if (typeof window !== 'undefined') {
              localStorage.setItem('chitfund_notification_preferences', JSON.stringify(row.value));
            }
          } else if (row.key === 'portal_security_policy' && row.value) {
            setSecurityConfig((prev) => ({ ...prev, ...(row.value as any) }));
            if (typeof window !== 'undefined') {
              localStorage.setItem('chitfund_portal_security_policy', JSON.stringify(row.value));
            }
          }
        });
      }
    } catch (err) {
      console.error('Error loading cloud system settings:', err);
    }
  }, []);

  useEffect(() => {
    fetchCloudSettings();
  }, [fetchCloudSettings]);

  // Sync profile data when context changes
  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setPhoneNumber(profile.phoneNumber || '');
    }
  }, [profile]);

  useEffect(() => {
    setLocalMaintMessage(maintenanceMessage);
  }, [maintenanceMessage]);

  const normalizePhoneDigits = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  };

  // Live QR Code Generation for UPI Gateway
  const upiIntentUri = useMemo(() => {
    const vpa = upiConfig.vpa.trim() || '9943609010@ibl';
    const pn = encodeURIComponent(upiConfig.payeeName.trim() || 'Chit Funds');
    const am = upiTestAmount > 0 ? upiTestAmount.toFixed(2) : '10000.00';
    return `upi://pay?pa=${vpa}&pn=${pn}&am=${am}&cu=INR&tn=Chit+Installment`;
  }, [upiConfig.vpa, upiConfig.payeeName, upiTestAmount]);

  useEffect(() => {
    let isCancelled = false;
    async function renderQr() {
      try {
        const url = await generateQrDataUrl(upiIntentUri, {
          width: 320,
          margin: 1,
          color: { dark: '#0F172A', light: '#FFFFFF' }
        });
        if (!isCancelled) setQrCodeDataUrl(url);
      } catch (err) {
        console.error('Failed to generate UPI QR:', err);
      }
    }
    renderQr();
    return () => { isCancelled = true; };
  }, [upiIntentUri]);

  // Fetch live database statistics
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

  // Save Organization Branding
  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgSuccessMsg(null);
    setOrgErrorMsg(null);

    if (!canBranding) {
      setOrgErrorMsg('Permission Restricted: Modifying organization branding requires authorization.');
      triggerHapticFeedback('error');
      return;
    }

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

  // Save Chit Rules Defaults
  const handleSaveChitRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setRulesSuccessMsg(null);
    setRulesErrorMsg(null);

    try {
      setIsSavingRules(true);
      triggerHapticFeedback('light');

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'chit_rules_defaults',
          value: chitRules,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id || null,
        });

      if (error) throw error;

      if (typeof window !== 'undefined') {
        localStorage.setItem('chitfund_chit_rules_defaults', JSON.stringify(chitRules));
        window.dispatchEvent(new CustomEvent('chitfund:settings_updated', {
          detail: { key: 'chit_rules_defaults', value: chitRules }
        }));
      }

      setRulesSuccessMsg('Chit mechanics and auction floor defaults saved successfully! Applied to upcoming groups and live bidding sessions.');
      triggerHapticFeedback('success');
    } catch (err: any) {
      console.error('Failed to save chit rules:', err);
      setRulesErrorMsg(err.message || 'Failed to save chit rules settings.');
      triggerHapticFeedback('error');
    } finally {
      setIsSavingRules(false);
    }
  };

  // Save UPI Gateway Settings
  const handleSaveUpiGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpiSuccessMsg(null);
    setUpiErrorMsg(null);

    const cleanVpa = upiConfig.vpa.trim();
    if (upiConfig.enabled && (!cleanVpa || !cleanVpa.includes('@'))) {
      setUpiErrorMsg('Please provide a valid UPI Virtual Payment Address (e.g. 9943609010@ibl).');
      triggerHapticFeedback('warning');
      return;
    }

    try {
      setIsSavingUpi(true);
      triggerHapticFeedback('light');

      const payload = {
        ...upiConfig,
        vpa: cleanVpa,
        payeeName: upiConfig.payeeName.trim() || 'Chit Funds Management',
      };

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'upi_payment_gateway',
          value: payload,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id || null,
        });

      if (error) throw error;

      if (typeof window !== 'undefined') {
        localStorage.setItem('chitfund_upi_payment_gateway', JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent('chitfund:settings_updated', {
          detail: { key: 'upi_payment_gateway', value: payload }
        }));
      }

      setUpiSuccessMsg('UPI digital payment gateway configured! Dynamic QR codes and intent links updated across all receipts.');
      triggerHapticFeedback('success');
    } catch (err: any) {
      console.error('Failed to save UPI config:', err);
      setUpiErrorMsg(err.message || 'Failed to save UPI gateway configuration.');
      triggerHapticFeedback('error');
    } finally {
      setIsSavingUpi(false);
    }
  };

  // Copy UPI Intent Link
  const handleCopyUpiUri = async () => {
    try {
      await navigator.clipboard.writeText(upiIntentUri);
      setCopiedUpiUri(true);
      triggerHapticFeedback('success');
      setTimeout(() => setCopiedUpiUri(false), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  // Save Notification Preferences
  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifSuccessMsg(null);
    setNotifErrorMsg(null);

    try {
      setIsSavingNotifs(true);
      triggerHapticFeedback('light');

      const payload = {
        ...notifConfig,
        organizerHelpdeskPhone: normalizePhoneDigits(notifConfig.organizerHelpdeskPhone),
      };

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'notification_preferences',
          value: payload,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id || null,
        });

      if (error) throw error;

      if (typeof window !== 'undefined') {
        localStorage.setItem('chitfund_notification_preferences', JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent('chitfund:settings_updated', {
          detail: { key: 'notification_preferences', value: payload }
        }));
      }

      setNotifSuccessMsg('WhatsApp reminder & receipt automation settings saved! Default template language set to ' + (payload.defaultLanguage === 'ta' ? 'Tamil (தமிழ்)' : 'English') + '.');
      triggerHapticFeedback('success');
    } catch (err: any) {
      console.error('Failed to save notification preferences:', err);
      setNotifErrorMsg(err.message || 'Failed to save notification settings.');
      triggerHapticFeedback('error');
    } finally {
      setIsSavingNotifs(false);
    }
  };

  // Save Security Policy (MPIN, Threshold, Timeout)
  const handleSaveSecurityPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecuritySuccessMsg(null);
    setSecurityErrorMsg(null);

    if (securityConfig.defaultMemberMpin.length !== 4 || !/^\d{4}$/.test(securityConfig.defaultMemberMpin)) {
      setSecurityErrorMsg('Default member MPIN must be exactly 4 numeric digits.');
      triggerHapticFeedback('warning');
      return;
    }

    try {
      setIsSavingSecurity(true);
      triggerHapticFeedback('light');

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'portal_security_policy',
          value: securityConfig,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id || null,
        });

      if (error) throw error;

      if (typeof window !== 'undefined') {
        localStorage.setItem('chitfund_portal_security_policy', JSON.stringify(securityConfig));
        window.dispatchEvent(new CustomEvent('chitfund:settings_updated', {
          detail: { key: 'portal_security_policy', value: securityConfig }
        }));
      }

      setSecuritySuccessMsg('Portal security policy updated! Default onboarding MPIN and cash box safety alerts applied.');
      triggerHapticFeedback('success');
    } catch (err: any) {
      console.error('Failed to save security policy:', err);
      setSecurityErrorMsg(err.message || 'Failed to save security policy.');
      triggerHapticFeedback('error');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  // Toggle Maintenance Mode
  const handleToggleMaintenanceMode = async (enable: boolean) => {
    if (!canMaintenance) {
      setSecurityErrorMsg('Permission Restricted: Toggling maintenance mode requires Administrator authorization.');
      triggerHapticFeedback('error');
      return;
    }

    try {
      setIsTogglingMaint(true);
      triggerHapticFeedback('light');

      const res = await toggleMaintenanceMode(enable, localMaintMessage.trim());
      if (!res.success) {
        setSecurityErrorMsg(res.error || 'Failed to update maintenance mode.');
        triggerHapticFeedback('error');
      } else {
        setSecuritySuccessMsg(
          enable
            ? 'Emergency maintenance mode is now ACTIVE! Non-administrative portal logins are restricted.'
            : 'Maintenance mode deactivated. Portal access restored for all members and staff.'
        );
        triggerHapticFeedback('success');
      }
    } catch (err: any) {
      console.error('Maintenance toggle error:', err);
      setSecurityErrorMsg(err.message || 'Failed to toggle maintenance mode.');
      triggerHapticFeedback('error');
    } finally {
      setIsTogglingMaint(false);
    }
  };

  // Disaster Recovery Full 9-Table Database Export
  const handleExportFullBackup = async () => {
    try {
      setIsExportingBackup(true);
      setBackupSuccessMsg(null);
      triggerHapticFeedback('light');

      // Fetch all 9 operational tables concurrently
      const [
        { data: groupsData, error: errGroups },
        { data: membersData, error: errMembers },
        { data: profilesData, error: errProfiles },
        { data: txData, error: errTx },
        { data: auctionData, error: errAuctions },
        { data: treasuryData, error: errTreasury },
        { data: auditData, error: errAudit },
        { data: settingsData, error: errSettings },
        { data: rolesData, error: errRoles },
      ] = await Promise.all([
        supabase.from('chit_groups').select('*'),
        supabase.from('group_members').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('auction_logs').select('*'),
        supabase.from('global_treasury').select('*'),
        supabase.from('security_audit_logs').select('*'),
        supabase.from('system_settings').select('*'),
        supabase.from('custom_roles').select('*'),
      ]);

      if (errGroups || errMembers || errProfiles || errTx || errAuctions || errTreasury) {
        throw new Error('Failed to retrieve full database snapshot from Supabase.');
      }

      const backupPayload = {
        export_version: '1.0',
        generated_at: new Date().toISOString(),
        organization: globalOrgName,
        environment: 'production',
        exported_by: {
          id: profile?.id,
          name: profile?.fullName,
          role: profile?.role,
          email: user?.email,
        },
        record_summary: {
          chit_groups: groupsData?.length || 0,
          group_members: membersData?.length || 0,
          profiles: profilesData?.length || 0,
          transactions: txData?.length || 0,
          auction_logs: auctionData?.length || 0,
          global_treasury: treasuryData?.length || 0,
          security_audit_logs: auditData?.length || 0,
          system_settings: settingsData?.length || 0,
          custom_roles: rolesData?.length || 0,
        },
        database_snapshot: {
          chit_groups: groupsData || [],
          group_members: membersData || [],
          profiles: profilesData || [],
          transactions: txData || [],
          auction_logs: auctionData || [],
          global_treasury: treasuryData || [],
          security_audit_logs: auditData || [],
          system_settings: settingsData || [],
          custom_roles: rolesData || [],
        },
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);

      // Compute client-side SHA-256 integrity hash
      let sha256Hex = 'SHA-256-CLIENT-UNAVAILABLE';
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(jsonStr);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        sha256Hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      }

      // Trigger automatic browser file download
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const nowStr = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `chitfunds_full_backup_${nowStr}.json`;

      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);

      const timestamp = new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      setLastBackupTime(timestamp);
      setLastBackupSha(sha256Hex);

      if (typeof window !== 'undefined') {
        localStorage.setItem('chitfund_last_backup_time', timestamp);
        localStorage.setItem('chitfund_last_backup_sha', sha256Hex);
      }

      setBackupSuccessMsg(
        `Disaster Recovery Backup generated! File: ${filename} (SHA-256: ${sha256Hex.slice(0, 16)}...)`
      );
      triggerHapticFeedback('success');
    } catch (err: any) {
      console.error('Backup generation failed:', err);
      setResetErrorMsg(err.message || 'Failed to export full database backup.');
      triggerHapticFeedback('error');
    } finally {
      setIsExportingBackup(false);
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
    if (!canResetDatabase) {
      setResetErrorMsg('Permission Restricted: Database reset is restricted to authorized Administrators.');
      triggerHapticFeedback('error');
      return;
    }
    if (confirmKeyword.trim().toUpperCase() !== 'RESET') {
      setResetErrorMsg('Please type RESET in capital letters to confirm database purge.');
      triggerHapticFeedback('warning');
      return;
    }

    try {
      setIsResettingDb(true);
      setResetErrorMsg(null);
      setResetSuccessMsg(null);

      let purgeSuccessful = false;
      let lastErrorMessage = '';

      // 1. Primary Attempt: Secure Security Definer RPC
      try {
        const { data: rpcRes, error: rpcError } = await supabase.rpc('reset_test_database', {
          p_confirm_phrase: 'WIPE_ALL_DATA',
        });

        if (!rpcError && (!rpcRes || rpcRes.success !== false)) {
          purgeSuccessful = true;
        } else {
          lastErrorMessage = rpcRes?.error || rpcError?.message || 'RPC returned unconfirmed status';
          console.warn('RPC reset_test_database returned error, attempting direct client cascade reset:', lastErrorMessage);
        }
      } catch (rpcErr: any) {
        lastErrorMessage = rpcErr.message;
        console.warn('RPC exception, falling back to direct cascade reset:', rpcErr);
      }

      // 2. Secondary Fallback: Dependency-ordered client-side purge with strict error verification
      if (!purgeSuccessful) {
        // Step A: Nullify external foreign keys to prevent constraint violations
        await supabase.from('system_settings').update({ updated_by: profile?.id || null }).neq('key', '');
        await supabase.from('group_members').update({ transferred_from: null, profile_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('transactions').update({ group_id: null, profile_id: null, group_member_id: null, created_by: null }).neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('auction_logs').update({ winning_bidder_id: null, winning_member_id: null, runner_up_bidder_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('passbook_inventory').update({ assigned_to_profile_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('security_audit_logs').update({ admin_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');

        // Step B: Purge transactions, auctions, members, chit groups, and passbooks
        const [txRes, aucRes, gmRes, cgRes, pbRes] = await Promise.all([
          supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
          supabase.from('auction_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
          supabase.from('group_members').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
          supabase.from('chit_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
          supabase.from('passbook_inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        ]);

        if (txRes.error) throw new Error(`Transactions purge failed: ${txRes.error.message}`);
        if (aucRes.error) throw new Error(`Auction logs purge failed: ${aucRes.error.message}`);
        if (gmRes.error) throw new Error(`Group members purge failed: ${gmRes.error.message}`);
        if (cgRes.error) throw new Error(`Chit groups purge failed: ${cgRes.error.message}`);
        if (pbRes.error) console.warn('Passbook inventory warning:', pbRes.error.message);

        // Step C: Delete all profiles EXCEPT the primary admin (kishoranbazhakan@gmail.com)
        if (profile?.id) {
          const { error: profErr } = await supabase.from('profiles').delete().neq('id', profile.id);
          if (profErr) console.warn('Profiles cleanup warning:', profErr.message);
        }

        // Step D: Reset all 4 treasury vault balances to ₹0
        const { error: trErr } = await supabase.from('global_treasury').update({
          current_balance: 0,
          pending_verification_balance: 0,
          last_updated_by: profile?.id || null
        }).neq('wallet_type', '');
        if (trErr) console.warn('Treasury reset warning:', trErr.message);

        purgeSuccessful = true;
      }

      // 3. Step E: UNCONDITIONAL Audit Logs & Activity Feed Purge
      // Always runs to guarantee 0 remaining audit trails regardless of RPC or fallback route
      let auditPurged = false;
      try {
        const { data, error } = await supabase.rpc('purge_all_audit_logs', { p_confirm: 'WIPE_ALL_DATA' });
        if (!error && data?.success !== false) {
          auditPurged = true;
        }
      } catch (e) {
        console.warn('RPC purge_all_audit_logs with param warning:', e);
      }

      if (!auditPurged) {
        try {
          const { data, error } = await supabase.rpc('purge_all_audit_logs');
          if (!error && data?.success !== false) {
            auditPurged = true;
          }
        } catch (e) {
          console.warn('RPC purge_all_audit_logs zero-arg warning:', e);
        }
      }

      if (!auditPurged) {
        let lastCount = -1;
        for (let attempt = 0; attempt < 15; attempt++) {
          const { count } = await supabase
            .from('security_audit_logs')
            .select('*', { count: 'exact', head: true });
          if (!count || count === 0) {
            auditPurged = true;
            break;
          }
          if (count === lastCount) break;
          lastCount = count;

          const { error: auditErr } = await supabase
            .from('security_audit_logs')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          if (auditErr) {
            console.warn('Audit logs purge batch warning:', auditErr.message);
            break;
          }
        }
      }

      // Notify other components & sync local state
      window.dispatchEvent(new CustomEvent('chitfund:audit_updated'));
      window.dispatchEvent(new CustomEvent('chitfund:treasury_updated'));

      triggerHapticFeedback('success');
      setResetSuccessMsg('Database wiped clean! All chit groups, transactions, auctions, passbooks, audit trails, and member records cleared. Main admin preserved.');
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

  // Dedicated Clear Audit Trails Handler
  const handleClearAuditTrails = async () => {
    if (!canResetDatabase && profile?.role !== 'admin') {
      setResetErrorMsg('Permission Restricted: Only administrators can purge security audit trails.');
      triggerHapticFeedback('error');
      return;
    }

    try {
      setIsClearingAuditLogs(true);
      setResetErrorMsg(null);
      setResetSuccessMsg(null);

      let auditPurged = false;
      try {
        const { data, error } = await supabase.rpc('purge_all_audit_logs', { p_confirm: 'PURGE_LOGS' });
        if (!error && data?.success !== false) {
          auditPurged = true;
        }
      } catch (e) {
        console.warn('purge_all_audit_logs RPC with param warning:', e);
      }

      if (!auditPurged) {
        try {
          const { data, error } = await supabase.rpc('purge_all_audit_logs');
          if (!error && data?.success !== false) {
            auditPurged = true;
          }
        } catch (e) {
          console.warn('purge_all_audit_logs zero-arg warning:', e);
        }
      }

      if (!auditPurged) {
        let lastCount = -1;
        for (let attempt = 0; attempt < 15; attempt++) {
          const { count } = await supabase
            .from('security_audit_logs')
            .select('*', { count: 'exact', head: true });
          if (!count || count === 0) {
            auditPurged = true;
            break;
          }
          if (count === lastCount) break;
          lastCount = count;

          const { error: auditErr } = await supabase
            .from('security_audit_logs')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          if (auditErr) {
            console.warn('Audit purge batch warning:', auditErr.message);
            break;
          }
        }
      }

      window.dispatchEvent(new CustomEvent('chitfund:audit_updated'));
      triggerHapticFeedback('success');
      setResetSuccessMsg('All audit trails and system activity logs have been permanently cleared.');
      setShowClearAuditModal(false);
      await fetchDbStats();
    } catch (err: any) {
      console.error('Failed to clear audit logs:', err);
      setResetErrorMsg(err.message || 'Failed to clear audit logs.');
      triggerHapticFeedback('error');
    } finally {
      setIsClearingAuditLogs(false);
    }
  };

  // Subtabs Definition
  const subtabsList = [
    { id: 'organization' as SettingsSubTab, label: 'Branding', fullLabel: 'Organization Branding', icon: Building2 },
    { id: 'chit_rules' as SettingsSubTab, label: 'Chit Rules', fullLabel: 'Chit Rules & Auction Defaults', icon: Gavel },
    { id: 'upi_gateway' as SettingsSubTab, label: 'UPI Gateway', fullLabel: 'UPI & Payment Gateway', icon: QrCode },
    { id: 'notifications' as SettingsSubTab, label: 'WhatsApp', fullLabel: 'WhatsApp & Notices', icon: MessageSquare },
    { id: 'security' as SettingsSubTab, label: 'Security', fullLabel: 'Portal Security & Lockout', icon: ShieldCheck },
    { id: 'database' as SettingsSubTab, label: 'Backup & Data', fullLabel: 'Disaster Recovery & Data', icon: Database },
    { id: 'profile' as SettingsSubTab, label: 'Profile', fullLabel: 'Profile & Credentials', icon: User },
  ];

  return (
    <div className="w-full bg-slate-50 min-h-screen text-slate-800 antialiased flex flex-col font-sans">
      
      {/* ═══════════════════════════════════════════════════════════════════
          MOBILE VIEW (Touch-First Native Android Optimized — block lg:hidden)
          Spacious, Thumb-Zone Friendly, Zero Clutter, Active Feedback
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="block lg:hidden w-full bg-[#F8FAFC] min-h-screen flex flex-col pb-32">
        
        {/* Sticky Mobile App Bar */}
        <header className="bg-white/95 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100">
          <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100/80">
            <div>
              <h1 className="text-base font-extrabold text-slate-900 leading-tight">Portal Settings</h1>
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Institutional Controls &amp; Policies
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 border border-brand-200">
              Admin
            </span>
          </div>

          {/* Swipeable Subtab Carousel (Android Native Pill Row) */}
          <div className="px-3 py-2 bg-slate-50/90 border-b border-slate-100">
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar scroll-smooth py-1">
              {subtabsList.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveSubTab(tab.id);
                      triggerHapticFeedback('light');
                    }}
                    className={`flex-shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
                      isActive
                        ? tab.id === 'database'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-brand-500 text-white shadow-xs'
                        : tab.id === 'database'
                          ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <IconComponent size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Mobile Tab Content Container */}
        <div className="px-4 py-4 space-y-4">

          {/* ─────────────────────────────────────────────────────────────
              1. BRANDING TAB (Mobile)
              ───────────────────────────────────────────────────────────── */}
          {activeSubTab === 'organization' && (
            <div className="space-y-4">
              {/* Live Preview Card */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-2xl shadow-card border border-indigo-500/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Live Brand Preview</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">Active Everywhere</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-extrabold text-base shadow-md">
                    {orgInitialsInput.trim() || 'CF'}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight text-white leading-tight">
                      {orgNameInput.trim() || 'Chit Funds Management'}
                    </h3>
                    <p className="text-xs text-indigo-200/80 mt-0.5">
                      {orgTaglineInput.trim() || 'High-Trust Financial Community'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card">
                <form onSubmit={handleSaveOrganization} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Company / Organization Title *</label>
                    <input
                      type="text"
                      value={orgNameInput}
                      onChange={(e) => setOrgNameInput(e.target.value)}
                      placeholder="e.g. Sri Murugan Chit Funds"
                      className="w-full h-12 px-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Official Tagline / Slogan</label>
                    <input
                      type="text"
                      value={orgTaglineInput}
                      onChange={(e) => setOrgTaglineInput(e.target.value)}
                      placeholder="e.g. Empowering Community Wealth"
                      className="w-full h-12 px-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Brand Monogram / Initials (Max 3)</label>
                    <input
                      type="text"
                      maxLength={3}
                      value={orgInitialsInput}
                      onChange={(e) => setOrgInitialsInput(e.target.value.toUpperCase())}
                      placeholder="e.g. SMC"
                      className="w-full h-12 px-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold tracking-wider"
                    />
                  </div>

                  {orgSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                      <span>{orgSuccessMsg}</span>
                    </div>
                  )}

                  {orgErrorMsg && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                      <span>{orgErrorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingOrg || !canBranding}
                    data-action="system:branding"
                    className="w-full min-h-[48px] rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isSavingOrg ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{isSavingOrg ? 'Saving Branding...' : 'Save Organization Branding'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              2. CHIT RULES & AUCTION DEFAULTS (Mobile)
              ───────────────────────────────────────────────────────────── */}
          {activeSubTab === 'chit_rules' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                    <Gavel size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Chit Mechanics &amp; Auction Floor</h2>
                    <p className="text-[11px] text-slate-500">Preset guidelines for new groups &amp; live bidding</p>
                  </div>
                </div>

                <form onSubmit={handleSaveChitRules} className="space-y-4">
                  {/* Floor Discount Cap */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800">Default Floor Discount Cap</label>
                      <span className="text-xs font-extrabold text-brand-600 font-mono">{chitRules.defaultFloorDiscountPercent}%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">Tamil Nadu Chit Funds statutory cap standard is 40%.</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[30, 35, 40, 45].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setChitRules({ ...chitRules, defaultFloorDiscountPercent: pct });
                            triggerHapticFeedback('light');
                          }}
                          className={`min-h-[44px] py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            chitRules.defaultFloorDiscountPercent === pct
                              ? 'bg-brand-500 text-white border-brand-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shout Bid Increment Step */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800">Shout Bid Increment Step</label>
                      <span className="text-xs font-extrabold text-brand-600 font-mono">₹{chitRules.defaultBidStep.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">Minimum discount raise required per competitive floor bid.</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[500, 1000, 2000, 5000].map((step) => (
                        <button
                          key={step}
                          type="button"
                          onClick={() => {
                            setChitRules({ ...chitRules, defaultBidStep: step });
                            triggerHapticFeedback('light');
                          }}
                          className={`min-h-[44px] py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            chitRules.defaultBidStep === step
                              ? 'bg-brand-500 text-white border-brand-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          ₹{step >= 1000 ? `${step / 1000}k` : step}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Default Auction Start Time */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Standard Auction Start Time</label>
                    <div className="relative">
                      <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="time"
                        value={chitRules.defaultAuctionTime}
                        onChange={(e) => setChitRules({ ...chitRules, defaultAuctionTime: e.target.value })}
                        className="w-full h-12 pl-10 pr-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Defaulter Grace Period */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800">Overdue Defaulter Grace Period</label>
                      <span className="text-xs font-extrabold text-brand-600 font-mono">{chitRules.defaulterGraceDays} Days</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">Days past monthly due date before late alerts are flagged.</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[3, 5, 7, 10].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => {
                            setChitRules({ ...chitRules, defaulterGraceDays: days });
                            triggerHapticFeedback('light');
                          }}
                          className={`min-h-[44px] py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            chitRules.defaulterGraceDays === days
                              ? 'bg-brand-500 text-white border-brand-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {days} Days
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Switches */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <div className="pr-3">
                        <div className="text-xs font-bold text-slate-800">Allow Partial Installments</div>
                        <div className="text-[11px] text-slate-500">Permit agents to log split payments against due cycles</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={chitRules.allowPartialPayments}
                        onChange={(e) => {
                          setChitRules({ ...chitRules, allowPartialPayments: e.target.checked });
                          triggerHapticFeedback('light');
                        }}
                        className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <div className="pr-3">
                        <div className="text-xs font-bold text-slate-800">Auto Laaba Seetu (லாப சீட்டு) Detection</div>
                        <div className="text-[11px] text-slate-500">Auto-flag ₹0 member due when accumulated pool reaches pot value</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={chitRules.autoTriggerLaabaSeetu}
                        onChange={(e) => {
                          setChitRules({ ...chitRules, autoTriggerLaabaSeetu: e.target.checked });
                          triggerHapticFeedback('light');
                        }}
                        className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                    </label>
                  </div>

                  {rulesSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                      <span>{rulesSuccessMsg}</span>
                    </div>
                  )}

                  {rulesErrorMsg && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                      <span>{rulesErrorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingRules}
                    className="w-full min-h-[48px] rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isSavingRules ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{isSavingRules ? 'Saving Rules...' : 'Save Chit & Auction Defaults'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              3. UPI & DIGITAL GATEWAY (Mobile)
              ───────────────────────────────────────────────────────────── */}
          {activeSubTab === 'upi_gateway' && (
            <div className="space-y-4">
              {/* Dynamic QR Live Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card flex flex-col items-center text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Live Dynamic QR Code Preview</span>
                <h3 className="text-xs font-bold text-slate-800 mb-3">Scan to Pay via PhonePe, GPay, Paytm, BHIM</h3>

                {/* QR Display */}
                <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-inner mb-3">
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="UPI QR Code" className="w-48 h-48 rounded-lg object-contain" />
                  ) : (
                    <div className="w-48 h-48 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                      <RefreshCw size={24} className="animate-spin" />
                    </div>
                  )}
                </div>

                <div className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mb-3 text-left">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Configured VPA</div>
                  <div className="text-xs font-mono font-bold text-slate-900 break-all">{upiConfig.vpa || 'Not configured'}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{upiConfig.payeeName}</div>
                </div>

                {/* Test Amount Chips */}
                <div className="w-full mb-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 text-left">Test Amount Simulator</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[5000, 10000, 25000, 50000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setUpiTestAmount(amt);
                          triggerHapticFeedback('light');
                        }}
                        className={`min-h-[40px] py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          upiTestAmount === amt
                            ? 'bg-brand-500 text-white border-brand-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        ₹{amt >= 1000 ? `${amt / 1000}k` : amt}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyUpiUri}
                  className="w-full min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  {copiedUpiUri ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedUpiUri ? 'UPI Intent URI Copied!' : 'Copy NPCI UPI Intent Link'}</span>
                </button>
              </div>

              {/* Gateway Settings Form */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card">
                <form onSubmit={handleSaveUpiGateway} className="space-y-3.5">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <div className="pr-3">
                      <div className="text-xs font-bold text-slate-800">Enable Digital UPI Gateway</div>
                      <div className="text-[11px] text-slate-500">Show QR codes on passbooks, receipts, and payment links</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={upiConfig.enabled}
                      onChange={(e) => {
                        setUpiConfig({ ...upiConfig, enabled: e.target.checked });
                        triggerHapticFeedback('light');
                      }}
                      className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </label>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Primary Organizer UPI VPA (ID) *</label>
                    <input
                      type="text"
                      value={upiConfig.vpa}
                      onChange={(e) => setUpiConfig({ ...upiConfig, vpa: e.target.value })}
                      placeholder="e.g. 9943609010@ibl or dr.kishor@oksbi"
                      className="w-full h-12 px-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Payee Business Name *</label>
                    <input
                      type="text"
                      value={upiConfig.payeeName}
                      onChange={(e) => setUpiConfig({ ...upiConfig, payeeName: e.target.value })}
                      placeholder="e.g. Dr. Kishor Anbazhakan"
                      className="w-full h-12 px-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Default Inflow Treasury Vault</label>
                    <select
                      value={upiConfig.defaultVault}
                      onChange={(e) => setUpiConfig({ ...upiConfig, defaultVault: e.target.value as any })}
                      className="w-full h-12 px-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                    >
                      <option value="kishor_bank">Kishor Bank Account (Primary Digital)</option>
                      <option value="cash_in_hand">Cash In Hand Box (Physical Cash Drawer)</option>
                      <option value="dad_bank">Dad Bank Account (Secondary Bank)</option>
                      <option value="mom_bank">Mom Bank Account (Reserve Reserves)</option>
                    </select>
                  </div>

                  {upiSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                      <span>{upiSuccessMsg}</span>
                    </div>
                  )}

                  {upiErrorMsg && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                      <span>{upiErrorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingUpi}
                    className="w-full min-h-[48px] rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isSavingUpi ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{isSavingUpi ? 'Saving Gateway...' : 'Save UPI Payment Gateway'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              4. NOTIFICATIONS & WHATSAPP (Mobile)
              ───────────────────────────────────────────────────────────── */}
          {activeSubTab === 'notifications' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">WhatsApp &amp; Notice Automation</h2>
                    <p className="text-[11px] text-slate-500">Automate dispatches, language, &amp; pre-auction alerts</p>
                  </div>
                </div>

                <form onSubmit={handleSaveNotifications} className="space-y-4">
                  {/* Default Language Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">Default Message Language</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNotifConfig({ ...notifConfig, defaultLanguage: 'ta' });
                          triggerHapticFeedback('light');
                        }}
                        className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          notifConfig.defaultLanguage === 'ta'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>தமிழ் (Tamil)</span>
                        {notifConfig.defaultLanguage === 'ta' && <Check size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNotifConfig({ ...notifConfig, defaultLanguage: 'en' });
                          triggerHapticFeedback('light');
                        }}
                        className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          notifConfig.defaultLanguage === 'en'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>English</span>
                        {notifConfig.defaultLanguage === 'en' && <Check size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Pre-Auction Notice Offset */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800">Pre-Auction Reminder Notice Schedule</label>
                      <span className="text-xs font-extrabold text-emerald-600 font-mono">{notifConfig.preAuctionNoticeDays} Days Prior</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 5].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setNotifConfig({ ...notifConfig, preAuctionNoticeDays: d });
                            triggerHapticFeedback('light');
                          }}
                          className={`min-h-[44px] py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            notifConfig.preAuctionNoticeDays === d
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {d} {d === 1 ? 'Day' : 'Days'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Helpdesk Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Official Organizer WhatsApp Number *</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        value={notifConfig.organizerHelpdeskPhone}
                        onChange={(e) => setNotifConfig({ ...notifConfig, organizerHelpdeskPhone: e.target.value })}
                        placeholder="9943609010"
                        className="w-full h-12 pl-10 pr-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-semibold"
                      />
                    </div>
                  </div>

                  {/* Receipt Footer Message */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Digital Receipt Footer Note</label>
                    <input
                      type="text"
                      value={notifConfig.receiptFooterMessage}
                      onChange={(e) => setNotifConfig({ ...notifConfig, receiptFooterMessage: e.target.value })}
                      placeholder="நன்றி! உங்கள் சேமிப்பு உங்கள் எதிர்காலம்."
                      className="w-full h-12 px-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Automation Switch */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <div className="pr-3">
                      <div className="text-xs font-bold text-slate-800">Auto-prompt WhatsApp Receipt on Collection</div>
                      <div className="text-[11px] text-slate-500">Automatically open receipt share prompt upon recording payment</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifConfig.autoPromptReceipt}
                      onChange={(e) => {
                        setNotifConfig({ ...notifConfig, autoPromptReceipt: e.target.checked });
                        triggerHapticFeedback('light');
                      }}
                      className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </label>

                  {notifSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                      <span>{notifSuccessMsg}</span>
                    </div>
                  )}

                  {notifErrorMsg && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                      <span>{notifErrorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingNotifs}
                    className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isSavingNotifs ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{isSavingNotifs ? 'Saving...' : 'Save Notification Automation'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              5. SECURITY & MAINTENANCE POLICY (Mobile)
              ───────────────────────────────────────────────────────────── */}
          {activeSubTab === 'security' && (
            <div className="space-y-4">
              {/* Emergency Maintenance Lockout Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isMaintenanceMode ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      <ShieldAlert size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Emergency Maintenance Lockout</h3>
                      <p className="text-[10px] text-slate-500">Restricts subscriber logins during updates</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isMaintenanceMode ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600'}`}>
                    {isMaintenanceMode ? 'ACTIVE LOCKOUT' : 'Inactive'}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Custom Lockout Banner Notice</label>
                  <textarea
                    rows={2}
                    value={localMaintMessage}
                    onChange={(e) => setLocalMaintMessage(e.target.value)}
                    placeholder="Scheduled portal maintenance in progress..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isTogglingMaint || isMaintenanceMode || !canMaintenance}
                    data-action="system:maintenance_mode"
                    onClick={() => handleToggleMaintenanceMode(true)}
                    className="flex-1 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 active:scale-98"
                  >
                    {isTogglingMaint ? <RefreshCw size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                    <span>Engage Lockout</span>
                  </button>
                  <button
                    type="button"
                    disabled={isTogglingMaint || !isMaintenanceMode || !canMaintenance}
                    data-action="system:maintenance_mode"
                    onClick={() => handleToggleMaintenanceMode(false)}
                    className="flex-1 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 active:scale-98"
                  >
                    <span>Restore Access</span>
                  </button>
                </div>
              </div>

              {/* Portal Policy Card (MPIN, Threshold, Inactivity) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card">
                <form onSubmit={handleSaveSecurityPolicy} className="space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                      <KeyRound size={16} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Access &amp; Threshold Policy</h2>
                      <p className="text-[11px] text-slate-500">Default MPIN &amp; Cash Box safety threshold</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Default Onboarding Member MPIN *</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={securityConfig.defaultMemberMpin}
                      onChange={(e) => setSecurityConfig({ ...securityConfig, defaultMemberMpin: e.target.value.replace(/\D/g, '') })}
                      placeholder="1234"
                      className="w-full h-12 px-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold tracking-widest text-center"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">4-digit PIN auto-assigned when creating passbooks.</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800">Physical Cash Box Safety Threshold</label>
                      <span className="text-xs font-extrabold text-brand-600 font-mono">₹{securityConfig.cashBoxSafetyThreshold.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">Flags bank relocation warning when physical cash exceeds this amount.</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[100000, 150000, 250000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setSecurityConfig({ ...securityConfig, cashBoxSafetyThreshold: amt });
                            triggerHapticFeedback('light');
                          }}
                          className={`min-h-[44px] py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            securityConfig.cashBoxSafetyThreshold === amt
                              ? 'bg-brand-500 text-white border-brand-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          ₹{amt / 1000}k
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Session Inactivity Timeout</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[15, 30, 60, 0].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            setSecurityConfig({ ...securityConfig, sessionInactivityMinutes: mins });
                            triggerHapticFeedback('light');
                          }}
                          className={`min-h-[44px] py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            securityConfig.sessionInactivityMinutes === mins
                              ? 'bg-brand-500 text-white border-brand-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {mins === 0 ? 'Never' : `${mins}m`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {securitySuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                      <span>{securitySuccessMsg}</span>
                    </div>
                  )}

                  {securityErrorMsg && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                      <span>{securityErrorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingSecurity}
                    className="w-full min-h-[48px] rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isSavingSecurity ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{isSavingSecurity ? 'Saving...' : 'Save Portal Security Policy'}</span>
                  </button>
                </form>
              </div>

              {/* Password Change Form */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card">
                <form onSubmit={handleUpdatePassword} className="space-y-3.5">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                      <Lock size={16} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Change Admin Password</h2>
                      <p className="text-[11px] text-slate-500">Update Supabase Auth account password</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">New Password (Min 6 chars) *</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-12 pl-3.5 pr-11 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password *</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-12 pl-3.5 pr-11 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {passwordSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                      <span>{passwordSuccessMsg}</span>
                    </div>
                  )}

                  {passwordErrorMsg && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                      <span>{passwordErrorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="w-full min-h-[48px] rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isUpdatingPassword ? <RefreshCw size={16} className="animate-spin" /> : <Lock size={16} />}
                    <span>{isUpdatingPassword ? 'Updating Password...' : 'Update Password'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              6. DATA & DISASTER RECOVERY (Mobile)
              ───────────────────────────────────────────────────────────── */}
          {activeSubTab === 'database' && (
            <div className="space-y-4">
              {/* Disaster Recovery One-Click Backup Card */}
              <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-card border border-indigo-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
                      <Download size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">Full Database Backup</h3>
                      <p className="text-[10px] text-indigo-200/70">All 9 tables snapshot with SHA-256</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Disaster Ready
                  </span>
                </div>

                <p className="text-[11px] text-indigo-100/80 leading-relaxed">
                  Exports groups, members, subscribers, transactions, auctions, treasury vaults, audit trails, and system settings into a single encrypted JSON bundle.
                </p>

                {lastBackupTime && (
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] space-y-1 font-mono">
                    <div className="text-indigo-300 font-sans text-[10px] font-bold uppercase">Last Snapshot Created</div>
                    <div className="text-white font-semibold">{lastBackupTime}</div>
                    {lastBackupSha && (
                      <div className="text-[9px] text-indigo-200/60 truncate">SHA-256: {lastBackupSha}</div>
                    )}
                  </div>
                )}

                {backupSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                    <span className="break-all">{backupSuccessMsg}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={isExportingBackup}
                  onClick={handleExportFullBackup}
                  className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {isExportingBackup ? <RefreshCw size={16} className="animate-spin" /> : <FileDown size={16} />}
                  <span>{isExportingBackup ? 'Packaging Tables...' : 'Download Full JSON Backup'}</span>
                </button>
              </div>

              {/* Live Database Metrics Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">Operational Table Counts</span>
                  <button
                    type="button"
                    onClick={() => { fetchDbStats(); triggerHapticFeedback('light'); }}
                    className="text-xs text-brand-600 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={12} className={loadingDbStats ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-lg font-black text-slate-900 font-mono">{dbStats.groupsCount}</div>
                    <div className="text-[10px] text-slate-500 font-bold">Chit Groups</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-lg font-black text-slate-900 font-mono">{dbStats.subscribersCount}</div>
                    <div className="text-[10px] text-slate-500 font-bold">Subscribers</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-lg font-black text-slate-900 font-mono">{dbStats.transactionsCount}</div>
                    <div className="text-[10px] text-slate-500 font-bold">Transactions</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-lg font-black text-slate-900 font-mono">{dbStats.auctionLogsCount}</div>
                    <div className="text-[10px] text-slate-500 font-bold">Auction Logs</div>
                  </div>
                </div>
              </div>

              {/* Danger Zone / Factory Reset */}
              <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-rose-900">Danger Zone: Database Reset</h3>
                    <p className="text-[10px] text-rose-600">Irreversible purge of test records</p>
                  </div>
                </div>

                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Purges all chit schemes, transactions, bids, and test subscribers. Preserves staff logins and system settings.
                </p>

                {resetSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                    <span>{resetSuccessMsg}</span>
                  </div>
                )}

                {resetErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={16} className="text-rose-700 flex-shrink-0" />
                    <span>{resetErrorMsg}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canResetDatabase}
                  onClick={() => {
                    setShowResetModal(true);
                    setResetSuccessMsg(null);
                    setResetErrorMsg(null);
                    triggerHapticFeedback('warning');
                  }}
                  className="w-full min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-40"
                >
                  <Trash2 size={14} />
                  <span>Purge Test Database Records</span>
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              7. PROFILE & ACCOUNT TAB (Mobile)
              ───────────────────────────────────────────────────────────── */}
          {activeSubTab === 'profile' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                  {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'A'}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{profile?.fullName || 'Administrator'}</h3>
                  <p className="text-xs text-slate-500 font-mono">{email || 'admin@chitfund.internal'}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Administrator
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-card">
                <form onSubmit={handleSaveProfile} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name *</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Dr. Kishor Anbazhakan"
                      className="w-full h-12 px-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Phone Number (10 Digits)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="9943609010"
                        className="w-full h-12 pl-12 pr-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={email}
                      className="w-full h-12 px-3.5 text-sm rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-mono cursor-not-allowed"
                    />
                  </div>

                  {profileSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                      <span>{profileSuccessMsg}</span>
                    </div>
                  )}

                  {profileErrorMsg && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                      <span>{profileErrorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="w-full min-h-[48px] rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isSavingProfile ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{isSavingProfile ? 'Saving...' : 'Save Profile Details'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHapticFeedback('light');
                      signOut();
                    }}
                    className="w-full min-h-[48px] rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 mt-2"
                  >
                    <LogOut size={16} />
                    <span>Sign Out of Administrator Session</span>
                  </button>
                </form>
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
                {subtabsList.map((tab) => {
                  const IconComp = tab.icon;
                  const isActive = activeSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveSubTab(tab.id);
                        triggerHapticFeedback('light');
                      }}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? tab.id === 'database'
                            ? 'bg-rose-600 text-white shadow-2xs font-bold'
                            : 'bg-white text-slate-900 shadow-2xs font-bold'
                          : tab.id === 'database'
                            ? 'text-rose-700 hover:bg-rose-100/50'
                            : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <IconComp size={14} className={isActive ? (tab.id === 'database' ? 'text-white' : 'text-brand-600') : 'text-slate-400'} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="text-xs text-slate-500 font-medium px-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Active Vault: <strong>Kishor Bank</strong></span>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                1. BRANDING TAB (Desktop)
                ───────────────────────────────────────────────────────────── */}
            {activeSubTab === 'organization' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Organization Branding &amp; Monogram</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Customize the company title, slogan, and badge across all portal tabs and digital receipts.</p>
                  </div>

                  <form onSubmit={handleSaveOrganization} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Company / Organization Title *</label>
                      <input
                        type="text"
                        value={orgNameInput}
                        onChange={(e) => setOrgNameInput(e.target.value)}
                        placeholder="e.g. Sri Murugan Chit Funds"
                        className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Official Tagline / Slogan</label>
                      <input
                        type="text"
                        value={orgTaglineInput}
                        onChange={(e) => setOrgTaglineInput(e.target.value)}
                        placeholder="e.g. Empowering Community Wealth"
                        className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Brand Monogram / Initials (Max 3)</label>
                      <input
                        type="text"
                        maxLength={3}
                        value={orgInitialsInput}
                        onChange={(e) => setOrgInitialsInput(e.target.value.toUpperCase())}
                        placeholder="e.g. SMC"
                        className="w-40 h-11 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold tracking-wider"
                      />
                    </div>

                    {orgSuccessMsg && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                        <span>{orgSuccessMsg}</span>
                      </div>
                    )}

                    {orgErrorMsg && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                        <span>{orgErrorMsg}</span>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSavingOrg || !canBranding}
                        data-action="system:branding"
                        className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingOrg ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>{isSavingOrg ? 'Saving...' : 'Save Organization Branding'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-card border border-indigo-500/20">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Live Visual Appearance</span>
                    <div className="flex items-center gap-4 mt-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-black text-xl shadow-lg">
                        {orgInitialsInput.trim() || 'CF'}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white">{orgNameInput.trim() || 'Chit Funds Management'}</h3>
                        <p className="text-xs text-indigo-200/80 mt-0.5">{orgTaglineInput.trim() || 'High-Trust Financial Community'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                2. CHIT RULES & AUCTION DEFAULTS (Desktop)
                ───────────────────────────────────────────────────────────── */}
            {activeSubTab === 'chit_rules' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Chit Mechanics &amp; Auction Floor Defaults</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Configure floor discount limits, shouting bid steps, and late installment grace rules.</p>
                  </div>

                  <form onSubmit={handleSaveChitRules} className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-800">Default Floor Discount Cap</label>
                        <span className="text-xs font-extrabold text-brand-600 font-mono">{chitRules.defaultFloorDiscountPercent}%</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-2">Statutory maximum discount allowed per the Chit Funds Act (Standard: 40%).</p>
                      <div className="grid grid-cols-5 gap-2">
                        {[30, 35, 40, 45, 50].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setChitRules({ ...chitRules, defaultFloorDiscountPercent: pct });
                              triggerHapticFeedback('light');
                            }}
                            className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              chitRules.defaultFloorDiscountPercent === pct
                                ? 'bg-brand-500 text-white border-brand-600 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-800">Shout Bid Increment Step</label>
                        <span className="text-xs font-extrabold text-brand-600 font-mono">₹{chitRules.defaultBidStep.toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-2">Minimum competitive discount step raised by non-winning bidders during live sessions.</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[500, 1000, 2000, 5000].map((step) => (
                          <button
                            key={step}
                            type="button"
                            onClick={() => {
                              setChitRules({ ...chitRules, defaultBidStep: step });
                              triggerHapticFeedback('light');
                            }}
                            className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              chitRules.defaultBidStep === step
                                ? 'bg-brand-500 text-white border-brand-600 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            ₹{step.toLocaleString('en-IN')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">Standard Auction Start Time</label>
                        <input
                          type="time"
                          value={chitRules.defaultAuctionTime}
                          onChange={(e) => setChitRules({ ...chitRules, defaultAuctionTime: e.target.value })}
                          className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">Defaulter Grace Period</label>
                        <select
                          value={chitRules.defaulterGraceDays}
                          onChange={(e) => setChitRules({ ...chitRules, defaulterGraceDays: parseInt(e.target.value) || 5 })}
                          className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                        >
                          <option value={3}>3 Days Grace</option>
                          <option value={5}>5 Days Grace (Standard)</option>
                          <option value={7}>7 Days Grace</option>
                          <option value={10}>10 Days Grace</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                        <div>
                          <div className="text-xs font-bold text-slate-800">Allow Partial / Split Installments</div>
                          <div className="text-[11px] text-slate-500">Enable agents to post fractional collections against active cycle dues</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={chitRules.allowPartialPayments}
                          onChange={(e) => setChitRules({ ...chitRules, allowPartialPayments: e.target.checked })}
                          className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                        <div>
                          <div className="text-xs font-bold text-slate-800">Auto Laaba Seetu (லாப சீட்டு) Detection</div>
                          <div className="text-[11px] text-slate-500">Automatically waive member installment when accumulated discount pool equals total pot</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={chitRules.autoTriggerLaabaSeetu}
                          onChange={(e) => setChitRules({ ...chitRules, autoTriggerLaabaSeetu: e.target.checked })}
                          className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </label>
                    </div>

                    {rulesSuccessMsg && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                        <span>{rulesSuccessMsg}</span>
                      </div>
                    )}

                    {rulesErrorMsg && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                        <span>{rulesErrorMsg}</span>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSavingRules}
                        className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingRules ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>{isSavingRules ? 'Saving...' : 'Save Chit Rules Defaults'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-card space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Statutory Guidelines</span>
                    <h3 className="text-sm font-bold text-white">Chit Funds Act Compliance</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Per the Chit Funds Act, maximum discount ceiling is capped at 40%. Month 0 is exclusively reserved as Organizer Profit with no floor auction.
                    </p>
                    <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-800 space-y-1">
                      <div>• Launch Month: <strong>Month 0 (Organizer)</strong></div>
                      <div>• Floor Bidding: <strong>Months 1 to N</strong></div>
                      <div>• Laaba Seetu: <strong>Accumulated Pool ≥ Pot</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                3. UPI & DIGITAL GATEWAY (Desktop)
                ───────────────────────────────────────────────────────────── */}
            {activeSubTab === 'upi_gateway' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">UPI Digital Payment Gateway</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Configure instant digital collection QR codes across passbooks and WhatsApp payment dispatches.</p>
                  </div>

                  <form onSubmit={handleSaveUpiGateway} className="space-y-4">
                    <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <div>
                        <div className="text-xs font-bold text-slate-800">Enable Digital UPI Inflow</div>
                        <div className="text-[11px] text-slate-500">Embed dynamic QR codes on subscriber receipts and payment links</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={upiConfig.enabled}
                        onChange={(e) => setUpiConfig({ ...upiConfig, enabled: e.target.checked })}
                        className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                    </label>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">Primary Organizer UPI VPA (ID) *</label>
                      <input
                        type="text"
                        value={upiConfig.vpa}
                        onChange={(e) => setUpiConfig({ ...upiConfig, vpa: e.target.value })}
                        placeholder="e.g. 9943609010@ibl or dr.kishor@oksbi"
                        className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">Payee Business / Account Name *</label>
                      <input
                        type="text"
                        value={upiConfig.payeeName}
                        onChange={(e) => setUpiConfig({ ...upiConfig, payeeName: e.target.value })}
                        placeholder="e.g. Dr. Kishor Anbazhakan"
                        className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">Default Inflow Treasury Vault</label>
                      <select
                        value={upiConfig.defaultVault}
                        onChange={(e) => setUpiConfig({ ...upiConfig, defaultVault: e.target.value as any })}
                        className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                      >
                        <option value="kishor_bank">Kishor Bank Account (Primary Digital)</option>
                        <option value="cash_in_hand">Cash In Hand Box (Physical Cash Drawer)</option>
                        <option value="dad_bank">Dad Bank Account (Secondary Bank)</option>
                        <option value="mom_bank">Mom Bank Account (Reserve Reserves)</option>
                      </select>
                    </div>

                    {upiSuccessMsg && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                        <span>{upiSuccessMsg}</span>
                      </div>
                    )}

                    {upiErrorMsg && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                        <span>{upiErrorMsg}</span>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSavingUpi}
                        className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingUpi ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>{isSavingUpi ? 'Saving...' : 'Save UPI Payment Gateway'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* QR Preview Desktop Column */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card flex flex-col items-center text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Live Dynamic QR Generator</span>
                  <h3 className="text-xs font-bold text-slate-800 mb-4">NPCI Compliant UPI QR Code</h3>

                  <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-inner mb-4">
                    {qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} alt="UPI QR Code" className="w-52 h-52 rounded-lg object-contain" />
                    ) : (
                      <div className="w-52 h-52 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                        <RefreshCw size={24} className="animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200/80 mb-4 text-left">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Configured VPA</div>
                    <div className="text-xs font-mono font-bold text-slate-900 break-all">{upiConfig.vpa}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{upiConfig.payeeName}</div>
                  </div>

                  <div className="w-full mb-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-left">Test Amount Simulator</div>
                    <div className="grid grid-cols-4 gap-2">
                      {[5000, 10000, 25000, 50000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setUpiTestAmount(amt);
                            triggerHapticFeedback('light');
                          }}
                          className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            upiTestAmount === amt
                              ? 'bg-brand-500 text-white border-brand-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          ₹{amt / 1000}k
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyUpiUri}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {copiedUpiUri ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copiedUpiUri ? 'UPI Intent URI Copied!' : 'Copy NPCI UPI Intent Link'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                4. NOTIFICATIONS & WHATSAPP (Desktop)
                ───────────────────────────────────────────────────────────── */}
            {activeSubTab === 'notifications' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">WhatsApp &amp; Notice Automation</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Configure automated reminder dispatches, language preferences, and pre-auction schedules.</p>
                  </div>

                  <form onSubmit={handleSaveNotifications} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">Default Message Language</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setNotifConfig({ ...notifConfig, defaultLanguage: 'ta' });
                            triggerHapticFeedback('light');
                          }}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            notifConfig.defaultLanguage === 'ta'
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>தமிழ் (Tamil)</span>
                          {notifConfig.defaultLanguage === 'ta' && <Check size={14} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setNotifConfig({ ...notifConfig, defaultLanguage: 'en' });
                            triggerHapticFeedback('light');
                          }}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            notifConfig.defaultLanguage === 'en'
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>English</span>
                          {notifConfig.defaultLanguage === 'en' && <Check size={14} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-800">Pre-Auction Reminder Notice Schedule</label>
                        <span className="text-xs font-extrabold text-emerald-600 font-mono">{notifConfig.preAuctionNoticeDays} Days Prior</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 5].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              setNotifConfig({ ...notifConfig, preAuctionNoticeDays: d });
                              triggerHapticFeedback('light');
                            }}
                            className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              notifConfig.preAuctionNoticeDays === d
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {d} {d === 1 ? 'Day Prior' : 'Days Prior'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">Official Organizer WhatsApp Number *</label>
                      <input
                        type="tel"
                        value={notifConfig.organizerHelpdeskPhone}
                        onChange={(e) => setNotifConfig({ ...notifConfig, organizerHelpdeskPhone: e.target.value })}
                        placeholder="9943609010"
                        className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">Digital Receipt Footer Note</label>
                      <input
                        type="text"
                        value={notifConfig.receiptFooterMessage}
                        onChange={(e) => setNotifConfig({ ...notifConfig, receiptFooterMessage: e.target.value })}
                        placeholder="நன்றி! உங்கள் சேமிப்பு உங்கள் எதிர்காலம்."
                        className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <div>
                        <div className="text-xs font-bold text-slate-800">Auto-prompt WhatsApp Receipt on Collection</div>
                        <div className="text-[11px] text-slate-500">Automatically display 1-tap WhatsApp receipt modal upon recording installment payment</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifConfig.autoPromptReceipt}
                        onChange={(e) => setNotifConfig({ ...notifConfig, autoPromptReceipt: e.target.checked })}
                        className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </label>

                    {notifSuccessMsg && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                        <span>{notifSuccessMsg}</span>
                      </div>
                    )}

                    {notifErrorMsg && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                        <span>{notifErrorMsg}</span>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSavingNotifs}
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingNotifs ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>{isSavingNotifs ? 'Saving...' : 'Save Notification Automation'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                <div className="lg:col-span-5 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-card space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Broadcast Automation</span>
                  <h3 className="text-sm font-bold text-white">One-Tap WhatsApp Delivery</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Automated templates are formatted with ticket numbers, cycle dues, dividend savings, and instant UPI payment links.
                  </p>
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 font-mono text-[11px] text-slate-300 space-y-1">
                    <div className="text-emerald-400 font-bold">வணக்கம் திரு/திருமதி [பெயர்],</div>
                    <div>மாத தவணை: ₹[தொகை]</div>
                    <div>தங்கள் ரசீது எண்: #[ID]</div>
                    <div className="text-slate-400 text-[10px] pt-1">{notifConfig.receiptFooterMessage}</div>
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                5. SECURITY & MAINTENANCE POLICY (Desktop)
                ───────────────────────────────────────────────────────────── */}
            {activeSubTab === 'security' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-6">
                  {/* Emergency Lockout Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isMaintenanceMode ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          <ShieldAlert size={20} />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-slate-900">Emergency Maintenance Lockout</h2>
                          <p className="text-xs text-slate-500">Restricts subscriber logins and passbook access during ledger reconciliations.</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${isMaintenanceMode ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600'}`}>
                        {isMaintenanceMode ? 'ACTIVE LOCKOUT' : 'Inactive'}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Custom Lockout Banner Notice</label>
                      <textarea
                        rows={2}
                        value={localMaintMessage}
                        onChange={(e) => setLocalMaintMessage(e.target.value)}
                        placeholder="Scheduled system maintenance in progress. Portal services will resume shortly."
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        disabled={isTogglingMaint || isMaintenanceMode || !canMaintenance}
                        data-action="system:maintenance_mode"
                        onClick={() => handleToggleMaintenanceMode(true)}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
                      >
                        {isTogglingMaint ? <RefreshCw size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                        <span>Engage Maintenance Lockout</span>
                      </button>
                      <button
                        type="button"
                        disabled={isTogglingMaint || !isMaintenanceMode || !canMaintenance}
                        data-action="system:maintenance_mode"
                        onClick={() => handleToggleMaintenanceMode(false)}
                        className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
                      >
                        <span>Restore Member Access</span>
                      </button>
                    </div>
                  </div>

                  {/* Policy Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-5">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Access &amp; Threshold Policy</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Preset default subscriber MPIN and physical cash vault warning limits.</p>
                    </div>

                    <form onSubmit={handleSaveSecurityPolicy} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">Default Onboarding Member MPIN *</label>
                        <input
                          type="text"
                          maxLength={4}
                          value={securityConfig.defaultMemberMpin}
                          onChange={(e) => setSecurityConfig({ ...securityConfig, defaultMemberMpin: e.target.value.replace(/\D/g, '') })}
                          placeholder="1234"
                          className="w-48 h-11 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold tracking-widest text-center"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">4-digit PIN auto-assigned when creating passbooks.</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-800">Physical Cash Box Safety Threshold</label>
                          <span className="text-xs font-extrabold text-brand-600 font-mono">₹{securityConfig.cashBoxSafetyThreshold.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {[50000, 100000, 150000, 250000].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => {
                                setSecurityConfig({ ...securityConfig, cashBoxSafetyThreshold: amt });
                                triggerHapticFeedback('light');
                              }}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                securityConfig.cashBoxSafetyThreshold === amt
                                  ? 'bg-brand-500 text-white border-brand-600 shadow-2xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              ₹{amt / 1000}k
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">Session Inactivity Timeout</label>
                        <div className="grid grid-cols-4 gap-2">
                          {[15, 30, 60, 0].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => {
                                setSecurityConfig({ ...securityConfig, sessionInactivityMinutes: mins });
                                triggerHapticFeedback('light');
                              }}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                securityConfig.sessionInactivityMinutes === mins
                                  ? 'bg-brand-500 text-white border-brand-600 shadow-2xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {mins === 0 ? 'Never' : `${mins} Mins`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {securitySuccessMsg && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                          <span>{securitySuccessMsg}</span>
                        </div>
                      )}

                      {securityErrorMsg && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                          <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                          <span>{securityErrorMsg}</span>
                        </div>
                      )}

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isSavingSecurity}
                          className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isSavingSecurity ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                          <span>{isSavingSecurity ? 'Saving...' : 'Save Policy Settings'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Password Form Column */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-5">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Change Admin Password</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Update Supabase Auth account password.</p>
                  </div>

                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">New Password (Min 6 chars) *</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-11 pl-3 pr-10 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        >
                          {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password *</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-11 pl-3 pr-10 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {passwordSuccessMsg && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                        <span>{passwordSuccessMsg}</span>
                      </div>
                    )}

                    {passwordErrorMsg && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                        <span>{passwordErrorMsg}</span>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isUpdatingPassword}
                        className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isUpdatingPassword ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                        <span>{isUpdatingPassword ? 'Updating Password...' : 'Update Password'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                6. DATA & DISASTER RECOVERY (Desktop)
                ───────────────────────────────────────────────────────────── */}
            {activeSubTab === 'database' && (
              <div className="space-y-6">
                {/* Disaster Recovery Hero Banner */}
                <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl border border-indigo-500/20 shadow-card flex items-center justify-between">
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Disaster Recovery &amp; Snapshots</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                        9 Core Tables
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-white">Full Database Backup (JSON Export)</h2>
                    <p className="text-xs text-indigo-200/80 leading-relaxed">
                      Download an authenticated, timestamped snapshot of all scheme definitions, member enrollments, transactions, bids, treasury vaults, and system configurations with SHA-256 integrity verification.
                    </p>
                    {lastBackupTime && (
                      <div className="text-[11px] text-indigo-200/60 font-mono pt-1">
                        Last export: <strong>{lastBackupTime}</strong> {lastBackupSha ? `(SHA-256: ${lastBackupSha.slice(0, 16)}...)` : ''}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isExportingBackup}
                    onClick={handleExportFullBackup}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer flex-shrink-0 disabled:opacity-50"
                  >
                    {isExportingBackup ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                    <span>{isExportingBackup ? 'Exporting Tables...' : 'Generate Full Backup (.json)'}</span>
                  </button>
                </div>

                {backupSuccessMsg && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                    <span>{backupSuccessMsg}</span>
                  </div>
                )}

                {/* Table Metrics */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Live Database Metrics</h3>
                      <p className="text-xs text-slate-500">Live operational row counts across core tables</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { fetchDbStats(); triggerHapticFeedback('light'); }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={12} className={loadingDbStats ? 'animate-spin' : ''} />
                      <span>Refresh Counts</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-6 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <div className="text-2xl font-black text-slate-900 font-mono">{dbStats.groupsCount}</div>
                      <div className="text-xs text-slate-500 font-bold mt-0.5">Chit Groups</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <div className="text-2xl font-black text-slate-900 font-mono">{dbStats.membershipsCount}</div>
                      <div className="text-xs text-slate-500 font-bold mt-0.5">Group Tickets</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <div className="text-2xl font-black text-slate-900 font-mono">{dbStats.subscribersCount}</div>
                      <div className="text-xs text-slate-500 font-bold mt-0.5">Subscribers</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <div className="text-2xl font-black text-slate-900 font-mono">{dbStats.transactionsCount}</div>
                      <div className="text-xs text-slate-500 font-bold mt-0.5">Transactions</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <div className="text-2xl font-black text-slate-900 font-mono">{dbStats.auctionLogsCount}</div>
                      <div className="text-xs text-slate-500 font-bold mt-0.5">Auction Logs</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col justify-between">
                      <div>
                        <div className="text-2xl font-black text-slate-900 font-mono">{dbStats.auditLogsCount}</div>
                        <div className="text-xs text-slate-500 font-bold mt-0.5">Audit Trails</div>
                      </div>
                      {dbStats.auditLogsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowClearAuditModal(true);
                            setResetSuccessMsg(null);
                            setResetErrorMsg(null);
                            triggerHapticFeedback('warning');
                          }}
                          className="mt-2 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          Clear Trails
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Danger Zone Purge */}
                <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                        <AlertTriangle size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-rose-900">Danger Zone: Factory Database Purge</h3>
                        <p className="text-xs text-rose-600">Irreversible reset of simulation data, test groups, and member transactions.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canResetDatabase}
                      onClick={() => {
                        setShowResetModal(true);
                        setResetSuccessMsg(null);
                        setResetErrorMsg(null);
                        triggerHapticFeedback('warning');
                      }}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                      <span>Wipe Test Database</span>
                    </button>
                  </div>

                  {resetSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                      <span>{resetSuccessMsg}</span>
                    </div>
                  )}

                  {resetErrorMsg && (
                    <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-700 flex-shrink-0" />
                      <span>{resetErrorMsg}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                7. PROFILE & ACCOUNT (Desktop)
                ───────────────────────────────────────────────────────────── */}
            {activeSubTab === 'profile' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Admin Account Profile</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Manage administrative credentials and contact information.</p>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name *</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Dr. Kishor Anbazhakan"
                        className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Phone Number (10 Digits)</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">+91</span>
                        <input
                          type="tel"
                          maxLength={10}
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="9943609010"
                          className="w-full h-11 pl-12 pr-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Account Email</label>
                      <input
                        type="email"
                        disabled
                        value={email}
                        className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-mono cursor-not-allowed"
                      />
                    </div>

                    {profileSuccessMsg && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                        <span>{profileSuccessMsg}</span>
                      </div>
                    )}

                    {profileErrorMsg && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                        <span>{profileErrorMsg}</span>
                      </div>
                    )}

                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingProfile ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>{isSavingProfile ? 'Saving...' : 'Save Profile Details'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback('light');
                          signOut();
                        }}
                        className="px-6 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </form>
                </div>

                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                      {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{profile?.fullName || 'Administrator'}</h3>
                      <p className="text-xs text-slate-500 font-mono">{email}</p>
                      <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active Administrator
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          FACTORY RESET CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle size={20} />
                <h3 className="font-bold text-sm text-slate-900">Confirm Complete Database Purge</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setConfirmKeyword('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will permanently delete all chit groups, member rosters, staff access, auctions, and payment transactions. Treasury vault balances will reset to ₹0, and only the main administrator account (kishoranbazhakan@gmail.com) will be preserved.
            </p>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
              <Info size={16} className="text-amber-600 flex-shrink-0" />
              <span>We strongly advise downloading a JSON backup prior to purging.</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Type <strong className="text-rose-600 font-mono">RESET</strong> to confirm:
              </label>
              <input
                type="text"
                value={confirmKeyword}
                onChange={(e) => setConfirmKeyword(e.target.value)}
                placeholder="RESET"
                className="w-full h-11 px-3 text-sm rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono font-bold tracking-wider text-center"
              />
            </div>

            <div className="pt-2 space-y-2.5">
              <SlideToConfirm
                onConfirm={handleExecuteDatabaseReset}
                disabled={confirmKeyword.trim().toUpperCase() !== 'RESET' || isResettingDb}
                isLoading={isResettingDb}
                label="Slide to Purge Database"
                confirmedLabel="Purging Data..."
                colorVariant="red"
              />
              <button
                type="button"
                onClick={handleExecuteDatabaseReset}
                disabled={confirmKeyword.trim().toUpperCase() !== 'RESET' || isResettingDb}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} />
                <span>{isResettingDb ? 'Purging Database...' : 'Confirm Purge (Click)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          CLEAR AUDIT TRAILS CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {showClearAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 size={20} />
                <h3 className="font-bold text-sm text-slate-900">Clear All Audit Trails</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowClearAuditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently clear all <strong className="font-mono text-slate-900">{dbStats.auditLogsCount}</strong> administrative audit trails and system activity feed logs? This action is irreversible. All other subscriber and scheme data will remain completely intact.
            </p>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowClearAuditModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingAuditLogs}
                onClick={handleClearAuditTrails}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>{isClearingAuditLogs ? 'Clearing Logs...' : 'Yes, Clear All Logs'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
