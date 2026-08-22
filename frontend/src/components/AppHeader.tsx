'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { RoleGuard } from './RoleGuard';
import { NotificationBell } from './NotificationBell';
import {
  ChevronDown,
  KeyRound,
  LogOut,
  Moon,
  Settings,
  Sun,
  UserPlus,
  FileText,
  Github,
  FileSignature,
  Shield,
} from 'lucide-react';

export function AppHeader() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` || 'U';

  return (
    <header className="sticky top-0 z-30 h-14 shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur px-4 flex items-center justify-end gap-2">
      <RoleGuard permission="users.manage">
        <Link
          href="/admin/users"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Users
        </Link>
      </RoleGuard>
      <RoleGuard permission="permissions.manage">
        <Link
          href="/admin/permissions"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Shield className="h-4 w-4" />
          Permissions
        </Link>
      </RoleGuard>
      <RoleGuard permission="invoices.manage">
        <Link
          href="/admin/invoices"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <FileText className="h-4 w-4" />
          All invoices
        </Link>
      </RoleGuard>
      <RoleGuard permission="settings.manage">
        <Link
          href="/admin/integrations"
          className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Github className="h-4 w-4" />
          Integrations
        </Link>
      </RoleGuard>
      <RoleGuard permission="contracts.manage">
        <Link
          href="/admin/contracts"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <FileSignature className="h-4 w-4" />
          Contracts
        </Link>
      </RoleGuard>

      <NotificationBell />

      <button
        type="button"
        onClick={toggleTheme}
        className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
          <div className="hidden md:block text-left min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[140px]">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[140px]">
              {user.role?.replace(/_/g, ' ')}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1 z-50"
          >
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
            </div>

            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
            >
              <Settings className="h-4 w-4" />
              Profile / Account
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
            >
              <KeyRound className="h-4 w-4" />
              Change Password
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                toggleTheme();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  Dark Mode
                </>
              )}
            </button>
            <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                logout();
                window.location.href = '/login';
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
