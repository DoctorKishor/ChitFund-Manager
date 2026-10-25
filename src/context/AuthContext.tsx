'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'manager' | 'subscriber' | string;

export interface UserProfile {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  email?: string;
  passbookToken?: string;
  isBlocked?: boolean;
  mpin?: string;
  isDefaultPin?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateMpin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPassbookToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPhoneAndMpin: (phone: string, mpin: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PASSBOOK_SESSION_KEY = 'cf_passbook_token_session';
const PHONE_SESSION_KEY = 'cf_phone_subscriber_session';

const encodePhoneSession = (data: { phone: string; mpin: string }) => {
  try {
    return btoa(encodeURIComponent(JSON.stringify({ p: data.phone, m: data.mpin, t: Date.now() })));
  } catch {
    return JSON.stringify(data);
  }
};

const decodePhoneSession = (raw: string): { phone: string; mpin: string } | null => {
  try {
    const decoded = decodeURIComponent(atob(raw));
    const parsed = JSON.parse(decoded);
    if (parsed.p && parsed.m) {
      return { phone: parsed.p, mpin: parsed.m };
    }
    if (parsed.phone && parsed.mpin) {
      return { phone: parsed.phone, mpin: parsed.mpin };
    }
  } catch {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.phone && parsed.mpin) return parsed;
    } catch {}
  }
  return null;
};

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
      }

      if (data) {
        if (data.is_blocked && data.role !== 'admin') {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          alert('Your account portal access has been suspended by an Administrator.');
          return;
        }

        const userPin = data.mpin || '1234';
        setProfile({
          id: data.id,
          fullName: data.full_name || 'User',
          phoneNumber: data.phone_number || '',
          role: (data.role as UserRole) || 'subscriber',
          email: email || '',
          passbookToken: data.passbook_token || undefined,
          isBlocked: data.is_blocked || false,
          mpin: userPin,
          isDefaultPin: userPin === '1234',
        });
      } else {
        // Fallback: If auth user exists in Supabase Auth but profile row is delayed or missing,
        // create or construct a fallback profile object from user metadata
        const { data: userData } = await supabase.auth.getUser();
        const userObj = userData?.user;
        const fallbackRole = (userObj?.user_metadata?.role as UserRole) || 'subscriber';
        const fallbackName = userObj?.user_metadata?.full_name || email?.split('@')[0] || 'Subscriber';
        const fallbackPhone = userObj?.user_metadata?.phone_number || userObj?.phone || '';

        setProfile({
          id: userId,
          fullName: fallbackName,
          phoneNumber: fallbackPhone,
          role: fallbackRole,
          email: email || userObj?.email || '',
          mpin: '1234',
          isDefaultPin: true,
        });

        // Ensure profile exists in profiles table
        await supabase.from('profiles').upsert({
          id: userId,
          full_name: fallbackName,
          phone_number: fallbackPhone,
          role: fallbackRole,
          mpin: '1234',
        });
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  const updateMpin = async (oldPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
    if (!profile?.id) return { success: false, error: 'No active session found.' };
    try {
      const { data, error } = await supabase.rpc('update_subscriber_mpin', {
        p_profile_id: profile.id,
        p_old_mpin: oldPin,
        p_new_mpin: newPin,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data || !data.success) {
        return { success: false, error: data?.error || 'Failed to update PIN.' };
      }

      // Update local profile state
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              mpin: newPin,
              isDefaultPin: newPin === '1234',
            }
          : null
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error updating PIN' };
    }
  };

  const loginWithPassbookToken = async (token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      // Clear any existing Supabase session to prevent account collision (HIGH-04)
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        localStorage.removeItem(PHONE_SESSION_KEY);
      }

      const cleanToken = token.trim();
      
      const { data, error } = await supabase.rpc('authenticate_by_passbook_token', {
        p_token: cleanToken,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const userData = data?.user || data?.profile;
      if (!data || !data.success || !userData) {
        return { success: false, error: data?.error || 'Invalid or unassigned Passbook QR code.' };
      }

      const userPin = userData.mpin || '1234';
      const subscriberProfile: UserProfile = {
        id: userData.id,
        fullName: userData.fullName || 'Subscriber',
        phoneNumber: userData.phoneNumber || '',
        role: userData.role || 'subscriber',
        passbookToken: userData.passbookToken || cleanToken,
        mpin: userPin,
        isDefaultPin: userData.isDefaultPin ?? (userPin === '1234'),
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
      // Clear any existing Supabase session to prevent collision (HIGH-04)
      await supabase.auth.signOut();

      const rawDigits = phone.replace(/\D/g, '');
      const cleanPhone = rawDigits.slice(-10);
      const cleanMpin = mpin.trim();

      if (!rawDigits) {
        return { success: false, error: 'Please enter a valid mobile number.' };
      }

      // Use Security Definer RPC to authenticate subscriber safely bypassing anon RLS
      const { data, error } = await supabase.rpc('authenticate_by_phone_and_mpin', {
        p_phone: cleanPhone,
        p_mpin: cleanMpin || '1234',
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const userData = data?.user || data?.profile;
      if (!data || !data.success || !userData) {
        return { success: false, error: data?.error || 'Login failed.' };
      }

      const userPin = userData.mpin || cleanMpin || '1234';
      const subscriberProfile: UserProfile = {
        id: userData.id,
        fullName: userData.fullName || 'Subscriber',
        phoneNumber: userData.phoneNumber || '',
        role: (userData.role as UserRole) || 'subscriber',
        passbookToken: userData.passbookToken || undefined,
        mpin: userPin,
        isDefaultPin: userData.isDefaultPin ?? (userPin === '1234'),
      };

      setProfile(subscriberProfile);
      setUser(null);

      if (typeof window !== 'undefined') {
        if (userData.passbookToken) {
          localStorage.setItem(PASSBOOK_SESSION_KEY, userData.passbookToken);
          localStorage.removeItem(PHONE_SESSION_KEY);
        } else {
          // Persist phone session with encoding (MED-06)
          localStorage.setItem(PHONE_SESSION_KEY, encodePhoneSession({ phone: cleanPhone, mpin: cleanMpin }));
          localStorage.removeItem(PASSBOOK_SESSION_KEY);
        }
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
      // Admin/manager: fetch profile silently
      await fetchProfile(user.id, user.email);
    } else if (profile?.id && !profile?.passbookToken) {
      // Phone+MPIN subscriber: re-fetch profile row directly by ID
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profile.id)
          .maybeSingle();
        if (data) {
          setProfile(prev => prev ? {
            ...prev,
            fullName: data.full_name || prev.fullName,
            phoneNumber: data.phone_number || prev.phoneNumber,
            role: (data.role as UserRole) || prev.role,
            mpin: data.mpin || '1234',
            isDefaultPin: (data.mpin || '1234') === '1234',
            isBlocked: data.is_blocked || false,
          } : null);
        }
      } catch (err) {
        console.warn('Silent profile refresh failed:', err);
      }
    } else if (profile?.passbookToken) {
      // QR passbook subscriber: silent re-auth without loading spinner
      try {
        const { data } = await supabase.rpc('authenticate_by_passbook_token', {
          p_token: profile.passbookToken,
        });
        if (data?.success && data?.user) {
          setProfile(prev => prev ? {
            ...prev,
            fullName: data.user.fullName,
            phoneNumber: data.user.phoneNumber,
            role: data.user.role,
            mpin: data.user.mpin || '1234',
            isDefaultPin: data.user.isDefaultPin ?? false,
          } : null);
        }
      } catch (err) {
        console.warn('Silent passbook refresh failed:', err);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    let initialAuthDone = false;

    const initAuth = async () => {
      try {
        setLoading(true);

        // 1. Check Supabase Auth Session FIRST (Admins / Managers / Email accounts take highest precedence)
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          // Clear any stale subscriber tokens from localStorage
          if (typeof window !== 'undefined') {
            localStorage.removeItem(PASSBOOK_SESSION_KEY);
            localStorage.removeItem(PHONE_SESSION_KEY);
          }
          setUser(session.user);
          await fetchProfile(session.user.id, session.user.email);
          initialAuthDone = true;
          setLoading(false);
          return;
        }

        // 2. If no Supabase user session, check Passbook Token Session in localStorage
        if (typeof window !== 'undefined') {
          const savedPassbookToken = localStorage.getItem(PASSBOOK_SESSION_KEY);
          if (savedPassbookToken) {
            const res = await loginWithPassbookToken(savedPassbookToken);
            if (res.success && isMounted) {
              initialAuthDone = true;
              setLoading(false);
              return;
            } else if (typeof window !== 'undefined') {
              localStorage.removeItem(PASSBOOK_SESSION_KEY);
            }
          }

          // 3. If no passbook token, check saved phone+mpin session (MED-06)
          const savedPhoneSession = localStorage.getItem(PHONE_SESSION_KEY);
          if (savedPhoneSession) {
            try {
              const decoded = decodePhoneSession(savedPhoneSession);
              if (decoded?.phone && decoded?.mpin) {
                const res = await loginWithPhoneAndMpin(decoded.phone, decoded.mpin);
                if (res.success && isMounted) {
                  initialAuthDone = true;
                  setLoading(false);
                  return;
                } else if (typeof window !== 'undefined') {
                  localStorage.removeItem(PHONE_SESSION_KEY);
                }
              } else if (typeof window !== 'undefined') {
                localStorage.removeItem(PHONE_SESSION_KEY);
              }
            } catch {
              localStorage.removeItem(PHONE_SESSION_KEY);
            }
          }
        }

        if (isMounted) {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('Error in initAuth:', err);
      } finally {
        if (isMounted) {
          initialAuthDone = true;
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen to Supabase Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'INITIAL_SESSION' && !initialAuthDone) {
        return;
      }

      if (session?.user) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(PASSBOOK_SESSION_KEY);
          localStorage.removeItem(PHONE_SESSION_KEY);
        }
        setProfile(null);
        setUser(session.user);
        await fetchProfile(session.user.id, session.user.email);
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        if (
          typeof window !== 'undefined' &&
          !localStorage.getItem(PASSBOOK_SESSION_KEY) &&
          !localStorage.getItem(PHONE_SESSION_KEY)
        ) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PASSBOOK_SESSION_KEY);
      localStorage.removeItem(PHONE_SESSION_KEY);
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
        updateMpin,
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
