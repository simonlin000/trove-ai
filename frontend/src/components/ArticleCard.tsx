'use client';

import React, { useCallback } from 'react';
import { BookOpen, Clock, Star, Loader2, Hourglass, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Article } from '@/lib/types';

interface ArticleCardProps {
  article: Article;
}

export default function ArticleCard({ article }: ArticleCardProps) {
  const router = useRouter();

  const handleTagClick = useCallback(
    (e: React.MouseEvent, tagName: string) => {
      e.preventDefault();
      e.stopPropagation();
      router.push(`/library?tag=${encodeURIComponent(tagName)}`);
    },
    [router]
  );

  return (
    <Link
      href={`/read/${article.id}`}
      className="block bg-[var(--bg-primary)] rounded-xl p-5 border border-[var(--border-color)] hover:shadow-lg hover:border-[var(--accent)]/20 transition-all duration-200 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-[15px] leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors line-clamp-2 flex-1">
          {article.title}
        </h3>
        <Star
          size={16}
          className={article.is_favorited ? 'fill-[var(--warning)] text-[var(--warning)]' : 'text-[var(--text-tertiary)]'}
        />
      </div>

      {/* Summary / fetch status indicator (priority: pending_agent > failed > no summary) */}
      {article.fetch_status === 'pending_agent' ? (
        <div className="flex items-center gap-1.5 mb-3 text-xs text-[var(--accent)] bg-[var(--accent-light)] px-2.5 py-1.5 rounded-md w-fit">
          <Hourglass size={12} className="animate-pulse" />
          <span>等待本地代采…</span>
        </div>
      ) : article.fetch_status === 'failed' ? (
        <div className="flex items-center gap-1.5 mb-3 text-xs text-[var(--danger,#ef4444)] bg-[var(--danger-light,rgba(239,68,68,0.1))] px-2.5 py-1.5 rounded-md w-fit">
          <XCircle size={12} />
          <span>代采失败</span>
        </div>
      ) : article.summary ? (
        <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
          {article.summary}
        </p>
      ) : article.content_type !== 'note' && (
        <div className="flex items-center gap-1.5 mb-3 text-xs text-[var(--accent)] bg-[var(--accent-light)] px-2.5 py-1.5 rounded-md w-fit">
          <Loader2 size={12} className="animate-spin" />
          <span>AI 正在处理摘要…</span>
        </div>
      )}

      {/* Tags - clickable */}
      {article.tags && article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {article.tags.slice(0, 4).map((tag) => (
            <span
              key={tag.id}
              onClick={(e) => handleTagClick(e, tag.name)}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer hover:opacity-80 hover:scale-105 transition-all"
              style={{
                backgroundColor: tag.color + '18',
                color: tag.color,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
        <span className="flex items-center gap-1">
          <BookOpen size={12} />
          {article.source_platform || 'web'}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {article.reading_time || 1}min
        </span>
        {article.author && (
          <span className="truncate">{article.author}</span>
        )}
      </div>
    </Link>
  );
}
