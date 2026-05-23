'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    // Don't redirect on the login page itself
    if (!isAuthenticated && pathname !== '/login') {
      router.replace('/login');
    }
    // If already logged in and on login page, redirect to home
    if (isAuthenticated && pathname === '/login') {
      router.replace('/');
    }
  }, [isAuthenticated, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#007aff] to-[#5856d6] animate-pulse" />
          <span className="text-sm text-[var(--text-tertiary)]">加载中...</span>
        </div>
      </div>
    );
  }

  // On login page, always render (login page handles its own redirect)
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Not authenticated and not on login page — don't render (redirect in effect)
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
