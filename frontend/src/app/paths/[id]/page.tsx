'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Clock, CheckCircle2, Circle, Loader2, ChevronRight, Target } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { LearningPathDetail, Article } from '@/lib/types';

export default function PathDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [path, setPath] = useState<LearningPathDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPath = async () => {
      try {
        const data = await api.getPath(params.id as string);
        setPath(data);
      } catch (e: any) {
        setError(e.message || 'Not found');
      } finally {
        setLoading(false);
      }
    };
    fetchPath();
  }, [params.id]);

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-[#f5f5f7] rounded w-1/3" />
          <div className="h-4 bg-[#f5f5f7] rounded w-2/3" />
          <div className="h-3 bg-[#f5f5f7] rounded w-1/2" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-[#f5f5f7] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !path) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto text-center py-16">
        <p className="text-[#ff3b30] text-lg mb-4">{error || '学习路线未找到'}</p>
        <button onClick={() => router.back()} className="px-6 py-2 bg-[#007aff] text-white rounded-xl">
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> 返回路线列表
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl p-8 border border-[#e5e5ea] mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007aff] to-[#5856d6] flex items-center justify-center">
            <Target size={20} className="text-white" />
          </div>
          <div>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              path.status === 'active' ? 'bg-[#e8f2ff] text-[#007aff]' :
              path.status === 'completed' ? 'bg-[#e8f8ee] text-[#34c759]' : 'bg-[#fff3e0] text-[#ff9500]'
            }`}>
              {path.status === 'active' ? '学习中' : path.status === 'completed' ? '已完成' : '已暂停'}
            </span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-[#1d1d1f] mb-3">{path.title}</h1>
        {path.description && (
          <p className="text-[#6e6e73] mb-4">{path.description}</p>
        )}
        
        {/* Progress */}
        <div className="flex items-center gap-4 mt-6 pt-4 border-t border-[#e5e5ea]">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#aeaeb2]">
                {path.articles_order?.length || 0} 篇文章 · 完成 {Math.round(path.progress)}%
              </span>
            </div>
            <div className="h-2.5 bg-[#f5f5f7] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${path.progress}%`,
                  background: 'linear-gradient(90deg, #007aff, #5856d6)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Articles in order */}
      <div>
        <h2 className="text-lg font-semibold text-[#1d1d1f] mb-4 flex items-center gap-2">
          <BookOpen size={20} /> 学习顺序
        </h2>
        <div className="space-y-3">
          {path.articles?.map((article, index) => (
            <Link
              key={article.id}
              href={`/read/${article.id}`}
              className="flex items-start gap-4 bg-white rounded-xl p-5 border border-[#e5e5ea] hover:shadow-md hover:border-[#007aff20] transition-all group"
            >
              {/* Step Number */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-sm font-bold text-[#6e6e73] group-hover:bg-[#e8f2ff] group-hover:text-[#007aff] transition-colors">
                {index + 1}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[15px] text-[#1d1d1f] group-hover:text-[#007aff] transition-colors line-clamp-1 mb-1">
                  {article.title}
                </h3>
                {article.summary && (
                  <p className="text-xs text-[#6e6e73] line-clamp-2">{article.summary}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-[#aeaeb2]">
                  {article.source_platform && (
                    <span className="flex items-center gap-1">
                      <BookOpen size={10} />
                      {article.source_platform}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {article.reading_time || 1}min
                  </span>
                </div>
              </div>
              
              <ChevronRight size={16} className="flex-shrink-0 text-[#aeaeb2] group-hover:text-[#007aff] mt-1 transition-colors" />
            </Link>
          ))}
        </div>

        {(!path.articles || path.articles.length === 0) && (
          <div className="text-center py-12 bg-white rounded-xl border border-[#e5e5ea]">
            <p className="text-[#6e6e73]">此路线中暂无可显示的文章</p>
          </div>
        )}
      </div>
    </div>
  );
}
