import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isHydrated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isHydrated: false,

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('feed_user', JSON.stringify(user));
      localStorage.setItem('feed_token', token);
    }
    set({ user, token });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('feed_user');
      localStorage.removeItem('feed_token');
    }
    set({ user: null, token: null });
  },

  hydrate: () => {
    if (typeof window !== 'undefined') {
      const rawUser = localStorage.getItem('feed_user');
      const token = localStorage.getItem('feed_token');
      if (rawUser && token) {
        try {
          const user: User = JSON.parse(rawUser);
          set({ user, token, isHydrated: true });
          return;
        } catch {
          localStorage.removeItem('feed_user');
          localStorage.removeItem('feed_token');
        }
      }
    }
    set({ isHydrated: true });
  },
}));
