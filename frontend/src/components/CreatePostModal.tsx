'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Zap } from 'lucide-react';
import clsx from 'clsx';
import { postsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getAvatarColor } from './Navbar';

const MAX_CHARS = 280;

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreatePostModal({ isOpen, onClose, onSuccess }: CreatePostModalProps) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setContent('');
      setError(null);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;
    if (trimmed.length > MAX_CHARS) {
      setError(`Post must be ${MAX_CHARS} characters or fewer.`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await postsApi.create(trimmed);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; message?: string } } };
      setError(
        axiosErr?.response?.data?.error ??
          axiosErr?.response?.data?.message ??
          'Failed to create post. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const remaining = MAX_CHARS - content.length;
  const isOverLimit = remaining < 0;
  const isEmpty = content.trim().length === 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            <h2 className="text-white font-semibold text-sm">New Post</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex gap-3">
            {user && (
              <div
                className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0',
                  getAvatarColor(user.username),
                )}
              >
                {user.username[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's happening?"
                rows={4}
                className="w-full bg-transparent text-white placeholder-slate-500 text-base resize-none outline-none leading-relaxed"
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
                }}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
          {/* Character counter */}
          <div className="flex items-center gap-3">
            {/* Progress ring */}
            <div className="relative w-8 h-8">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="2.5"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke={isOverLimit ? '#ef4444' : remaining <= 20 ? '#f59e0b' : '#3b82f6'}
                  strokeWidth="2.5"
                  strokeDasharray={`${Math.PI * 26}`}
                  strokeDashoffset={`${Math.PI * 26 * (1 - Math.min(content.length / MAX_CHARS, 1))}`}
                  strokeLinecap="round"
                  className="transition-all duration-150"
                />
              </svg>
              {remaining <= 20 && (
                <span
                  className={clsx(
                    'absolute inset-0 flex items-center justify-center text-[9px] font-bold',
                    isOverLimit ? 'text-red-400' : 'text-amber-400',
                  )}
                >
                  {remaining}
                </span>
              )}
            </div>
            <span className="text-slate-500 text-xs">Ctrl+Enter to post</span>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isLoading || isEmpty || isOverLimit}
            className={clsx(
              'px-5 py-2 rounded-full text-sm font-semibold transition-all',
              isLoading || isEmpty || isOverLimit
                ? 'bg-blue-600/40 text-blue-300/50 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 active:scale-95',
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Posting…
              </span>
            ) : (
              'Post'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
