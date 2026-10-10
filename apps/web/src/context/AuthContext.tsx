import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserRole } from '@hiredesk/shared';

export interface TrustedUserProfile {
  id: string;
  authUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string | null;
  role: UserRole;
  organizationId: string | null;
  organizationName: string | null;
  clientId: string | null;
  clientName: string | null;
  isActive: boolean;
}

export interface UserPermissions {
  isSuperAdmin: boolean;
  isManager: boolean;
  isRecruiter: boolean;
  isClient: boolean;
  canManageJobs: boolean;
  canManageClients: boolean;
  canReviewCandidates: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: TrustedUserProfile | null;
  permissions: UserPermissions | null;
  loading: boolean;
  profileError: string | null;
  isConfigured: boolean;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<TrustedUserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (token: string) => {
    try {
      setProfileError(null);
      const res = await fetch('/api/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setProfile(json.data.user);
        setPermissions(json.data.permissions);
      } else {
        const errorMsg = json.error?.message || 'Failed to load user profile';
        setProfileError(errorMsg);
        setProfile(null);
        setPermissions(null);
      }
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Network error loading profile');
      setProfile(null);
      setPermissions(null);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // 1. Restore active session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.access_token) {
        fetchProfile(currentSession.access_token).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 2. Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.access_token) {
        await fetchProfile(newSession.access_token);
      } else {
        setProfile(null);
        setPermissions(null);
        setProfileError(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase credentials are not configured in .env. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      };
    }

    setLoading(true);
    setProfileError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) {
      setLoading(false);
      return { success: false, error: error.message };
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      await fetchProfile(data.session.access_token);
    }

    setLoading(false);
    return { success: true };
  };

  const signOut = async (): Promise<void> => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setUser(null);
    setProfile(null);
    setPermissions(null);
    setProfileError(null);
  };

  const refreshProfile = async (): Promise<void> => {
    if (session?.access_token) {
      await fetchProfile(session.access_token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        permissions,
        loading,
        profileError,
        isConfigured: isSupabaseConfigured,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
