'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Calendar, Bell, X, AlertCircle, Eye } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Schedule = Awaited<ReturnType<typeof api.getReviewSchedule>>;

const FREQ_PRESETS = [
  { value: 1, label: '每日' },
  { value: 7, label: '每周' },
  { value: 30, label: '每月' },
];

export default function ReviewSettings() {
  const [sched, setSched] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState<string>('');
  const [previewCites, setPreviewCites] = useState<{ idx: number; id: string; title: string }[]>([]);
  const [previewMsg, setPreviewMsg] = useState<string>('');
  const [toast, setToast] = useState<string>('');

  // Local form state
  const [enabled, setEnabled] = useState(false);
  const [freqDays, setFreqDays] = useState(7);
  const [customFreq, setCustomFreq] = useState<string>('');
  const [timeOfDay, setTimeOfDay] = useState('09:00');

  const refresh = useCallback(async () => {
    try {
      const data = await api.getReviewSchedule();
      setSched(data);
      setEnabled(data.enabled);
      setFreqDays(data.frequency_days);
      if (![1, 7, 30].includes(data.frequency_days)) {
        setCustomFreq(String(data.frequency_days));
      }
      setTimeOfDay(data.time_of_day);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isPreset = [1, 7, 30].includes(freqDays);
  const effectiveFreq = isPreset
    ? freqDays
    : Math.max(1, Math.min(90, parseInt(customFreq, 10) || 7));

  const handleSave = async () => {
    setSaving(true);
    setToast('');
    try {
      const data = await api.updateReviewSchedule({
        enabled,
        frequency_days: effectiveFreq,
        time_of_day: timeOfDay,
      });
      setSched(data as Schedule);
      setToast(enabled ? '已启用周期回顾' : '已保存');
      setTimeout(() => setToast(''), 2500);
    } catch (e: any) {
      setToast(`保存失败: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewOpen(true);
    setPreviewText('');
    setPreviewCites([]);
    setPreviewMsg('');
    try {
      const r = await api.previewReview();
      setPreviewText(r.text || '');
      setPreviewCites(r.citations || []);
      setPreviewMsg(r.message || '');
    } catch (e: any) {
      setPreviewMsg(`生成失败: ${e.message || e}`);
    } finally {
      setPreviewing(false);
    }
  };

  // Render text with [[N]] tokens replaced by clickable links to the article.
  const renderTextWithLinks = (
    text: string,
    citations: { idx: number; id: string; title: string }[],
  ): React.ReactNode[] => {
    const idxToCite = new Map(citations.map((c) => [c.idx, c]));
    const re = /\[\[(\d+)\]\]/g;
    const out: React.ReactNode[] = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIdx) {
        out.push(text.substring(lastIdx, m.index));
      }
      const cite = idxToCite.get(parseInt(m[1], 10));
      if (cite) {
        out.push(
          <Link
            key={`cite-${key++}`}
            href={`/read/${cite.id}`}
            className="text-[var(--accent)] hover:underline font-medium"
            onClick={() => setPreviewOpen(false)}
          >
            《{cite.title}》
          </Link>,
        );
      } else {
        out.push(m[0]);
      }
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) {
      out.push(text.substring(lastIdx));
    }
    return out;
  };

  const fmtTime = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { hour12: false });
  };

  return (
    <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-[var(--accent)]" />
          <h2 className="font-semibold text-[var(--foreground)]">周期回顾</h2>
        </div>
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        定期把你最近收藏的内容做成知识回顾，推送到你的微信。解决"收藏即遗忘"。
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <Loader2 size={14} className="animate-spin" /> 加载中…
        </div>
      ) : (
        <>
          {!sched?.has_wechat_binding && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 flex items-start gap-2 text-xs">
              <AlertCircle size={14} className="text-yellow-600 mt-0.5 shrink-0" />
              <span className="text-yellow-800 dark:text-yellow-200">
                推送渠道是微信 bot——请先在上方「微信 bot」里绑定后再启用周期回顾。
              </span>
            </div>
          )}

          {/* Enable toggle */}
          <label className="flex items-center justify-between mb-4 cursor-pointer">
            <span className="text-sm text-[var(--foreground)]">启用周期回顾</span>
            <span
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-block w-10 h-6 rounded-full transition-colors ${
                enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border-color)]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  enabled ? 'translate-x-4' : ''
                }`}
              />
            </span>
          </label>

          {/* Config (only enabled when toggle on) */}
          <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>
            <div className="mb-3">
              <label className="block text-xs text-[var(--text-tertiary)] mb-1">频率</label>
              <div className="flex flex-wrap gap-2">
                {FREQ_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setFreqDays(p.value)}
                    className={`px-3 py-1.5 text-sm rounded-lg border ${
                      freqDays === p.value
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const f = parseInt(customFreq, 10) || 14;
                      setFreqDays(f);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg border ${
                      !isPreset
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]'
                    }`}
                  >
                    自定义
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={customFreq}
                    onChange={(e) => {
                      setCustomFreq(e.target.value);
                      const n = parseInt(e.target.value, 10);
                      if (!isNaN(n) && n >= 1 && n <= 90) setFreqDays(n);
                    }}
                    placeholder="14"
                    className="w-16 px-2 py-1.5 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  />
                  <span className="text-xs text-[var(--text-tertiary)]">天</span>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs text-[var(--text-tertiary)] mb-1">推送时间（上海）</label>
              <input
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
              />
            </div>

            {sched?.enabled && (
              <div className="mb-4 text-xs text-[var(--text-tertiary)] space-y-0.5">
                <div>下次推送: {fmtTime(sched.next_send_at)}</div>
                <div>上次推送: {fmtTime(sched.last_sent_at)}</div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              onClick={handlePreview}
              disabled={previewing}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
            >
              <Eye size={14} /> {previewing ? '生成中…' : '立即预览'}
            </button>
            {toast && <span className="text-xs text-[var(--text-secondary)]">{toast}</span>}
          </div>
        </>
      )}

      {/* Preview modal */}
      {previewOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !previewing && setPreviewOpen(false)}
        >
          <div
            className="bg-[var(--bg-primary)] rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--foreground)]">回顾预览</h3>
              <button
                onClick={() => setPreviewOpen(false)}
                disabled={previewing}
                className="text-[var(--text-tertiary)] hover:text-[var(--foreground)]"
              >
                <X size={18} />
              </button>
            </div>
            {previewing ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 size={28} className="animate-spin text-[var(--accent)] mb-2" />
                <p className="text-sm text-[var(--text-tertiary)]">LLM 正在写回顾…</p>
              </div>
            ) : previewMsg ? (
              <div className="text-center py-8 text-sm text-[var(--text-secondary)]">{previewMsg}</div>
            ) : (
              <div className="whitespace-pre-wrap text-sm text-[var(--text-primary)] leading-relaxed">
                {previewText
                  ? renderTextWithLinks(previewText, previewCites)
                  : '（无内容）'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
