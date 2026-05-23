'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Zap,
  BookOpen,
  TrendingUp,
  Clock,
  Star,
  GitGraph,
  Route,
  Upload,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Article, Stats } from '@/lib/types';
import ArticleCard from '@/components/ArticleCard';
import AddContentModal from '@/components/AddContentModal';

// ─── Toast ───────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastIdCounter = 0;

// ─── Skeleton / Loading ─────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="bg-[var(--bg-primary)] rounded-2xl p-5 border border-[var(--border-color)] loading-pulse">
      <div className="h-4 w-16 bg-[var(--bg-tertiary)] rounded mb-3" />
      <div className="h-8 w-12 bg-[var(--bg-tertiary)] rounded" />
    </div>
  );
}

function ArticleCardSkeleton() {
  return (
    <div className="bg-[var(--bg-primary)] rounded-xl p-5 border border-[var(--border-color)] loading-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="h-5 bg-[var(--bg-tertiary)] rounded w-3/4" />
        <div className="h-4 w-4 bg-[var(--bg-tertiary)] rounded" />
      </div>
      <div className="h-4 bg-[var(--bg-tertiary)] rounded w-full mb-2" />
      <div className="h-4 bg-[var(--bg-tertiary)] rounded w-2/3 mb-3" />
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-12 bg-[var(--bg-tertiary)] rounded-full" />
        <div className="h-5 w-16 bg-[var(--bg-tertiary)] rounded-full" />
      </div>
      <div className="flex gap-4">
        <div className="h-3 w-14 bg-[var(--bg-tertiary)] rounded" />
        <div className="h-3 w-12 bg-[var(--bg-tertiary)] rounded" />
      </div>
    </div>
  );
}

// ─── Stat Icon Map ──────────────────────────────────────────────────────────

const statIconMap: Record<string, React.ReactNode> = {
  total_articles: <BookOpen size={20} />,
  unread: <Clock size={20} />,
  completed: <CheckCircle2 size={20} />,
  favorites: <Star size={20} />,
  total_tags: <Zap size={20} />,
};

const statLabelMap: Record<string, string> = {
  total_articles: '总文章',
  unread: '未读',
  completed: '已读完',
  favorites: '收藏',
  total_tags: '标签',
};

