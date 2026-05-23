'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, UserPlus, Search, Loader2, Trash2,
  Key, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight,
  Shield, ShieldCheck, CheckCircle2, AlertCircle, X, Eye,
} from 'lucide-react';
import { api } from '@/lib/api';

interface User {
  id: string;
  username: string;
  is_super_admin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UserListResponse {
  items: User[];
  total: number;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  // Change password modal
  const [changePwUser, setChangePwUser] = useState<User | null>(null);
  const [newPwValue, setNewPwValue] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle loading
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const showMessage = (text: string, ok: boolean) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers(page, pageSize, search || undefined);
      setUsers(data.items);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message || '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Create user
  const handleCreate = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    setCreating(true);
    try {
      await api.createUser(newUsername.trim(), newPassword);
      showMessage('用户创建成功', true);
      setShowCreateModal(false);
      setNewUsername('');
      setNewPassword('');
      fetchUsers();
    } catch (e: any) {
      showMessage(e.message || '创建失败', false);
    } finally {
      setCreating(false);
    }
  };

  // Toggle active/inactive
  const handleToggleActive = async (user: User) => {
    setTogglingIds(prev => new Set(prev).add(user.id));
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      showMessage(
        user.is_active ? '用户已禁用' : '用户已启用',
        true,
      );
      fetchUsers();
    } catch (e: any) {
      showMessage(e.message || '操作失败', false);
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (!changePwUser || !newPwValue.trim()) return;
    setChangingPw(true);
    try {
      await api.updateUser(changePwUser.id, { password: newPwValue });
      showMessage('密码修改成功', true);
      setChangePwUser(null);
      setNewPwValue('');
    } catch (e: any) {
      showMessage(e.message || '修改失败', false);
    } finally {
      setChangingPw(false);
    }
  };

  // Delete user
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.deleteUser(deleteConfirm.id);
      showMessage('用户已删除', true);
      setDeleteConfirm(null);
      fetchUsers();
    } catch (e: any) {
      showMessage(e.message || '删除失败', false);
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">用户管理</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          管理系统用户账号、权限与状态
        </p>
      </div>

      {/* Global message */}
      {message && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
            message.ok
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {message.ok ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {message.text}
        </div>
      )}

      {/* Users card */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] overflow-hidden">
        {/* Card header */}
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-3">
          <Users className="w-5 h-5 text-[var(--text-tertiary)]" />
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">所有用户</h2>
            <p className="text-xs text-[var(--text-tertiary)]">
              共 {total} 个用户
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateModal(true);
              setNewUsername('');
              setNewPassword('');
            }}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            创建用户
          </button>
        </div>

        {/* Search bar */}
        <div className="px-6 py-3 border-b border-[var(--border-color)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="搜索用户名..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 placeholder:text-[var(--text-tertiary)]"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-[var(--text-tertiary)] text-sm">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            正在加载用户列表...
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="p-3 mx-6 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-tertiary)] text-sm">
            {search ? '没有匹配的用户' : '暂无用户'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                      用户名
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                      角色
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                      状态
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                      创建时间
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr
                      key={user.id}
                      className="border-b border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      {/* Username */}
                      <td className="px-6 py-3">
                        <span className="font-medium text-[var(--text-primary)]">
                          {user.username}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-3">
                        {user.is_super_admin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent-light)] text-[var(--accent)]">
                            <ShieldCheck className="w-3 h-3" />
                            超级管理员
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                            <Shield className="w-3 h-3" />
                            普通用户
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-3">
                        <button
                          onClick={() => handleToggleActive(user)}
                          disabled={togglingIds.has(user.id)}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
                            user.is_active
                              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                          }`}
                          title={user.is_active ? '点击禁用' : '点击启用'}
                        >
                          {togglingIds.has(user.id) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : user.is_active ? (
                            <ToggleRight className="w-3 h-3" />
                          ) : (
                            <ToggleLeft className="w-3 h-3" />
                          )}
                          {user.is_active ? '启用' : '禁用'}
                        </button>
                      </td>

                      {/* Created */}
                      <td className="px-6 py-3 text-[var(--text-secondary)] text-xs font-mono">
                        {formatDate(user.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => {
                              setChangePwUser(user);
                              setNewPwValue('');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            title="修改密码"
                          >
                            <Key className="w-3.5 h-3.5" />
                            密码
                          </button>
                          <button
                            onClick={() => router.push(`/?username=${encodeURIComponent(user.username)}`)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                            title="查看该用户数据"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            查看数据
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(user)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                            title="删除用户"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-[var(--border-color)] flex items-center justify-between">
                <span className="text-xs text-[var(--text-tertiary)]">
                  第 {page} 页 / 共 {totalPages} 页（{total} 条）
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    上一页
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    下一页
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Create User Modal ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!creating) {
                setShowCreateModal(false);
                setNewUsername('');
                setNewPassword('');
              }
            }}
          />
          {/* Modal */}
          <div className="relative bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] shadow-lg w-full max-w-md mx-4 p-6 space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <UserPlus className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                创建新用户
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUsername('');
                  setNewPassword('');
                }}
                disabled={creating}
                className="ml-auto p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  用户名
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') {
                      setShowCreateModal(false);
                      setNewUsername('');
                      setNewPassword('');
                    }
                  }}
                  placeholder="输入用户名..."
                  autoFocus
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 placeholder:text-[var(--text-tertiary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  密码
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') {
                      setShowCreateModal(false);
                      setNewUsername('');
                      setNewPassword('');
                    }
                  }}
                  placeholder="输入密码..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 placeholder:text-[var(--text-tertiary)]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={creating || !newUsername.trim() || !newPassword.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                创建
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUsername('');
                  setNewPassword('');
                }}
                disabled={creating}
                className="px-4 py-2 text-sm rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Change Password Modal ─── */}
      {changePwUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!changingPw) {
                setChangePwUser(null);
                setNewPwValue('');
              }
            }}
          />
          <div className="relative bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] shadow-lg w-full max-w-md mx-4 p-6 space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                修改密码
              </h3>
              <button
                onClick={() => {
                  setChangePwUser(null);
                  setNewPwValue('');
                }}
                disabled={changingPw}
                className="ml-auto p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[var(--text-secondary)]">
              为用户 <span className="font-semibold text-[var(--text-primary)]">{changePwUser.username}</span> 设置新密码
            </p>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                新密码
              </label>
              <input
                type="password"
                value={newPwValue}
                onChange={e => setNewPwValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleChangePassword();
                  if (e.key === 'Escape') {
                    setChangePwUser(null);
                    setNewPwValue('');
                  }
                }}
                placeholder="输入新密码..."
                autoFocus
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 placeholder:text-[var(--text-tertiary)]"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleChangePassword}
                disabled={changingPw || !newPwValue.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {changingPw ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                确认修改
              </button>
              <button
                onClick={() => {
                  setChangePwUser(null);
                  setNewPwValue('');
                }}
                disabled={changingPw}
                className="px-4 py-2 text-sm rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!deleting) setDeleteConfirm(null);
            }}
          />
          <div className="relative bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] shadow-lg w-full max-w-md mx-4 p-6 space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  确认删除用户
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                  此操作无法撤销
                </p>
              </div>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="ml-auto p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[var(--text-secondary)]">
              确定要删除用户 <span className="font-semibold text-[var(--text-primary)]">{deleteConfirm.username}</span> 吗？该用户的所有数据将无法恢复。
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                确认删除
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-[var(--text-tertiary)] py-4">
        Trove AI v1.2
      </div>
    </div>
  );
}
