'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  UserPlus,
  UserMinus,
  Loader2,
  PenSquare,
  ChevronDown,
  CalendarDays,
} from 'lucide-react';
import clsx from 'clsx';
import { usersApi, postsApi, UserProfile, Post } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import Navbar from '@/components/Navbar';
import PostCard, { PostData } from '@/components/PostCard';
import CreatePostModal from '@/components/CreatePostModal';
import { getAvatarColor } from '@/components/Navbar';

const PAGE_LIMIT = 20;

const BANNER_GRADIENTS = [
  'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
  'linear-gradient(135deg, #14532d 0%, #1e293b 100%)',
  'linear-gradient(135deg, #581c87 0%, #1e293b 100%)',
  'linear-gradient(135deg, #7c2d12 0%, #1e293b 100%)',
  'linear-gradient(135deg, #831843 0%, #1e293b 100%)',
  'linear-gradient(135deg, #7f1d1d 0%, #1e293b 100%)',
];

function getBannerGradient(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BANNER_GRADIENTS[Math.abs(hash) % BANNER_GRADIENTS.length];
}

function postToPostData(post: Post): PostData {
  return {
    id: post.id,
    user_id: post.user_id,
    username: post.username,
    content: post.content,
    created_at: post.created_at,
  };
}

function PostSkeleton() {
  return (
    <div className="px-4 py-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-slate-800 rounded w-32" />
          <div className="h-3 bg-slate-800 rounded w-full" />
          <div className="h-3 bg-slate-800 rounded w-4/5" />
        </div>
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const targetUserId = params.userId as string;

  const { user, token, isHydrated } = useAuthStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [postTotal, setPostTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = user?.id === targetUserId;

  // Auth guard
  useEffect(() => {
    if (!isHydrated) return;
    if (!token) {
      router.replace('/login');
    }
  }, [isHydrated, token, router]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch profile
  useEffect(() => {
    if (!targetUserId || !isHydrated || !token) return;

    setIsLoadingProfile(true);
    usersApi
      .getUser(targetUserId)
      .then((data) => {
        setProfile(data);
        setFollowersCount(data.followers_count);
        setFollowingCount(data.following_count);
      })
      .catch(() => setError('Failed to load user profile.'))
      .finally(() => setIsLoadingProfile(false));
  }, [targetUserId, isHydrated, token]);

  // Check if current user is following target user
  useEffect(() => {
    if (!user || isOwnProfile || !targetUserId) return;

    usersApi
      .getFollowing(user.id)
      .then(({ following_ids }) => {
        setIsFollowing(following_ids.includes(targetUserId));
      })
      .catch(() => {
        // ignore — follow state just won't be set
      });
  }, [user, targetUserId, isOwnProfile]);

  // Load posts
  const loadPosts = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) {
        setIsLoadingPosts(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const data = await postsApi.getUserPosts(targetUserId, pageNum, PAGE_LIMIT);
        const mapped = data.posts.map(postToPostData);

        setPosts((prev) => (replace ? mapped : [...prev, ...mapped]));
        setPostTotal(data.total);
        setHasMore(mapped.length === PAGE_LIMIT && (replace ? mapped : []).length < data.total);
        setPage(pageNum);
      } catch {
        setError('Failed to load posts.');
      } finally {
        setIsLoadingPosts(false);
        setIsLoadingMore(false);
      }
    },
    [targetUserId],
  );

  useEffect(() => {
    if (targetUserId && isHydrated && token) {
      loadPosts(1, true);
    }
  }, [targetUserId, isHydrated, token, loadPosts]);

  const handleFollowToggle = async () => {
    if (isFollowLoading || !user) return;
    setIsFollowLoading(true);

    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowersCount((c) => (wasFollowing ? c - 1 : c + 1));

    try {
      if (wasFollowing) {
        await usersApi.unfollow(targetUserId);
        showToast(`Unfollowed ${profile?.username}`);
      } else {
        await usersApi.follow(targetUserId);
        showToast(`Following ${profile?.username}`);
      }
    } catch {
      // revert
      setIsFollowing(wasFollowing);
      setFollowersCount((c) => (wasFollowing ? c + 1 : c - 1));
      showToast('Action failed. Please try again.');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await postsApi.delete(postId);
      setPosts((prev) => prev.filter((p) => (p.post_id ?? p.id) !== postId));
      setPostTotal((t) => t - 1);
      showToast('Post deleted.');
    } catch {
      showToast('Failed to delete post.');
    }
  };

  const handlePostCreated = () => {
    loadPosts(1, true);
    showToast('Post created!');
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar nav */}
      <Navbar />

      {/* Main content */}
      <main className="flex-1 lg:ml-64 min-h-screen">
        <div className="max-w-2xl mx-auto px-0 sm:px-0 lg:px-0">
          {/* Top bar */}
          <div className="sticky top-14 lg:top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 mt-14 lg:mt-0 flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all -ml-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                {isLoadingProfile ? '...' : (profile?.username ?? 'User')}
              </h1>
              {!isLoadingProfile && (
                <p className="text-slate-500 text-xs">{postTotal} {postTotal === 1 ? 'post' : 'posts'}</p>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mt-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Profile header */}
          {isLoadingProfile ? (
            <div className="animate-pulse">
              <div className="h-32 bg-slate-800 relative">
                <div className="absolute left-4 bottom-0 translate-y-1/2">
                  <div className="w-20 h-20 rounded-full bg-slate-700 border-4 border-slate-950" />
                </div>
              </div>
              <div className="px-4 pb-4 pt-2">
                <div className="h-10 mb-3" />
                <div className="h-5 bg-slate-800 rounded w-32 mb-2" />
                <div className="h-4 bg-slate-800 rounded w-24 mb-4" />
                <div className="flex gap-4">
                  <div className="h-4 bg-slate-800 rounded w-20" />
                  <div className="h-4 bg-slate-800 rounded w-20" />
                </div>
              </div>
            </div>
          ) : profile ? (
            <div>
              {/* Banner with avatar anchored to its bottom edge */}
              <div
                className="h-32 relative"
                style={{ background: getBannerGradient(profile.username) }}
              >
                <div className="absolute left-4 bottom-0 translate-y-1/2 z-10">
                  <div
                    className={clsx(
                      'w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl border-4 border-slate-950 shadow-lg',
                      getAvatarColor(profile.username),
                    )}
                  >
                    {profile.username[0].toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Profile info */}
              <div className="px-4 pb-0">
                {/* Action button row — height matches avatar overflow (40 px) */}
                <div className="flex items-center justify-end h-10 mb-3">
                  {isOwnProfile ? (
                    <button
                      onClick={() => setIsPostModalOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-full transition-all shadow-lg shadow-blue-600/20"
                    >
                      <PenSquare className="w-3.5 h-3.5" />
                      New Post
                    </button>
                  ) : (
                    <button
                      onClick={handleFollowToggle}
                      disabled={isFollowLoading}
                      className={clsx(
                        'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all',
                        isFollowing
                          ? 'border border-slate-600 text-white hover:border-red-500/60 hover:text-red-400 hover:bg-red-400/5'
                          : 'bg-white text-slate-900 hover:bg-slate-200',
                        isFollowLoading && 'opacity-60 cursor-not-allowed',
                      )}
                    >
                      {isFollowLoading ? (
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : isFollowing ? (
                        <>
                          <UserMinus className="w-3.5 h-3.5" />
                          Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          Follow
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Username */}
                <div className="mb-3">
                  <h2 className="text-xl font-bold text-white">{profile.username}</h2>
                  <p className="text-slate-500 text-sm">@{profile.username}</p>
                </div>

                {/* Email (own profile only) */}
                {isOwnProfile && (
                  <p className="text-slate-500 text-sm mb-3 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {profile.email}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-5 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold text-sm">{postTotal}</span>
                    <span className="text-slate-500 text-sm">Posts</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold text-sm">{followersCount}</span>
                    <span className="text-slate-500 text-sm">Followers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold text-sm">{followingCount}</span>
                    <span className="text-slate-500 text-sm">Following</span>
                  </div>
                </div>
              </div>

              {/* Tabs (just Posts for now) */}
              <div className="flex border-b border-slate-800">
                <button className="flex-1 py-3 text-sm font-semibold text-white border-b-2 border-blue-500 transition-colors">
                  Posts
                </button>
              </div>

              {/* Posts */}
              {isLoadingPosts ? (
                <div className="divide-y divide-slate-800">
                  {[1, 2, 3].map((i) => (
                    <PostSkeleton key={i} />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-slate-600" />
                  </div>
                  <p className="text-white font-semibold mb-1">No posts yet</p>
                  <p className="text-slate-500 text-sm">
                    {isOwnProfile
                      ? 'Share what\'s on your mind!'
                      : `${profile.username} hasn't posted yet.`}
                  </p>
                  {isOwnProfile && (
                    <button
                      onClick={() => setIsPostModalOpen(true)}
                      className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-full transition-all shadow-lg shadow-blue-600/20"
                    >
                      <PenSquare className="w-4 h-4" />
                      Create your first post
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-800">
                    {posts.map((post, idx) => (
                      <PostCard
                        key={`${post.post_id ?? post.id}-${idx}`}
                        post={post}
                        onDelete={
                          isOwnProfile
                            ? () => handleDeletePost(post.post_id ?? post.id ?? '')
                            : undefined
                        }
                      />
                    ))}
                  </div>

                  {hasMore && (
                    <div className="py-6 flex justify-center">
                      <button
                        onClick={() => loadPosts(page + 1, false)}
                        disabled={isLoadingMore}
                        className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm font-medium rounded-full transition-all"
                      >
                        {isLoadingMore ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        {isLoadingMore ? 'Loading…' : 'Load more'}
                      </button>
                    </div>
                  )}

                  {!hasMore && posts.length > 0 && (
                    <div className="py-8 text-center text-slate-600 text-xs">
                      All posts loaded
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>
      </main>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSuccess={handlePostCreated}
      />

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-slate-800 border border-slate-700 text-white text-sm font-medium rounded-full shadow-2xl shadow-black/50 animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
