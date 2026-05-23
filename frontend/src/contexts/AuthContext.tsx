'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, LoginResponse } from '@/lib/types';

// ─── Types ─────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const TOKEN_KEY = 'trove_token';

// ─── Context ───────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  isAuthenticated: false,
  isSuperAdmin: false,
  login: async () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Provider ──────────────────────────────────────────────────────────────

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Validate token on mount ──────────────────────────────────────────

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setLoading(false);
      return;
    }

    // Validate token by fetching current user (direct URL to bypass Next.js proxy)
    fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${storedToken}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          // Token invalid or expired — clear it
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
          return;
        }
        const data: User = await res.json();
        setToken(storedToken);
        setUser(data);
      })
      .catch(() => {
        // Network error — keep token but set user to null
        // (they can retry by reloading or logging in again)
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // ── Login ────────────────────────────────────────────────────────────

  const login = useCallback(async (username: string, password: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: '登录失败' }));
        throw new Error(errData.detail || '登录失败');
      }

      const data: LoginResponse = await res.json();
      localStorage.setItem(TOKEN_KEY, data.access_token);
      setToken(data.access_token);
      setUser(data.user);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('请求超时，请检查网络连接或稍后重试');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // ── Derived state ────────────────────────────────────────────────────

  const isAuthenticated = !!token && !!user;
  const isSuperAdmin = user?.is_super_admin ?? false;

  // ── Value ────────────────────────────────────────────────────────────

  const value: AuthContextType = {
    user,
    token,
    loading,
    isAuthenticated,
    isSuperAdmin,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
