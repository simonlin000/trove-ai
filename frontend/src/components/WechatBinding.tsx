'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, X, QrCode, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

type Account = Awaited<ReturnType<typeof api.wechatGetAccount>>;

export default function WechatBinding() {
  const [account, setAccount] = useState<Account>(null);
  const [loading, setLoading] = useState(true);
  const [unbinding, setUnbinding] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [qrSrc, setQrSrc] = useState<string>('');
  const [session, setSession] = useState<string>('');
  const [bindStatus, setBindStatus] = useState<string>('');
  const [bindError, setBindError] = useState<string>('');
  const pollRef = useRef<boolean>(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api.wechatGetAccount();
      setAccount(data);
    } catch (e: any) {
      // 401/403 are expected for unauth — surface other errors only
      console.error('wechatGetAccount failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startBind = useCallback(async () => {
    setBindError('');
    setBindStatus('wait');
    setModalOpen(true);
    try {
      const r = await api.wechatBindStart();
      setSession(r.session);
      // qr_image_content may be a URL or a base64 data URL — accept both.
      setQrSrc(r.qr_image_content);
    } catch (e: any) {
      setBindError(e.message || '生成二维码失败');
      setBindStatus('error');
    }
  }, []);

  // Long-poll while modal is open and we have a session
  useEffect(() => {
    if (!modalOpen || !session || bindStatus === 'confirmed' || bindStatus === 'error' || bindStatus === 'expired') return;
    if (pollRef.current) return;
    pollRef.current = true;
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          const r = await api.wechatBindStatus(session);
          if (cancelled) break;
          if (r.session) setSession(r.session);
          setBindStatus(r.status);
          if (r.status === 'confirmed') {
            setBindError('');
            refresh();
            break;
          }
          if (r.status === 'expired') {
            setBindError(r.message || '二维码已失效');
            break;
          }
          if (r.status === 'error') {
            setBindError(r.message || '网络错误');
            break;
          }
        } catch (e: any) {
          if (cancelled) break;
          setBindError(e.message || '轮询失败');
          setBindStatus('error');
          break;
        }
      }
      pollRef.current = false;
    })();
    return () => {
      cancelled = true;
      pollRef.current = false;
    };
  }, [modalOpen, session, bindStatus, refresh]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSession('');
    setQrSrc('');
    setBindStatus('');
    setBindError('');
  }, []);

  const unbind = useCallback(async () => {
    if (!confirm('确定要解绑微信吗？解绑后 bot 不再处理该微信账号的消息。')) return;
    setUnbinding(true);
    try {
      await api.wechatUnbind();
      await refresh();
    } catch (e: any) {
      alert(e.message || '解绑失败');
    } finally {
      setUnbinding(false);
    }
  }, [refresh]);

  // Format helpers
  const formatLastSeen = (iso?: string) => {
    if (!iso) return '从未活跃';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    return d.toLocaleString('zh-CN');
  };

  // ── Render ──
  return (
    <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-[var(--accent)]" />
          <h2 className="font-semibold text-[var(--foreground)]">微信 bot</h2>
        </div>
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        绑定个人微信后，发链接给 bot 自动入库；发问题走 RAG 检索你自己的知识库。
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <Loader2 size={14} className="animate-spin" />
          加载状态…
        </div>
      ) : account && account.is_active ? (
        <div className="border border-[var(--border-color)] rounded-lg p-4 bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-[#34c759]" />
            <span className="font-medium text-[var(--foreground)]">已绑定</span>
          </div>
          <div className="text-xs text-[var(--text-tertiary)] space-y-0.5 ml-6 mb-3">
            <div>微信用户：{account.display_name || account.wechat_user_id || '（未获取昵称）'}</div>
            <div>账号 ID：<code className="text-[10px]">{account.account_id}</code></div>
            <div>最近活跃：{formatLastSeen(account.last_seen_at)}</div>
          </div>
          <button
            onClick={unbind}
            disabled={unbinding}
            className="text-sm px-3 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
          >
            {unbinding ? '解绑中…' : '解绑'}
          </button>
        </div>
      ) : (
        <button
          onClick={startBind}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
        >
          <QrCode size={14} />
          绑定微信
        </button>
      )}

      {/* QR Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-[var(--bg-primary)] rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--foreground)]">扫码绑定微信</h3>
              <button onClick={closeModal} className="text-[var(--text-tertiary)] hover:text-[var(--foreground)]">
                <X size={18} />
              </button>
            </div>

            {bindError ? (
              <div className="text-center py-8">
                <AlertCircle size={36} className="mx-auto text-[#ef4444] mb-3" />
                <p className="text-sm text-[var(--foreground)] mb-1">{bindError}</p>
                <button
                  onClick={startBind}
                  className="mt-4 text-sm px-4 py-2 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                >
                  重试
                </button>
              </div>
            ) : bindStatus === 'confirmed' ? (
              <div className="text-center py-8">
                <CheckCircle2 size={48} className="mx-auto text-[#34c759] mb-3" />
                <p className="font-medium text-[var(--foreground)] mb-1">绑定成功！</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  现在可以在微信里发链接或问题给 bot。
                </p>
                <button
                  onClick={closeModal}
                  className="mt-4 text-sm px-4 py-2 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                >
                  完成
                </button>
              </div>
            ) : (
              <>
                {qrSrc ? (
                  <div className="flex flex-col items-center">
                    <div className="bg-white p-3 rounded-lg">
                      <img src={qrSrc} alt="WeChat QR" className="w-56 h-56 object-contain" />
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mt-4 text-center">
                      {bindStatus === 'scaned' || bindStatus === 'need_verifycode' ? (
                        <span className="text-[var(--accent)]">已扫描，请在手机微信里确认…</span>
                      ) : (
                        '用手机微信扫一扫上方二维码'
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-2 text-center">
                      二维码 5 分钟内有效
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8">
                    <Loader2 size={32} className="animate-spin text-[var(--accent)] mb-3" />
                    <p className="text-sm text-[var(--text-tertiary)]">生成二维码中…</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
