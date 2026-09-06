'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Zap, Home, User, Bell, LogOut, PenSquare, X, Menu } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import CreatePostModal from './CreatePostModal';
import NotificationPanel from './NotificationPanel';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Initialize WebSocket connection from Navbar so it persists across pages
  useWebSocket();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navLinks = [
    { href: '/feed', label: 'Home', icon: Home },
    { href: user ? `/users/${user.id}` : '/login', label: 'Profile', icon: User },
  ];

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 px-2 py-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600">
          <Zap className="w-5 h-5 text-white fill-white" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">FeedX</span>
      </div>

      {/* Navigation links */}
      <nav className="flex flex-col gap-1 flex-1">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setIsMobileMenuOpen(false)}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
              pathname === href || (href !== '/feed' && pathname.startsWith(href))
                ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800',
            )}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {label}
          </Link>
        ))}

        {/* Notifications button */}
        <button
          onClick={() => {
            setIsNotifPanelOpen(true);
            setIsMobileMenuOpen(false);
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-150 relative"
        >
          <div className="relative flex-shrink-0">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          Notifications
        </button>

        {/* New Post button */}
        <button
          onClick={() => {
            setIsPostModalOpen(true);
            setIsMobileMenuOpen(false);
          }}
          className="flex items-center gap-3 px-3 py-2.5 mt-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all duration-150 shadow-lg shadow-blue-600/20"
        >
          <PenSquare className="w-5 h-5 flex-shrink-0" />
          New Post
        </button>
      </nav>

      {/* User section at bottom */}
      {user && (
        <div className="mt-auto pt-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-800 transition-colors">
            <div
              className={clsx(
                'w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0',
                getAvatarColor(user.username),
              )}
            >
              {user.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{user.username}</p>
              <p className="text-slate-400 text-xs truncate">@{user.username}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-400/10"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-slate-900 border-r border-slate-800 p-4 fixed left-0 top-0 z-30">
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-lg font-bold text-white">FeedX</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNotifPanelOpen(true)}
            className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold px-0.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsMobileMenuOpen((o) => !o)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile slide-down menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-20 pt-14">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative bg-slate-900 border-b border-slate-800 p-4 flex flex-col gap-1 animate-fade-in">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all',
                  pathname === href
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800',
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}
            <button
              onClick={() => {
                setIsPostModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all mt-2"
            >
              <PenSquare className="w-5 h-5" />
              New Post
            </button>
            {user && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-400/10 transition-all mt-1"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modals / panels */}
      <CreatePostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSuccess={() => setIsPostModalOpen(false)}
      />

      <NotificationPanel
        isOpen={isNotifPanelOpen}
        onClose={() => setIsNotifPanelOpen(false)}
      />
    </>
  );
}

export function getAvatarColor(username: string): string {
  const colors = [
    'bg-blue-600',
    'bg-green-600',
    'bg-purple-600',
    'bg-orange-600',
    'bg-pink-600',
    'bg-red-600',
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
