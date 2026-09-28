'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from './AuthContext';

interface MaintenanceSettings {
  enabled: boolean;
  message?: string;
  updated_at?: string;
  updated_by_name?: string;
}

interface MaintenanceContextType {
  isMaintenanceMode: boolean;
  maintenanceMessage: string;
  loading: boolean;
  toggleMaintenanceMode: (enabled: boolean, customMessage?: string) => Promise<{ success: boolean; error?: string }>;
  refreshMaintenance: () => Promise<void>;
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

export const MaintenanceProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>('Scheduled upgrades and performance optimizations in progress.');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMaintenanceSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .maybeSingle();

      if (error) {
        console.error('Error fetching maintenance setting:', error);
        return;
      }

      if (data && data.value) {
        const val = data.value as MaintenanceSettings;
        setIsMaintenanceMode(!!val.enabled);
        if (val.message) {
          setMaintenanceMessage(val.message);
        }
      }
    } catch (err) {
      console.error('Failed to load maintenance mode:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaintenanceSetting();

    // Supabase Realtime channel for instant global sync
    const channel = supabase
      .channel('system_settings_maintenance')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.maintenance_mode',
        },
        (payload) => {
          if (payload.new && (payload.new as any).value) {
            const val = (payload.new as any).value as MaintenanceSettings;
            setIsMaintenanceMode(!!val.enabled);
            if (val.message) {
              setMaintenanceMessage(val.message);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleMaintenanceMode = async (
    enabled: boolean,
    customMessage?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const payload: MaintenanceSettings = {
        enabled,
        message: customMessage || (enabled ? 'Scheduled system maintenance in progress. Portal services will resume shortly.' : ''),
        updated_at: new Date().toISOString(),
        updated_by_name: profile?.fullName || 'Administrator',
      };

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'maintenance_mode',
          value: payload,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id || null,
        });

      if (error) throw error;

      setIsMaintenanceMode(enabled);
      if (customMessage) setMaintenanceMessage(customMessage);

      return { success: true };
    } catch (err: any) {
      console.error('Failed to toggle maintenance mode:', err);
      return { success: false, error: err.message || 'Failed to update maintenance mode' };
    }
  };

  return (
    <MaintenanceContext.Provider
      value={{
        isMaintenanceMode,
        maintenanceMessage,
        loading,
        toggleMaintenanceMode,
        refreshMaintenance: fetchMaintenanceSetting,
      }}
    >
      {children}
    </MaintenanceContext.Provider>
  );
};

export const useMaintenance = () => {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error('useMaintenance must be used within a MaintenanceProvider');
  }
  return context;
};
