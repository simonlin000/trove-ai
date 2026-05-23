'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  FileText,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { SparkResponse } from '@/lib/types';

// ─── Pipeline Step ──────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { key: 'topic_expansion', label: '主题展开', icon: Lightbulb },
  { key: 'outline', label: '大纲生成', icon: FileText },
  { key: 'chapters', label: '章节撰写', icon: FileText },
  { key: 'polish', label: '文章润色', icon: Sparkles },
];

interface PipelineVisualizerProps {
  stepsCompleted: string[];
  isGenerating: boolean;
}

function PipelineVisualizer({ stepsCompleted, isGenerating }: PipelineVisualizerProps) {
  return (
    <div className="space-y-3">
      {PIPELINE_STEPS.map((step, idx) => {
        const isDone = stepsCompleted.includes(step.key);
        const isActive = isGenerating && !isDone && (idx === 0 || stepsCompleted.includes(PIPELINE_STEPS[idx - 1].key));

        return (
          <div
            key={step.key}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-300 ${
              isDone
                ? 'border-[var(--success)] bg-[var(--success-light)]'
                : isActive
                ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                : 'border-[var(--border-color)] bg-[var(--bg-secondary)]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                isDone
                  ? 'bg-[var(--success)] text-white'
                  : isActive
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
              }`}
            >
              {isDone ? (
                <CheckCircle2 size={18} />
              ) : isActive ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <step.icon size={18} />
              )}
            </div>
            <div className="flex-1">
              <span
                className={`text-sm font-medium ${
                  isDone
                    ? 'text-[var(--success)]'
                    : isActive
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-tertiary)]'
                }`}
              >
                第{idx + 1}步：{step.label}
              </span>
            </div>
            {isDone && <CheckCircle2 size={18} className="text-[var(--success)]" />}
            {isActive && <Loader2 size={18} className="text-[var(--accent)] animate-spin" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Toast ──────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastIdCounter = 0;

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SparkPage() {
  const [sentence, setSentence] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<SparkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = sentence.trim();
    if (!trimmed) return;

    setIsGenerating(true);
    setResult(null);
    setError(null);

    try {
      const data = (await api.sparkArticle(trimmed)) as SparkResponse;
      setResult(data);
      addToast('文章生成成功！', 'success');
    } catch (err: any) {
      setError(err.message || '生成失败，请稍后重试');
      addToast(err.message || '生成失败，请稍后重试', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const contentPreview = result?.content
    ? result.content.slice(0, 300) + (result.content.length > 300 ? '...' : '')
    : '';

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* ─── Toast Container ──────────────────────────────────────────── */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fade-in px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2.5 ${
              t.type === 'success'
                ? 'bg-[var(--success)] text-white'
                : 'bg-[var(--danger)] text-white'
            }`}
          >
            {t.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {t.message}
          </div>
        ))}
      </div>

      {/* ─── Hero Section ─────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="bg-[var(--bg-primary)] rounded-2xl p-8 border border-[var(--border-color)] shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007aff] to-[#5856d6] flex items-center justify-center">
              <Sparkles size={20} color="white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              灵感创作
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-base ml-[52px]">
            一个概念，一篇文章 — 将碎片灵感转化为完整知识
          </p>
        </div>
      </section>

      {/* ─── Input Section ────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="bg-[var(--bg-primary)] rounded-2xl p-6 md:p-8 border border-[var(--border-color)] shadow-sm">
          <form onSubmit={handleGenerate}>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">
              写下你的一句话灵感
            </label>
            <textarea
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              placeholder="例如：量子计算如何改变密码学... 或：对比东西方哲学中的'道'与'逻各斯'..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder-[#aeaeb2] text-[15px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all duration-200 resize-none"
              disabled={isGenerating}
            />
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-[var(--text-tertiary)]">
                输入一个概念或想法，AI 将为你展开一篇完整的知识文章
              </p>
              <button
                type="submit"
                disabled={isGenerating || !sentence.trim()}
                className="h-11 px-6 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm flex items-center gap-2 hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
              >
                {isGenerating ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Sparkles size={18} />
                )}
                生成文章
              </button>
            </div>
          </form>

          {/* Error */}
          {error && !isGenerating && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-[var(--danger-light)] text-[var(--danger)] text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>
      </section>

      {/* ─── Pipeline & Result ────────────────────────────────────────── */}
      {(isGenerating || result) && (
        <section className="mb-8">
          <div className="bg-[var(--bg-primary)] rounded-2xl p-6 md:p-8 border border-[var(--border-color)] shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-5 flex items-center gap-2">
              {isGenerating ? (
                <>
                  <Sparkles size={20} className="text-[var(--accent)]" />
                  正在生成文章...
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} className="text-[var(--success)]" />
                  生成完成
                </>
              )}
            </h2>

            <PipelineVisualizer
              stepsCompleted={result?.steps_completed ?? []}
              isGenerating={isGenerating}
            />

            {/* Result Card */}
            {result && (
              <div className="mt-6 p-5 rounded-xl border border-[var(--success)] bg-[var(--success-light)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1 truncate">
                      {result.title}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-2">
                      共 {result.sections?.length ?? 0} 个章节 · {result.content?.length ?? 0} 字
                    </p>
                    <div className="text-sm text-[var(--text-tertiary)] leading-relaxed line-clamp-4 bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border-color)]">
                      {contentPreview}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/read/${result.id}`}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
                >
                  查看文章
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── Tips ──────────────────────────────────────────────────────── */}
      {!isGenerating && !result && (
        <section>
          <div className="bg-[var(--bg-primary)] rounded-2xl p-6 border border-[var(--border-color)] shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              💡 灵感创作小贴士
            </h3>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">•</span>
                输入一个具体概念，例如「可控核聚变的技术挑战」比简单的「核聚变」效果更好
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">•</span>
                可以尝试对比性灵感，如「传统数据库与向量数据库的设计哲学对比」
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">•</span>
                从你的知识库中寻找灵感 —— 看看最近阅读的文章，有哪些想深入探索的主题
              </li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
