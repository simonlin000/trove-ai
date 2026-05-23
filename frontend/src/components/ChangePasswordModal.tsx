'use client';

import React, { useState, useCallback } from 'react';
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// ─── Props ────────────────────────────────────────────────────────────────

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const { token } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Reset state when modal opens/closes ──────────────────────────────

  const resetForm = useCallback(() => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowOld(false);
    setShowNew(false);
    setShowConfirm(false);
    setError(null);
    setSuccess(false);
  }, []);

  // Reset when modal opens
  React.useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  // ── Submit ───────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (!oldPassword) {
      setError('请输入当前密码');
      return;
    }
    if (!newPassword) {
      setError('请输入新密码');
      return;
    }
    if (newPassword.length < 6) {
      setError('新密码至少需要6个字符');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (oldPassword === newPassword) {
      setError('新密码不能与当前密码相同');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || localStorage.getItem('trove_token') || ''}`,
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: '修改密码失败' }));
        throw new Error(errData.detail || '修改密码失败');
      }

      setSuccess(true);
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || '修改密码失败，请检查当前密码是否正确');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-color)] shadow-xl w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-light)] flex items-center justify-center">
              <KeyRound size={18} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              修改密码
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Success */}
          {success && (
            <div className="flex flex-col items-center justify-center py-8 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-[var(--success-light)] flex items-center justify-center mb-4">
                <CheckCircle2 size={28} className="text-[var(--success)]" />
              </div>
              <p className="text-base font-semibold text-[var(--text-primary)] mb-1">
                密码修改成功
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                窗口即将关闭...
              </p>
            </div>
          )}

          {/* Form (hidden when success) */}
          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error */}
              {error && (
                <div className="px-4 py-3 rounded-xl bg-[var(--danger-light)] text-[var(--danger)] text-sm flex items-start gap-2.5 animate-fade-in">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Old Password */}
              <PasswordField
                id="old_password"
                label="当前密码"
                value={oldPassword}
                onChange={(v) => { setOldPassword(v); setError(null); }}
                show={showOld}
                onToggle={() => setShowOld(!showOld)}
                placeholder="输入当前密码"
                disabled={loading}
                autoFocus
              />

              {/* New Password */}
              <PasswordField
                id="new_password"
                label="新密码"
                value={newPassword}
                onChange={(v) => { setNewPassword(v); setError(null); }}
                show={showNew}
                onToggle={() => setShowNew(!showNew)}
                placeholder="输入新密码（至少6个字符）"
                disabled={loading}
              />

              {/* Confirm Password */}
              <PasswordField
                id="confirm_password"
                label="确认新密码"
                value={confirmPassword}
                onChange={(v) => { setConfirmPassword(v); setError(null); }}
                show={showConfirm}
                onToggle={() => setShowConfirm(!showConfirm)}
                placeholder="再次输入新密码"
                disabled={loading}
                matchStatus={
                  confirmPassword
                    ? confirmPassword === newPassword
                      ? 'match'
                      : 'mismatch'
                    : null
                }
              />

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 h-11 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] font-medium text-sm hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-30"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={
                    loading ||
                    !oldPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                  className="flex-1 h-11 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      确认修改
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Password Field Sub-component ─────────────────────────────────────────

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  matchStatus?: 'match' | 'mismatch' | null;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  disabled,
  autoFocus,
  matchStatus,
}: PasswordFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--text-primary)] mb-2"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          className={`w-full h-12 px-4 pr-12 rounded-xl border bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all disabled:opacity-40 ${
            matchStatus === 'match'
              ? 'border-[var(--success)] focus:border-[var(--success)]'
              : matchStatus === 'mismatch'
              ? 'border-[var(--danger)] focus:border-[var(--danger)]'
              : 'border-[var(--border-color)] focus:border-[var(--accent)]'
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {matchStatus === 'match' && (
            <CheckCircle2 size={16} className="text-[var(--success)]" />
          )}
          {matchStatus === 'mismatch' && (
            <AlertCircle size={16} className="text-[var(--danger)]" />
          )}
          <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-30"
            tabIndex={-1}
            aria-label={show ? '隐藏密码' : '显示密码'}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {matchStatus === 'mismatch' && (
        <p className="text-xs text-[var(--danger)] mt-1.5 ml-1">
          两次输入的新密码不一致
        </p>
      )}
    </div>
  );
}