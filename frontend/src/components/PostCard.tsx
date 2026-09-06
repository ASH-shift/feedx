'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trash2, Heart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { useAuthStore } from '@/store/authStore';
import { getAvatarColor } from './Navbar';

export interface PostData {
  post_id?: string;
  id?: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

interface PostCardProps {
  post: PostData;
  onDelete?: () => Promise<void> | void;
}

export default function PostCard({ post, onDelete }: PostCardProps) {
  const { user } = useAuthStore();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const postId = post.post_id ?? post.id ?? '';
  const isOwner = user?.id === post.user_id;

  const relativeTime = (() => {
    try {
      return formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
    } catch {
      return 'just now';
    }
  })();

  const handleLike = () => {
    setLiked((prev) => {
      setLikeCount((c) => (prev ? c - 1 : c + 1));
      return !prev;
    });
  };

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <article className="bg-slate-900/30 hover:bg-slate-900/70 transition-colors px-4 py-4 group">
      <div className="flex gap-3">
        {/* Avatar */}
        <Link href={`/users/${post.user_id}`} className="flex-shrink-0">
          <div
            className={clsx(
              'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-transparent hover:ring-blue-500 transition-all',
              getAvatarColor(post.username),
            )}
          >
            {post.username[0].toUpperCase()}
          </div>
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Link
                href={`/users/${post.user_id}`}
                className="font-bold text-white text-sm hover:text-blue-400 transition-colors truncate"
              >
                {post.username}
              </Link>
              <span className="text-slate-500 text-sm truncate">@{post.username}</span>
              <span className="text-slate-600 text-xs flex-shrink-0">·</span>
              <time
                className="text-slate-500 text-xs flex-shrink-0"
                dateTime={post.created_at}
                title={new Date(post.created_at).toLocaleString()}
              >
                {relativeTime}
              </time>
            </div>

            {/* Delete button (owner only) */}
            {isOwner && onDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                title="Delete post"
              >
                {isDeleting ? (
                  <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {/* Post content */}
          <p className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words mb-3">
            {post.content}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className={clsx(
                'flex items-center gap-1.5 text-xs transition-all group/like',
                liked ? 'text-pink-500' : 'text-slate-500 hover:text-pink-400',
              )}
            >
              <Heart
                className={clsx(
                  'w-4 h-4 transition-transform group-hover/like:scale-110',
                  liked && 'fill-pink-500',
                )}
              />
              <span>{likeCount}</span>
            </button>

            <Link
              href={`/users/${post.user_id}`}
              className="text-xs text-slate-600 hover:text-blue-400 transition-colors"
            >
              {postId ? `#${postId.slice(0, 6)}` : ''}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
