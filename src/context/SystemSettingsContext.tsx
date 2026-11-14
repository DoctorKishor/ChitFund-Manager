'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from './AuthContext';

export interface ChitRulesSettings {
  defaultFloorDiscountPercent: number;
  defaultBidStep: number;
  defaultAuctionTime: number;
  defaulterGraceDays: number;
  allowPartialPayments: boolean;
  autoTriggerLaabaSeetu: boolean;
}

export interface UpiGatewaySettings {
  enabled: boolean;
  vpa: string;
  payeeName: string;
  defaultVault: 'kishor_bank' | 'dad_bank' | 'mom_bank';
  allowCustomAmount: boolean;
}

export interface NotificationPreferences {
  defaultLanguage: 'ta' | 'en';
  autoPromptReceipt: boolean;
  preAuctionNoticeDays: number;
  organizerHelpdeskPhone: string;
  receiptFooterMessage: string;
}

export interface PortalSecurityPolicy {
  defaultMemberMpin: string;
  cashBoxSafetyThreshold: number;
  sessionInactivityMinutes: number;
}

export interface SystemSettingsContextType {
  chitRules: ChitRulesSettings;
  upiConfig: UpiGatewaySettings;
  notifConfig: NotificationPreferences;
  securityConfig: PortalSecurityPolicy;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  updateChitRules: (rules: Partial<ChitRulesSettings>) => Promise<{ success: boolean; error?: string }>;
  updateUpiConfig: (config: Partial<UpiGatewaySettings>) => Promise<{ success: boolean; error?: string }>;
  updateNotifConfig: (config: Partial<NotificationPreferences>) => Promise<{ success: boolean; error?: string }>;
  updateSecurityConfig: (config: Partial<PortalSecurityPolicy>) => Promise<{ success: boolean; error?: string }>;
}

export const DEFAULT_CHIT_RULES: ChitRulesSettings = {
  defaultFloorDiscountPercent: 40,
  defaultBidStep: 1000,
  defaultAuctionTime: 15,
  defaulterGraceDays: 5,
  allowPartialPayments: true,
  autoTriggerLaabaSeetu: true,
};

export const DEFAULT_UPI_CONFIG: UpiGatewaySettings = {
  enabled: true,
  vpa: '9943609010@ibl',
  payeeName: 'Dr. Kishor Anbazhakan',
  defaultVault: 'kishor_bank',
  allowCustomAmount: true,
};

export const DEFAULT_NOTIF_CONFIG: NotificationPreferences = {
  defaultLanguage: 'ta',
  autoPromptReceipt: true,
  preAuctionNoticeDays: 2,
  organizerHelpdeskPhone: '9943609010',
  receiptFooterMessage: 'நன்றி! உங்கள் சேமிப்பு உங்கள் எதிர்காலம்.',
};

export const DEFAULT_SECURITY_CONFIG: PortalSecurityPolicy = {
  defaultMemberMpin: '1234',
  cashBoxSafetyThreshold: 150000,
  sessionInactivityMinutes: 60,
};

const STORAGE_KEYS = {
  chitRules: 'chitfund_chit_rules_defaults',
  upi: 'chitfund_upi_payment_gateway',
  notifications: 'chitfund_notification_preferences',
  security: 'chitfund_portal_security_policy',
};

const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

