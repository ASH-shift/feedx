'use client';

import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { UserPlus, UserMinus } from 'lucide-react';
import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getAvatarColor } from './Navbar';

interface UserCardProps {
  userId: string;
  username: string;
  isFollowing?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  showFollowButton?: boolean;
}

export default function UserCard({
  userId,
  username,
  isFollowing = false,
  onFollowChange,
  showFollowButton = true,
}: UserCardProps) {
  const { user } = useAuthStore();
  const [following, setFollowing] = useState(isFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const isOwnProfile = user?.id === userId;

  const handleFollowToggle = async () => {
    if (isLoading || isOwnProfile) return;
    setIsLoading(true);

    const wasFollowing = following;
    setFollowing(!wasFollowing);

    try {
      if (wasFollowing) {
        await usersApi.unfollow(userId);
      } else {
        await usersApi.follow(userId);
      }
      onFollowChange?.(!wasFollowing);
    } catch {
      // Revert on error
      setFollowing(wasFollowing);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-800/60 transition-colors group">
      {/* Avatar */}
      <Link href={`/users/${userId}`} className="flex-shrink-0">
        <div
          className={clsx(
            'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-transparent group-hover:ring-blue-500/30 transition-all',
            getAvatarColor(username),
          )}
        >
          {username[0].toUpperCase()}
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/users/${userId}`}
          className="block font-semibold text-white text-sm hover:text-blue-400 transition-colors truncate"
        >
          {username}
        </Link>
        <p className="text-slate-500 text-xs truncate">@{username}</p>
      </div>

      {/* Follow button */}
      {showFollowButton && !isOwnProfile && user && (
        <button
          onClick={handleFollowToggle}
          disabled={isLoading}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0',
            following
              ? 'border border-slate-600 text-slate-400 hover:border-red-500/50 hover:text-red-400 hover:bg-red-400/5'
              : 'bg-white text-slate-900 hover:bg-slate-200',
            isLoading && 'opacity-60 cursor-not-allowed',
          )}
        >
          {isLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : following ? (
            <>
              <UserMinus className="w-3 h-3" />
              Unfollow
            </>
          ) : (
            <>
              <UserPlus className="w-3 h-3" />
              Follow
            </>
          )}
        </button>
      )}
    </div>
  );
}
