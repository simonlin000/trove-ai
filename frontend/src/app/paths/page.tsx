'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Route, Plus, Zap, Trash2, Play, Pause, CheckCircle2, Loader2, BookOpen, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { LearningPath } from '@/lib/types';

export default function PathsPage() {
  const searchParams = useSearchParams();
  const viewUsername = searchParams.get('username') || '';
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [error, setError] = useState('');

  const fetchPaths = async () => {
    setLoading(true);
    try {
      const data = await api.getPaths(undefined, viewUsername || undefined);
      setPaths(data);
    } catch {
      setPaths([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPaths(); }, []);

  const showToastMsg = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const generatePath = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      await api.generatePath(topic.trim(), description.trim() || undefined);
      showToastMsg('学习路线已生成', 'success');
      setTopic('');
      setDescription('');
      setShowForm(false);
      fetchPaths();
    } catch (e: any) {
      showToastMsg(e.message || '生成失败，请确保有足够的相关文章', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const updatePathStatus = async (id: string, status: string) => {
    try {
      await api.updatePath(id, { status });
      fetchPaths();
    } catch {}
  };

  const deletePath = async (id: string) => {
    if (!confirm('确定删除此学习路线？')) return;
    try {
      await api.deletePath(id);
      showToastMsg('已删除', 'success');
      fetchPaths();
    } catch {}
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      active: { bg: '#e8f2ff', text: '#007aff', label: '学习中' },
      completed: { bg: '#e8f8ee', text: '#34c759', label: '已完成' },
      paused: { bg: '#fff3e0', text: '#ff9500', label: '已暂停' },
    };
    const s = styles[status] || styles.active;
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: s.bg, color: s.text }}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-8 z-50 px-5 py-3 rounded-xl shadow-lg ${
          toast.type === 'success' ? 'bg-[#34c759] text-white' : 'bg-[#ff3b30] text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">学习路线</h1>
          <p className="text-sm text-[#aeaeb2] mt-1">AI 根据你的知识库智能生成主题学习路径</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#007aff] text-white rounded-xl font-medium hover:bg-[#0062cc] transition-colors shadow-md shadow-[#007aff20]"
        >
          <Zap size={16} /> 生成学习路线
        </button>
      </div>

      {/* Generate Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-6">AI 生成学习路线</h2>
            
            <label className="block text-sm font-medium text-[#6e6e73] mb-2">学习主题</label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="例如：深度学习、React、产品设计..."
              className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#007aff]/20 mb-4"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && generatePath()}
            />
            
            <label className="block text-sm font-medium text-[#6e6e73] mb-2">描述（可选）</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="描述你想学习的方向和目标..."
              className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#007aff]/20 mb-6 resize-none"
              rows={3}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 text-sm text-[#6e6e73] border border-[#e5e5ea] rounded-xl hover:bg-[#f5f5f7]"
              >
                取消
              </button>
              <button
                onClick={generatePath}
                disabled={!topic.trim() || generating}
                className="flex-1 py-3 text-sm bg-[#007aff] text-white rounded-xl font-medium disabled:opacity-50 hover:bg-[#0062cc] flex items-center justify-center gap-2"
              >
                {generating ? (
                  <><Loader2 size={16} className="animate-spin" /> 分析中...</>
                ) : (
                  <><Zap size={16} /> AI 生成路线</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paths List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-[#e5e5ea] animate-pulse">
              <div className="h-6 bg-[#f5f5f7] rounded w-1/3 mb-3" />
              <div className="h-4 bg-[#f5f5f7] rounded w-2/3 mb-3" />
              <div className="h-3 bg-[#f5f5f7] rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : paths.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#f5f5f7] flex items-center justify-center">
            <Route size={32} className="text-[#aeaeb2]" />
          </div>
          <p className="text-[#6e6e73] text-lg mb-2">还没有学习路线</p>
          <p className="text-[#aeaeb2] text-sm mb-6">输入学习主题，AI 会自动从你的知识库中整理最佳学习顺序</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2.5 bg-[#007aff] text-white rounded-xl font-medium hover:bg-[#0062cc]"
          >
            创建第一条路线
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {paths.map(path => (
            <Link
              key={path.id}
              href={`/paths/${path.id}`}
              className="block bg-white rounded-2xl p-6 border border-[#e5e5ea] hover:shadow-md hover:border-[#007aff20] transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-[#1d1d1f] group-hover:text-[#007aff] transition-colors">
                      {path.title}
                    </h3>
                    {getStatusBadge(path.status)}
                  </div>
                  {path.description && (
                    <p className="text-sm text-[#6e6e73] line-clamp-2">{path.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <ArrowRight size={18} className="text-[#aeaeb2] group-hover:text-[#007aff] transition-colors" />
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#aeaeb2]">
                    {path.articles_order?.length || 0} 篇文章 · 进度 {Math.round(path.progress)}%
                  </span>
                </div>
                <div className="h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${path.progress}%`,
                      background: path.status === 'completed'
                        ? '#34c759'
                        : 'linear-gradient(90deg, #007aff, #5856d6)',
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#e5e5ea]">
                {path.status === 'active' && (
                  <button
                    onClick={e => { e.preventDefault(); updatePathStatus(path.id, 'paused'); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#ff9500] hover:bg-[#fff3e0] rounded-lg"
                  >
                    <Pause size={12} /> 暂停
                  </button>
                )}
                {(path.status === 'paused' || path.status === 'active') && (
                  <button
                    onClick={e => { e.preventDefault(); updatePathStatus(path.id, 'completed'); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#34c759] hover:bg-[#e8f8ee] rounded-lg"
                  >
                    <CheckCircle2 size={12} /> 标记完成
                  </button>
                )}
                {path.status !== 'active' && (
                  <button
                    onClick={e => { e.preventDefault(); updatePathStatus(path.id, 'active'); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#007aff] hover:bg-[#e8f2ff] rounded-lg"
                  >
                    <Play size={12} /> 继续
                  </button>
                )}
                <button
                  onClick={e => { e.preventDefault(); deletePath(path.id); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#ff3b30] hover:bg-[#ffe8e6] rounded-lg ml-auto"
                >
                  <Trash2 size={12} /> 删除
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
