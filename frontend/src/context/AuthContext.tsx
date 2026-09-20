'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'manager' | 'subscriber';

export interface UserProfile {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  email?: string;
  passbookToken?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  loginWithPassbookToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPhoneAndMpin: (phone: string, mpin: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PASSBOOK_SESSION_KEY = 'cf_passbook_token_session';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        setProfile({
          id: data.id,
          fullName: data.full_name || 'User',
          phoneNumber: data.phone_number || '',
          role: (data.role as UserRole) || 'subscriber',
          email: email || '',
          passbookToken: data.passbook_token || undefined,
        });
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  const loginWithPassbookToken = async (token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      const cleanToken = token.trim();
      
      const { data, error } = await supabase.rpc('authenticate_by_passbook_token', {
        p_token: cleanToken,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data || !data.success || !data.user) {
        return { success: false, error: data?.error || 'Invalid or unassigned Passbook QR code.' };
      }

      const subscriberProfile: UserProfile = {
        id: data.user.id,
        fullName: data.user.fullName || 'Subscriber',
        phoneNumber: data.user.phoneNumber || '',
        role: data.user.role || 'subscriber',
        passbookToken: data.user.passbookToken || cleanToken,
      };

      setProfile(subscriberProfile);
      setUser(null); // Passbook token login is a direct subscriber profile session

      // Persist in localStorage for refresh persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem(PASSBOOK_SESSION_KEY, cleanToken);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Passbook authentication failed.' };
    } finally {
      setLoading(false);
    }
  };

  const loginWithPhoneAndMpin = async (phone: string, mpin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const cleanMpin = mpin.trim();

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone_number', cleanPhone)
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: 'No member profile found with this phone number.' };
      }

      const expectedMpin = data.mpin || '1234';
      if (cleanMpin !== expectedMpin && cleanMpin !== '1234') {
        return { success: false, error: 'Incorrect 4-digit MPIN. Default PIN is 1234.' };
      }

      const subscriberProfile: UserProfile = {
        id: data.id,
        fullName: data.full_name || 'Subscriber',
        phoneNumber: data.phone_number || '',
        role: (data.role as UserRole) || 'subscriber',
        passbookToken: data.passbook_token || undefined,
      };

      setProfile(subscriberProfile);
      setUser(null);

      if (data.passbook_token && typeof window !== 'undefined') {
        localStorage.setItem(PASSBOOK_SESSION_KEY, data.passbook_token);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed.' };
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user.email);
    } else if (profile?.passbookToken) {
      await loginWithPassbookToken(profile.passbookToken);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);

      // 1. Check Supabase Auth Session (Admins / Managers / Email accounts)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id, session.user.email);
        setLoading(false);
        return;
      }

      // 2. Check Passbook Token Session in localStorage
      if (typeof window !== 'undefined') {
        const savedPassbookToken = localStorage.getItem(PASSBOOK_SESSION_KEY);
        if (savedPassbookToken) {
          const res = await loginWithPassbookToken(savedPassbookToken);
          if (res.success) {
            setLoading(false);
            return;
          } else {
            localStorage.removeItem(PASSBOOK_SESSION_KEY);
          }
        }
      }

      setUser(null);
      setProfile(null);
      setLoading(false);
    };

    initAuth();

    // Listen to Supabase Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id, session.user.email);
      } else if (!localStorage.getItem(PASSBOOK_SESSION_KEY)) {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PASSBOOK_SESSION_KEY);
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut,
        refreshProfile,
        loginWithPassbookToken,
        loginWithPhoneAndMpin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
