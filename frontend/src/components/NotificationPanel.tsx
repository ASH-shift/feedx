'use client';

import { useEffect } from 'react';
import { X, Bell, UserPlus, FileText, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { useNotificationStore, Notification } from '@/store/notificationStore';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function NotificationItem({ notification }: { notification: Notification }) {
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true });
    } catch {
      return 'just now';
    }
  })();

  return (
    <div
      className={clsx(
        'flex gap-3 px-4 py-3 border-b border-slate-800/60 transition-colors',
        !notification.read ? 'bg-blue-600/5' : 'hover:bg-slate-800/30',
      )}
    >
      <div
        className={clsx(
          'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
          notification.type === 'new_post'
            ? 'bg-blue-600/20 text-blue-400'
            : 'bg-green-600/20 text-green-400',
        )}
      >
        {notification.type === 'new_post' ? (
          <FileText className="w-4 h-4" />
        ) : (
          <UserPlus className="w-4 h-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white leading-snug">{notification.message}</p>
        <p className="text-xs text-slate-500 mt-0.5">{timeAgo}</p>
      </div>
      {!notification.read && (
        <div className="flex-shrink-0 mt-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        </div>
      )}
    </div>
  );
}

export default function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const { notifications, markAllRead } = useNotificationStore();

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-slate-900 border-l border-slate-800 flex flex-col animate-slide-in shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-400" />
            <h2 className="text-white font-semibold">Notifications</h2>
            {notifications.length > 0 && (
              <span className="text-slate-500 text-sm">({notifications.length})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.read) && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-600/10 rounded-lg transition-all"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                <Bell className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-white font-semibold mb-1">No notifications yet</p>
              <p className="text-slate-500 text-sm">
                When someone follows you or posts new content, you'll see it here.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
