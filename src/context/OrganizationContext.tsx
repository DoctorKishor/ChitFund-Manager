'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from './AuthContext';

export interface OrganizationSettings {
  name: string;
  tagline?: string;
  initials?: string;
  updated_at?: string;
  updated_by_name?: string;
}

interface OrganizationContextType {
  organizationName: string;
  organizationTagline: string;
  organizationInitials: string;
  loading: boolean;
  updateOrganizationSettings: (settings: { name: string; tagline?: string; initials?: string }) => Promise<{ success: boolean; error?: string }>;
  refreshOrganizationSettings: () => Promise<void>;
}

export function computeInitials(name: string): string {
  if (!name) return 'CF';
  // Unicode-aware: preserve all letters (Latin, Tamil, Devanagari, etc.) and numbers
  const clean = name.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'CF';
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase();
  return (Array.from(words[0])[0] + Array.from(words[1])[0]).toUpperCase();
}

const DEFAULT_ORG_NAME = 'ANBAZHAKAN CHIT FUNDS';
const DEFAULT_TAGLINE = 'TRUSTED CHIT FUNDS MANAGEMENT';
const STORAGE_KEY = 'chitfund_organization_settings';

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  
  // Initialize with cached localStorage or default once
  const [initialSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          const name = parsed.name || DEFAULT_ORG_NAME;
          return {
            name,
            tagline: parsed.tagline || DEFAULT_TAGLINE,
            initials: parsed.initials || computeInitials(name),
          };
        }
      } catch (e) {
        // Ignore JSON error
      }
    }
    return {
      name: DEFAULT_ORG_NAME,
      tagline: DEFAULT_TAGLINE,
      initials: computeInitials(DEFAULT_ORG_NAME),
    };
  });

  const [organizationName, setOrganizationName] = useState<string>(initialSettings.name);
  const [organizationTagline, setOrganizationTagline] = useState<string>(initialSettings.tagline);
  const [organizationInitials, setOrganizationInitials] = useState<string>(initialSettings.initials);

  const [loading, setLoading] = useState<boolean>(true);

  const fetchOrganizationSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'organization_info')
        .maybeSingle();

      if (error) {
        console.warn('Error fetching organization info from system_settings:', error);
        return;
      }

      if (data && data.value) {
        const val = data.value as OrganizationSettings;
        if (val.name) {
          setOrganizationName(val.name);
          setOrganizationTagline(val.tagline || DEFAULT_TAGLINE);
          setOrganizationInitials(val.initials || computeInitials(val.name));

          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
          }
        }
      }
    } catch (err) {
      console.error('Failed to load organization settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizationSettings();

    // Supabase Realtime channel for instant global propagation across all users & tabs
    const channel = supabase
      .channel('system_settings_organization')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.organization_info',
        },
        (payload) => {
          if (payload.new && (payload.new as any).value) {
            const val = (payload.new as any).value as OrganizationSettings;
            if (val.name) {
              setOrganizationName(val.name);
              setOrganizationTagline(val.tagline || DEFAULT_TAGLINE);
              setOrganizationInitials(val.initials || computeInitials(val.name));

              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateOrganizationSettings = async (settings: {
    name: string;
    tagline?: string;
    initials?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const trimmedName = settings.name.trim() || DEFAULT_ORG_NAME;
      const trimmedTagline = settings.tagline?.trim() || DEFAULT_TAGLINE;
      const computedInit = settings.initials?.trim() || computeInitials(trimmedName);

      const payload: OrganizationSettings = {
        name: trimmedName,
        tagline: trimmedTagline,
        initials: computedInit,
        updated_at: new Date().toISOString(),
        updated_by_name: profile?.fullName || 'Administrator',
      };

      // Optimistic update
      setOrganizationName(trimmedName);
      setOrganizationTagline(trimmedTagline);
      setOrganizationInitials(computedInit);

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      }

      const { error } = await supabase
        .from('system_settings')
        .upsert(
          {
            key: 'organization_info',
            value: payload,
            updated_at: new Date().toISOString(),
            updated_by: profile?.id || null,
          },
          { onConflict: 'key' }
        );

      if (error) {
        console.error('Failed to update organization settings in database:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Exception updating organization settings:', err);
      return { success: false, error: err.message || 'Failed to update organization name.' };
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizationName,
        organizationTagline,
        organizationInitials,
        loading,
        updateOrganizationSettings,
        refreshOrganizationSettings: fetchOrganizationSettings,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = (): OrganizationContextType => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
