'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import api from '@/lib/api';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (full = false) => {
    try {
      if (full) {
        const { data } = await api.get('/notifications');
        setItems(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      } else {
        const { data } = await api.get('/notifications/unread-count');
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      /* ignore — user may be logging out */
    }
  }, []);

  useEffect(() => {
    load(false);
    // Lighter poll — full Neon round-trips are slow from local India → US
    const interval = setInterval(() => load(false), 60000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await load(true);
      setLoading(false);
    }
  };

  const markRead = async (n: NotificationItem) => {
    if (!n.readAt) {
      try {
        await api.post(`/notifications/${n.id}/read`);
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className="relative p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-3 py-6 text-sm text-center text-gray-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-sm text-center text-gray-500">No notifications yet</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markRead(n)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    !n.readAt ? 'bg-primary-50/50 dark:bg-primary-950/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary-500 shrink-0" />
                    )}
                    <div className={`min-w-0 flex-1 ${n.readAt ? 'pl-4' : ''}`}>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mt-0.5">
                        {n.message}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">{formatTime(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
