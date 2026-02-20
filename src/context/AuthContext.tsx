'use client';

import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const TOKEN_KEY = '__fl_auth_token';

export interface UserData {
  id: number;
  email: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
  bio: string | null;
  mode: 'bible' | 'positivity';
  status: 'active' | 'deactivated' | 'pending_deletion' | 'banned';
  email_verified: boolean;
  onboarding_complete: boolean;
  is_admin: boolean;
  is_creator: boolean;
  can_host: boolean;
  has_seen_tutorial: boolean;
  preferred_translation: string;
  verse_mode: 'daily_verse' | 'verse_by_category';
  verse_category_id: number | null;
  language: string;
  timezone: string;
}

export interface AuthContextValue {
  user: UserData | null;
  loading: boolean;
  isAuthenticated: boolean;
  /** Auth token for Socket.IO (persisted in sessionStorage across AuthProvider boundaries) */
  authToken: string | null;
  login: (userData: UserData, token?: string) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    // Restore token from sessionStorage (survives navigation between
    // login page AuthProvider and app layout AuthProvider)
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(TOKEN_KEY);
    }
    return null;
  });

  // Guard: prevent fetchUser from clearing state set by a recent login() call
  const loginTimestampRef = useRef(0);

  const fetchUser = useCallback(async () => {
    const fetchStarted = Date.now();
    try {
      // Primary: try cookie-based auth
      const headers: Record<string, string> = {};
      const storedToken = sessionStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        // Always refresh the token from the server response
        if (data.token) {
          setAuthToken(data.token);
          sessionStorage.setItem(TOKEN_KEY, data.token);
        }
        return;
      }

      // Handle banned / inactive user: 403
      if (res.status === 403) {
        try {
          const data = await res.json();
          if (data.error === 'Account suspended') {
            const params = new URLSearchParams();
            if (data.reason) params.set('reason', data.reason);
            if (data.expires_at) params.set('expires', data.expires_at);
            window.location.href = `/banned?${params.toString()}`;
            return;
          }
          if (data.error === 'Account inactive') {
            // pending_deletion — clear session
            setUser(null);
            setAuthToken(null);
            sessionStorage.removeItem(TOKEN_KEY);
            setLoading(false);
            return;
          }
        } catch {
          // JSON parse failed, fall through to normal clear
        }
      }

      // Both failed — only clear if no login() happened while we were fetching
      if (fetchStarted > loginTimestampRef.current) {
        setUser(null);
        setAuthToken(null);
        sessionStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      if (fetchStarted > loginTimestampRef.current) {
        setUser(null);
        setAuthToken(null);
        sessionStorage.removeItem(TOKEN_KEY);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback((userData: UserData, token?: string) => {
    loginTimestampRef.current = Date.now();
    setUser(userData);
    if (token) {
      setAuthToken(token);
      sessionStorage.setItem(TOKEN_KEY, token);
    }
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
    setAuthToken(null);
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.href = '/bible';
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const isAuthenticated = user !== null;

  return (
    <AuthContext.Provider
      value={{ user, loading, isAuthenticated, authToken, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
