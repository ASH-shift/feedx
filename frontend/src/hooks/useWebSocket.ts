'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export function useWebSocket() {
  const { user } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!user || !mountedRef.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        retryCountRef.current = 0;
        // Send auth message after connection
        ws.send(JSON.stringify({ type: 'auth', userId: user.id }));
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data as string);

          if (msg.type === 'new_post') {
            const data = msg.data as {
              postId: string;
              userId: string;
              username: string;
              content: string;
              timestamp: string;
            };
            addNotification({
              id: `post-${data.postId}-${Date.now()}`,
              type: 'new_post',
              message: `${data.username} posted: "${data.content.slice(0, 60)}${data.content.length > 60 ? '…' : ''}"`,
              timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
              read: false,
            });
          } else if (msg.type === 'new_follower') {
            const data = msg.data as {
              followerId: string;
              followerUsername: string;
              timestamp: string;
            };
            addNotification({
              id: `follow-${data.followerId}-${Date.now()}`,
              type: 'new_follower',
              message: `${data.followerUsername} started following you`,
              timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
              read: false,
            });
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        if (retryCountRef.current < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, retryCountRef.current);
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            if (mountedRef.current) connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket not available (SSR) or connection error — retry
      if (retryCountRef.current < MAX_RETRIES && mountedRef.current) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryCountRef.current);
        retryCountRef.current += 1;
        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      }
    }
  }, [user, addNotification]);

  useEffect(() => {
    mountedRef.current = true;

    if (user) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent retry on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user, connect]);
}
