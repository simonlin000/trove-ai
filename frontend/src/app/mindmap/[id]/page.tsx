'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { MindMapData, MindMapResponse } from '@/lib/types';

interface CachedMindMap {
  mindmap_data: MindMapData;
  cached: boolean;
  article_title?: string;
}

export default function MindMapPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [mindmapData, setMindmapData] = useState<MindMapResponse | null>(null);
  const [articleTitle, setArticleTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCached, setIsCached] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mmRef = useRef<any>(null);

  const renderMarkmap = useCallback(async () => {
    if (!mindmapData?.mindmap_data?.children?.length || !svgRef.current) return;
    
    try {
      const { Markmap } = await import('markmap-view');
      
      const convertToMarkmap = (node: any): any => ({
        content: node.label || node.name || '',
        children: (node.children || []).map(convertToMarkmap),
        payload: node.label || node.name || '',
      });
      
      const data = convertToMarkmap(mindmapData.mindmap_data!);
      
      if (mmRef.current) {
        mmRef.current.destroy();
      }
      
      mmRef.current = Markmap.create(
        svgRef.current,
        {
          duration: 500,
          maxWidth: 280,
          initialExpandLevel: 3,
          spacingHorizontal: 80,
          spacingVertical: 12,
          autoFit: true,
        },
        data,
      );
    } catch (err: any) {
      console.error('Markmap render error:', err);
      const msg = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
      setError(msg || '思维导图渲染失败');
    }
  }, [mindmapData]);

  const loadMindmap = useCallback(async (forceRegenerate = false) => {
    setLoading(true);
    setError('');
    
    try {
      // 1. If not force regenerate, check cache first
      if (!forceRegenerate) {
        try {
          const cached = await api.getCachedMindmap(params.id);
          if ((cached?.mindmap_data?.children?.length ?? 0) > 0) {
            setMindmapData(cached);
            setArticleTitle(cached.article_title || '');
            setIsCached(true);
            setLoading(false);
            return;
          }
        } catch (e) {
          // Cache miss — proceed to generate
        }
      }
      
      // 2. Generate new mindmap
      setIsCached(false);
      const generated = await api.generateMindMap(params.id);
      if (generated?.mindmap_data) {
        setMindmapData(generated);
        setArticleTitle(generated.article_title || '');
      } else {
        setError('生成失败：未返回数据');
      }
    } catch (err: any) {
      setError(err.message || '加载思维导图失败');
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }, [params.id]);

  // Delete cache and regenerate
  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    setMindmapData(null);
    try {
      await api.deleteMindmapCache(params.id);
    } catch (e) {
      // Ignore delete errors
    }
    loadMindmap(true);
  }, [params.id, loadMindmap]);

  useEffect(() => {
    loadMindmap();
  }, [loadMindmap]);

  useEffect(() => {
    if (mindmapData?.mindmap_data?.children?.length) {
      renderMarkmap();
    }
    return () => {
      if (mmRef.current) {
        mmRef.current.destroy();
        mmRef.current = null;
      }
    };
  }, [mindmapData, renderMarkmap]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      mmRef.current?.fit();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const nodeCount = mindmapData?.mindmap_data?.children?.length || 0;

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-primary)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-sm font-medium text-[var(--text-primary)]">思维导图</h1>
            {articleTitle && (
              <p className="text-xs text-[var(--text-tertiary)] truncate max-w-[300px]">
                {articleTitle}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Regenerate button */}
          {!loading && !error && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50
                transition-all shadow-sm"
            >
              <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
              重新生成
            </button>
          )}
          
          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            {loading && regenerating ? (
              <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                AI 重新生成中...
              </span>
            ) : isCached && nodeCount > 0 ? (
              <span className="px-2 py-1 rounded bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                来自缓存 · {nodeCount} 个节点
              </span>
            ) : !loading && nodeCount > 0 ? (
              <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                AI 新生成 · {nodeCount} 个节点
              </span>
            ) : loading && !regenerating ? (
              <span className="px-2 py-1 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                AI 生成中...
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* Content */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {loading && !regenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--bg-primary)] z-10">
            <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              正在生成思维导图...
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--bg-primary)]">
            <AlertCircle size={32} className="text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={handleRegenerate}
              className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg"
            >
              重试
            </button>
          </div>
        )}

        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ background: 'var(--bg-primary)' }}
        />
      </div>
    </div>
  );
}