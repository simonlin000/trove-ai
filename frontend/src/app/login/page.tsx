'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Loader2, AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, loading: authLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch for theme-dependent styles
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError('请输入用户名和密码');
      return;
    }

    setSubmitting(true);
    try {
      await login(trimmedUsername, password);
      router.replace('/');
    } catch (err: any) {
      setError(err.message || '登录失败，请检查用户名和密码');
    } finally {
      setSubmitting(false);
    }
  };

  // Show nothing while checking auth on mount (avoids flash)
  if (!mounted || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 size={32} className="text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  // If already authenticated, show nothing while redirecting
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      {/* ─── Login Card ──────────────────────────────────────────────── */}
      <div className="w-full max-w-md">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#007aff] to-[#5856d6] mb-4 shadow-lg shadow-[#007aff]/25">
            <BookOpen size={32} color="white" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Trove AI
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            连接碎片知识，构建思维体系
          </p>
        </div>

        {/* Card */}
        <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-color)] shadow-sm p-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6 text-center">
            登录
          </h2>

          {/* Error Message */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-[var(--danger-light)] text-[var(--danger)] text-sm flex items-start gap-2.5 animate-fade-in">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-[var(--text-primary)] mb-2"
              >
                用户名
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                placeholder="输入用户名"
                autoComplete="username"
                autoFocus
                className="w-full h-12 px-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--text-primary)] mb-2"
              >
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="输入密码"
                  autoComplete="current-password"
                  className="w-full h-12 px-4 pr-12 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !username.trim() || !password}
              className="w-full h-12 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-[var(--accent)]/20"
            >
              {submitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  登录
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[var(--text-tertiary)] mt-6">
          Trove AI · AI 驱动的知识库
        </p>
      </div>
    </div>
  );
}