const statColorMap: Record<string, string> = {
  total_articles: 'text-[var(--accent)] bg-[var(--accent-light)]',
  unread: 'text-[var(--warning)] bg-[var(--warning-light)]',
  completed: 'text-[var(--success)] bg-[var(--success-light)]',
  favorites: 'text-[var(--danger)] bg-[var(--danger-light)]',
  total_tags: 'text-[var(--purple)] bg-[var(--purple-light)]',
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function HomePage() {
  // State
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [articlesError, setArticlesError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const viewUsername = searchParams.get('username') || '';

  const statRouteMap: Record<string, string> = {
    total_articles: '/library',
    unread: '/library?status=unread',
    completed: '/library?status=completed',
    favorites: '/library?status=favorite',
    total_tags: '/library',
  };

  // Toast helper
  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await api.getStats(viewUsername || undefined);
      setStats(data as Stats);
    } catch (err: any) {
      setStatsError(err.message || '加载统计数据失败');
    } finally {
      setStatsLoading(false);
    }
  }, [viewUsername]);

  // Fetch recent articles
  const fetchArticles = useCallback(async () => {
    setArticlesLoading(true);
    setArticlesError(null);
    try {
      const params: any = { page: 1, page_size: 8, sort: 'created_at' };
      if (viewUsername) params.username = viewUsername;
      const data = await api.getArticles(params);
      // API returns ArticleListResponse with .items
      const list = data as any;
      setArticles(list?.items ?? (Array.isArray(data) ? data : []));
    } catch (err: any) {
      setArticlesError(err.message || '加载文章列表失败');
      setArticles([]);
    } finally {
      setArticlesLoading(false);
    }
  }, [viewUsername]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchArticles();
  }, [fetchStats, fetchArticles]);

  // Refresh on content added
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchStats(), fetchArticles()]);
  }, [fetchStats, fetchArticles]);

  // Quick action handlers
  const handleRegenerateGraph = async () => {
    setActionLoading('graph');
    try {
      await api.regenerateGraph();
      addToast('知识图谱正在重新生成...', 'success');
    } catch (err: any) {
      addToast(err.message || '图谱重新生成失败', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGeneratePath = async () => {
    setActionLoading('path');
    try {
      const topic = prompt('请输入学习路径主题：');
      if (!topic) { setActionLoading(null); return; }
      const description = prompt('请输入学习路径描述（可选）：') || undefined;
      await api.generatePath(topic, description);
      addToast('学习路径已生成！', 'success');
    } catch (err: any) {
      addToast(err.message || '学习路径生成失败', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBatchImport = async () => {
    setActionLoading('batch');
    try {
      const raw = prompt('请输入要批量导入的文章链接，每行一个：');
      if (!raw) { setActionLoading(null); return; }
      const urls = raw
        .split('\n')
        .map((u) => u.trim())
        .filter((u) => u.length > 0);
      if (urls.length === 0) {
        addToast('未检测到有效链接', 'error');
        setActionLoading(null);
        return;
      }
      await api.batchCreateArticles(urls);
      addToast(`成功导入 ${urls.length} 篇文章！`, 'success');
      await Promise.all([fetchStats(), fetchArticles()]);
    } catch (err: any) {
      addToast(err.message || '批量导入失败', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Stats to display (exclude total_edges and total_paths for dashboard cards)
  const statKeys: (keyof Stats)[] = ['total_articles', 'unread', 'completed', 'favorites', 'total_tags'];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
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
      <section className="mb-10">
        <div className="bg-[var(--bg-primary)] rounded-2xl p-8 border border-[var(--border-color)] shadow-sm">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2 tracking-tight">
              知识库仪表盘
            </h1>
            <p className="text-[var(--text-secondary)] text-base">
              将碎片化阅读转化为结构化个人知识资产。点击右下角 + 按钮添加内容，开始构建你的知识体系。
            </p>
          </div>
        </div>
      </section>

      {/* ─── Stats Overview ───────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-[var(--text-secondary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">数据概览</h2>
        </div>

        {statsError && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-[var(--danger-light)] text-[var(--danger)] text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {statsError}
            <button
              onClick={fetchStats}
              className="ml-auto text-[var(--accent)] font-medium hover:underline"
            >
              重试
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {statsLoading
            ? Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
            : statKeys.map((key) => {
                const value = stats?.[key] ?? 0;
                return (
                  <div
                    key={key}
                    onClick={() => router.push(statRouteMap[key] || '/library')}
                    className="bg-[var(--bg-primary)] rounded-2xl p-5 border border-[var(--border-color)] hover:shadow-md hover:border-[var(--accent)]/20 transition-all duration-200 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${statColorMap[key]}`}
                      >
                        {statIconMap[key]}
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-[var(--text-primary)] tracking-tight tabular-nums">
                      {value}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] mt-0.5">
                      {statLabelMap[key]}
                    </div>
                  </div>
                );
              })}
        </div>
      </section>

      {/* ─── Recent Articles ──────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-[var(--text-secondary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">最近添加</h2>
          </div>
          <button
            onClick={fetchArticles}
            className="text-sm text-[var(--accent)] font-medium hover:underline flex items-center gap-1"
          >
            刷新
          </button>
        </div>

        {articlesError && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-[var(--danger-light)] text-[var(--danger)] text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {articlesError}
            <button
              onClick={fetchArticles}
              className="ml-auto text-[var(--accent)] font-medium hover:underline"
            >
              重试
            </button>
          </div>
        )}

        {articlesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ArticleCardSkeleton key={i} />
            ))}
          </div>
        ) : articles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="bg-[var(--bg-primary)] rounded-2xl p-12 border border-[var(--border-color)] text-center">
            <BookOpen size={40} className="mx-auto text-[var(--text-tertiary)] mb-4" />
            <p className="text-[var(--text-secondary)] text-base mb-2">还没有文章</p>
            <p className="text-[var(--text-tertiary)] text-sm">
              在上方输入文章链接，开始构建你的知识库吧
            </p>
          </div>
        )}
      </section>

      {/* ─── Quick Actions ────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-[var(--text-secondary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">快捷操作</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Batch Import */}
          <button
            onClick={handleBatchImport}
            disabled={actionLoading === 'batch'}
            className="bg-[var(--bg-primary)] rounded-2xl p-6 border border-[var(--border-color)] hover:shadow-md hover:border-[var(--accent)]/20 transition-all duration-200 text-left group disabled:opacity-50"
          >
            <div className="w-11 h-11 rounded-xl bg-[var(--accent-light)] flex items-center justify-center mb-4 group-hover:bg-[var(--accent)] transition-colors">
              {actionLoading === 'batch' ? (
                <Loader2 size={22} className="text-[var(--accent)] animate-spin" />
              ) : (
                <Upload size={22} className="text-[var(--accent)] group-hover:text-white transition-colors" />
              )}
            </div>
            <h3 className="font-semibold text-[var(--text-primary)] mb-1.5">批量导入</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              一次性导入多篇文章链接，系统将自动抓取并解析内容
            </p>
            <div className="flex items-center gap-1 mt-3 text-[var(--accent)] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              开始导入 <ChevronRight size={14} />
            </div>
          </button>

          {/* Regenerate Graph */}
          <button
            onClick={handleRegenerateGraph}
            disabled={actionLoading === 'graph'}
            className="bg-[var(--bg-primary)] rounded-2xl p-6 border border-[var(--border-color)] hover:shadow-md hover:border-[var(--accent)]/20 transition-all duration-200 text-left group disabled:opacity-50"
          >
            <div className="w-11 h-11 rounded-xl bg-[var(--purple-light)] flex items-center justify-center mb-4 group-hover:bg-[var(--purple)] transition-colors">
              {actionLoading === 'graph' ? (
                <Loader2 size={22} className="text-[var(--purple)] animate-spin" />
              ) : (
                <GitGraph size={22} className="text-[var(--purple)] group-hover:text-white transition-colors" />
              )}
            </div>
            <h3 className="font-semibold text-[var(--text-primary)] mb-1.5">重新生成图谱</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              基于最新的文章数据重新构建知识关联图谱，发现知识之间的联系
            </p>
            <div className="flex items-center gap-1 mt-3 text-[var(--purple)] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              立即生成 <ChevronRight size={14} />
            </div>
          </button>

          {/* Generate Learning Path */}
          <button
            onClick={handleGeneratePath}
            disabled={actionLoading === 'path'}
            className="bg-[var(--bg-primary)] rounded-2xl p-6 border border-[var(--border-color)] hover:shadow-md hover:border-[var(--accent)]/20 transition-all duration-200 text-left group disabled:opacity-50"
          >
            <div className="w-11 h-11 rounded-xl bg-[var(--success-light)] flex items-center justify-center mb-4 group-hover:bg-[var(--success)] transition-colors">
              {actionLoading === 'path' ? (
                <Loader2 size={22} className="text-[var(--success)] animate-spin" />
              ) : (
                <Route size={22} className="text-[var(--success)] group-hover:text-white transition-colors" />
              )}
            </div>
            <h3 className="font-semibold text-[var(--text-primary)] mb-1.5">生成学习路径</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              基于指定主题智能推荐阅读顺序，构建体系化的学习路径
            </p>
            <div className="flex items-center gap-1 mt-3 text-[var(--success)] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              创建路径 <ChevronRight size={14} />
            </div>
          </button>
        </div>
      </section>

      {/* ─── Add Content FAB & Modal ─────────────────────────────────── */}
      <AddContentModal onSuccess={refreshAll} />
    </div>
  );
}
