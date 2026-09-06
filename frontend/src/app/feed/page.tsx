'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, PenSquare, Users, Loader2, ChevronDown, Zap } from 'lucide-react';
import { feedApi, postsApi, FeedItem } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import Navbar from '@/components/Navbar';
import PostCard, { PostData } from '@/components/PostCard';
import CreatePostModal from '@/components/CreatePostModal';

const PAGE_LIMIT = 20;

// Skeleton loader for a post card
function PostSkeleton() {
  return (
    <div className="px-4 py-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2 items-center">
            <div className="h-3.5 bg-slate-800 rounded w-24" />
            <div className="h-3 bg-slate-800 rounded w-16" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 bg-slate-800 rounded w-full" />
            <div className="h-3 bg-slate-800 rounded w-5/6" />
            <div className="h-3 bg-slate-800 rounded w-2/3" />
          </div>
          <div className="flex gap-4 pt-1">
            <div className="h-3 bg-slate-800 rounded w-10" />
            <div className="h-3 bg-slate-800 rounded w-10" />
          </div>
        </div>
      </div>
    </div>
  );
}

function feedItemToPostData(item: FeedItem): PostData {
  return {
    post_id: item.post_id,
    user_id: item.user_id,
    username: item.username,
    content: item.content,
    created_at: item.created_at,
  };
}

export default function FeedPage() {
  const router = useRouter();
  const { user, token, isHydrated } = useAuthStore();
  const { notifications } = useNotificationStore();

  const [posts, setPosts] = useState<PostData[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [newPostsBanner, setNewPostsBanner] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isHydrated) return;
    if (!token) {
      router.replace('/login');
    }
  }, [isHydrated, token, router]);

  // Track new_post notifications to show banner
  useEffect(() => {
    const newPosts = notifications.filter(
      (n) => n.type === 'new_post' && !n.read,
    );
    if (newPosts.length > 0) {
      setNewPostsBanner(newPosts.length);
    }
  }, [notifications]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadFeed = useCallback(async (pageNum: number, replace: boolean) => {
    if (replace) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const data = await feedApi.getFeed(pageNum, PAGE_LIMIT);
      const mapped = data.items.map(feedItemToPostData);

      setPosts((prev) => (replace ? mapped : [...prev, ...mapped]));
      setHasMore(data.has_more);
      setPage(pageNum);
    } catch {
      setError('Failed to load your feed. Please try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (isHydrated && token) {
      loadFeed(1, true);
    }
  }, [isHydrated, token, loadFeed]);

  const handleRefresh = async () => {
    setNewPostsBanner(0);
    await loadFeed(1, true);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      loadFeed(page + 1, false);
    }
  };

  const handlePostCreated = () => {
    loadFeed(1, true);
    showToast('Post created!');
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await postsApi.delete(postId);
      setPosts((prev) => prev.filter((p) => (p.post_id ?? p.id) !== postId));
      showToast('Post deleted.');
    } catch {
      showToast('Failed to delete post. Please try again.');
    }
  };

  // Still hydrating
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

      {/* Main content — offset for sidebar on desktop */}
      <main className="flex-1 lg:ml-64 min-h-screen">
        <div className="max-w-2xl mx-auto px-0 sm:px-4 lg:px-0">
          {/* Sticky header */}
          <div className="sticky top-14 lg:top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 mt-14 lg:mt-0">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-white">Home</h1>
                <p className="text-slate-500 text-xs">Your personalized feed</p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-50"
                title="Refresh feed"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* New posts banner */}
          {newPostsBanner > 0 && (
            <button
              onClick={handleRefresh}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600/10 border-b border-blue-600/30 text-blue-400 text-sm font-medium hover:bg-blue-600/20 transition-colors"
            >
              <Zap className="w-4 h-4" />
              {newPostsBanner} new post{newPostsBanner > 1 ? 's' : ''} — click to refresh
            </button>
          )}

          {/* Quick compose bar */}
          <div className="px-4 py-4 border-b border-slate-800 bg-slate-900/30">
            <div className="flex items-center gap-3">
              {user && (
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {user.username[0].toUpperCase()}
                </div>
              )}
              <button
                onClick={() => setIsPostModalOpen(true)}
                className="flex-1 text-left px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 text-sm transition-colors"
              >
                What&apos;s happening?
              </button>
              <button
                onClick={() => setIsPostModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-full transition-all shadow-lg shadow-blue-600/20 flex-shrink-0"
              >
                <PenSquare className="w-3.5 h-3.5" />
                Post
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mt-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center justify-between">
              {error}
              <button
                onClick={() => loadFeed(1, true)}
                className="text-red-300 hover:text-red-200 text-xs underline ml-3 flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading skeletons */}
          {isLoading && (
            <div className="divide-y divide-slate-800">
              {[1, 2, 3].map((i) => (
                <PostSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Feed items */}
          {!isLoading && (
            <>
              {posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                    <Users className="w-7 h-7 text-slate-600" />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">Your feed is empty</h3>
                  <p className="text-slate-500 text-sm max-w-sm">
                    Follow some users to see their posts here, or create your first post!
                  </p>
                  <button
                    onClick={() => setIsPostModalOpen(true)}
                    className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-full transition-all shadow-lg shadow-blue-600/20"
                  >
                    <PenSquare className="w-4 h-4" />
                    Create your first post
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {posts.map((post, idx) => (
                    <PostCard
                      key={`${post.post_id ?? post.id}-${idx}`}
                      post={post}
                      onDelete={
                        user?.id === post.user_id
                          ? () => handleDeletePost(post.post_id ?? post.id ?? '')
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}

              {/* Load more */}
              {posts.length > 0 && hasMore && (
                <div className="py-6 flex justify-center">
                  <button
                    onClick={handleLoadMore}
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

              {posts.length > 0 && !hasMore && (
                <div className="py-8 text-center text-slate-600 text-xs">
                  You&apos;ve reached the end of your feed
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSuccess={handlePostCreated}
      />

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-slate-800 border border-slate-700 text-white text-sm font-medium rounded-full shadow-2xl shadow-black/50 animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
