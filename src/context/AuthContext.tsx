'use client';

import React, {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export interface UserData {
  id: number;
  email: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
  bio: string | null;
  mode: 'bible' | 'positivity';
  email_verified: boolean;
  onboarding_complete: boolean;
  is_admin: boolean;
  preferred_translation: string;
  language: string;
  timezone: string;
}

export interface AuthContextValue {
  user: UserData | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (userData: UserData) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback((userData: UserData) => {
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Proceed with client-side logout even if API call fails
    }
    setUser(null);
    window.location.href = '/login';
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const isAuthenticated = user !== null;

  return (
    <AuthContext.Provider
      value={{ user, loading, isAuthenticated, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
