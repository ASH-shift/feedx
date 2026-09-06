import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token from localStorage
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('feed_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: handle 401 by clearing session and redirecting
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('feed_token');
      localStorage.removeItem('feed_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  id: string;
  username: string;
  email: string;
  token: string;
}

export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/register', data).then((r) => r.data.data),

  login: (data: { email: string; password: string }) =>
    apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/login', data).then((r) => r.data.data),
};

// ─── Posts ───────────────────────────────────────────────────────────────────

export interface Post {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export interface UserPostsResponse {
  posts: Post[];
  total: number;
}

export const postsApi = {
  create: (content: string) =>
    apiClient.post<{ success: boolean; data: Post }>('/posts', { content }).then((r) => r.data.data),

  getById: (postId: string) =>
    apiClient.get<{ success: boolean; data: Post }>(`/posts/${postId}`).then((r) => r.data.data),

  getUserPosts: (userId: string, page = 1, limit = 20) =>
    apiClient
      .get<{ success: boolean; data: UserPostsResponse }>(`/posts/user/${userId}`, { params: { page, limit } })
      .then((r) => r.data.data),

  delete: (postId: string) =>
    apiClient.delete<{ success: boolean; data: { success: boolean } }>(`/posts/${postId}`).then((r) => r.data.data),
};

// ─── Feed ────────────────────────────────────────────────────────────────────

export interface FeedItem {
  post_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export interface FeedResponse {
  items: FeedItem[];
  has_more: boolean;
}

export const feedApi = {
  getFeed: (page = 1, limit = 20) =>
    apiClient
      .get<{ success: boolean; data: FeedResponse }>('/feed', { params: { page, limit } })
      .then((r) => r.data.data),
};

// ─── Users ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  followers_count: number;
  following_count: number;
}

export const usersApi = {
  getUser: (userId: string) =>
    apiClient.get<{ success: boolean; data: UserProfile }>(`/users/${userId}`).then((r) => r.data.data),

  follow: (userId: string) =>
    apiClient.post<{ success: boolean; data: { success: boolean } }>(`/users/${userId}/follow`).then((r) => r.data.data),

  unfollow: (userId: string) =>
    apiClient.delete<{ success: boolean; data: { success: boolean } }>(`/users/${userId}/follow`).then((r) => r.data.data),

  getFollowers: (userId: string) =>
    apiClient.get<{ success: boolean; data: { follower_ids: string[] } }>(`/users/${userId}/followers`).then((r) => r.data.data),

  getFollowing: (userId: string) =>
    apiClient.get<{ success: boolean; data: { following_ids: string[] } }>(`/users/${userId}/following`).then((r) => r.data.data),
};