export const SystemSettingsProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();

  // 1. Synchronously initialize from localStorage cache to prevent layout shift
  const [chitRules, setChitRules] = useState<ChitRulesSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEYS.chitRules);
        if (cached) return { ...DEFAULT_CHIT_RULES, ...JSON.parse(cached) };
      } catch (e) { /* ignore */ }
    }
    return DEFAULT_CHIT_RULES;
  });

  const [upiConfig, setUpiConfig] = useState<UpiGatewaySettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEYS.upi);
        if (cached) return { ...DEFAULT_UPI_CONFIG, ...JSON.parse(cached) };
      } catch (e) { /* ignore */ }
    }
    return DEFAULT_UPI_CONFIG;
  });

  const [notifConfig, setNotifConfig] = useState<NotificationPreferences>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEYS.notifications);
        if (cached) return { ...DEFAULT_NOTIF_CONFIG, ...JSON.parse(cached) };
      } catch (e) { /* ignore */ }
    }
    return DEFAULT_NOTIF_CONFIG;
  });

  const [securityConfig, setSecurityConfig] = useState<PortalSecurityPolicy>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEYS.security);
        if (cached) return { ...DEFAULT_SECURITY_CONFIG, ...JSON.parse(cached) };
      } catch (e) { /* ignore */ }
    }
    return DEFAULT_SECURITY_CONFIG;
  });

  const [loading, setLoading] = useState<boolean>(true);

  // 2. Fetch all system_settings rows from Supabase
  const refreshSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value');

      if (error) {
        console.warn('Error fetching system_settings from database:', error);
        return;
      }

      if (data && data.length > 0) {
        data.forEach((row: { key: string; value: any }) => {
          if (!row.value) return;

          switch (row.key) {
            case 'chit_rules_defaults': {
              const val = { ...DEFAULT_CHIT_RULES, ...row.value };
              setChitRules(val);
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.chitRules, JSON.stringify(val));
              }
              break;
            }
            case 'upi_payment_gateway': {
              const val = { ...DEFAULT_UPI_CONFIG, ...row.value };
              setUpiConfig(val);
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.upi, JSON.stringify(val));
              }
              break;
            }
            case 'notification_preferences': {
              const val = { ...DEFAULT_NOTIF_CONFIG, ...row.value };
              setNotifConfig(val);
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(val));
              }
              break;
            }
            case 'portal_security_policy': {
              const val = { ...DEFAULT_SECURITY_CONFIG, ...row.value };
              setSecurityConfig(val);
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.security, JSON.stringify(val));
              }
              break;
            }
          }
        });
      }
    } catch (err) {
      console.error('Failed to load system settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. Mount effects: Fetch settings & subscribe to real-time events
  useEffect(() => {
    refreshSettings();

    // Listen for local browser updates from SettingsManager
    const handleLocalSettingsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string; value: any }>;
      if (!customEvent.detail) return;
      const { key, value } = customEvent.detail;

      if (key === 'chit_rules_defaults') {
        setChitRules(prev => ({ ...prev, ...value }));
      } else if (key === 'upi_payment_gateway') {
        setUpiConfig(prev => ({ ...prev, ...value }));
      } else if (key === 'notification_preferences') {
        setNotifConfig(prev => ({ ...prev, ...value }));
      } else if (key === 'portal_security_policy') {
        setSecurityConfig(prev => ({ ...prev, ...value }));
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('chitfund:settings_updated', handleLocalSettingsUpdate);
    }

    // Supabase Realtime channel across all active browser sessions
    const channelName = `system_settings_sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
        },
        (payload) => {
          if (payload.new && (payload.new as any).key && (payload.new as any).value) {
            const key = (payload.new as any).key;
            const value = (payload.new as any).value;

            if (key === 'chit_rules_defaults') {
              setChitRules(prev => ({ ...prev, ...value }));
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.chitRules, JSON.stringify({ ...DEFAULT_CHIT_RULES, ...value }));
              }
            } else if (key === 'upi_payment_gateway') {
              setUpiConfig(prev => ({ ...prev, ...value }));
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.upi, JSON.stringify({ ...DEFAULT_UPI_CONFIG, ...value }));
              }
            } else if (key === 'notification_preferences') {
              setNotifConfig(prev => ({ ...prev, ...value }));
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify({ ...DEFAULT_NOTIF_CONFIG, ...value }));
              }
            } else if (key === 'portal_security_policy') {
              setSecurityConfig(prev => ({ ...prev, ...value }));
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.security, JSON.stringify({ ...DEFAULT_SECURITY_CONFIG, ...value }));
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('chitfund:settings_updated', handleLocalSettingsUpdate);
      }
      supabase.removeChannel(channel);
    };
  }, [refreshSettings]);

  // 4. Update helper functions with database persistence + local broadcasting
  const updateChitRules = async (rules: Partial<ChitRulesSettings>) => {
    const merged = { ...chitRules, ...rules };
    setChitRules(merged);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.chitRules, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('chitfund:settings_updated', {
        detail: { key: 'chit_rules_defaults', value: merged }
      }));
    }

    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'chit_rules_defaults',
        value: merged,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id || null,
      });

    if (error) {
      console.error('Failed to update chit rules in database:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const updateUpiConfig = async (config: Partial<UpiGatewaySettings>) => {
    const merged = { ...upiConfig, ...config };
    setUpiConfig(merged);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.upi, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('chitfund:settings_updated', {
        detail: { key: 'upi_payment_gateway', value: merged }
      }));
    }

    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'upi_payment_gateway',
        value: merged,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id || null,
      });

    if (error) {
      console.error('Failed to update UPI settings in database:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const updateNotifConfig = async (config: Partial<NotificationPreferences>) => {
    const merged = { ...notifConfig, ...config };
    setNotifConfig(merged);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('chitfund:settings_updated', {
        detail: { key: 'notification_preferences', value: merged }
      }));
    }

    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'notification_preferences',
        value: merged,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id || null,
      });

    if (error) {
      console.error('Failed to update notification settings in database:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const updateSecurityConfig = async (config: Partial<PortalSecurityPolicy>) => {
    const merged = { ...securityConfig, ...config };
    setSecurityConfig(merged);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.security, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('chitfund:settings_updated', {
        detail: { key: 'portal_security_policy', value: merged }
      }));
    }

    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'portal_security_policy',
        value: merged,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id || null,
      });

    if (error) {
      console.error('Failed to update security policy in database:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  return (
    <SystemSettingsContext.Provider
      value={{
        chitRules,
        upiConfig,
        notifConfig,
        securityConfig,
        loading,
        refreshSettings,
        updateChitRules,
        updateUpiConfig,
        updateNotifConfig,
        updateSecurityConfig,
      }}
    >
      {children}
    </SystemSettingsContext.Provider>
  );
};

export const useSystemSettings = () => {
  const context = useContext(SystemSettingsContext);
  if (!context) {
    // Return graceful fallbacks if accessed outside provider (e.g. during SSR or early tests)
    return {
      chitRules: DEFAULT_CHIT_RULES,
      upiConfig: DEFAULT_UPI_CONFIG,
      notifConfig: DEFAULT_NOTIF_CONFIG,
      securityConfig: DEFAULT_SECURITY_CONFIG,
      loading: false,
      refreshSettings: async () => {},
      updateChitRules: async () => ({ success: true }),
      updateUpiConfig: async () => ({ success: true }),
      updateNotifConfig: async () => ({ success: true }),
      updateSecurityConfig: async () => ({ success: true }),
    };
  }
  return context;
};
