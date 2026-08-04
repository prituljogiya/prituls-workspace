'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Calendar,
  BarChart3,
  Settings,
  Users,
  Building2,
  LogOut,
  UserPlus,
  Plus,
  Moon,
  Sun,
  Clock,
  FileText,
  KeyRound,
  BookOpen,
} from 'lucide-react';
import { RoleGuard } from './RoleGuard';
import { hasRole, canViewInvoices } from '@/utils/rbac';
import api from '@/lib/api';

interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [invoicesEnabled, setInvoicesEnabled] = useState(false);

  // Extract projectId from pathname if not provided.
  // Ignore reserved segments like "new" so /projects/new doesn't fake a project.
  const RESERVED_PROJECT_SEGMENTS = new Set(['new']);
  const pathProjectId = pathname?.match(/\/projects\/([^\/]+)/)?.[1];
  const extractedProjectId =
    projectId && !RESERVED_PROJECT_SEGMENTS.has(projectId)
      ? projectId
      : pathProjectId && !RESERVED_PROJECT_SEGMENTS.has(pathProjectId)
        ? pathProjectId
        : undefined;

  useEffect(() => {
    if (!extractedProjectId || !user) {
      setInvoicesEnabled(false);
      return;
    }

    const cacheKey = `pms:inv:${extractedProjectId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached === '0' || cached === '1') {
        setInvoicesEnabled(cached === '1');
      }
    } catch {
      /* ignore */
    }

    let cancelled = false;
    api
      .get(`/projects/${extractedProjectId}`)
      .then((res) => {
        if (cancelled) return;
        const enabled = !!res.data.project?.invoicesEnabled;
        setInvoicesEnabled(enabled);
        try {
          sessionStorage.setItem(cacheKey, enabled ? '1' : '0');
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (!cancelled) setInvoicesEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [extractedProjectId, user]);

  const isActive = (path: string) => {
    if (!pathname) return false;
    if (pathname === path) return true;
    // Project overview is exact-match only so nested pages don't highlight it too
    if (/\/projects\/[^/]+$/.test(path)) return false;
    return pathname.startsWith(path + '/');
  };

  const projectLinks = extractedProjectId ? [
    {
      name: 'Overview',
      href: `/projects/${extractedProjectId}`,
      icon: FolderKanban,
    },
    {
      name: 'Boards',
      href: `/projects/${extractedProjectId}/boards`,
      icon: LayoutDashboard,
    },
    {
      name: 'Backlog',
      href: `/projects/${extractedProjectId}/backlog`,
      icon: ListTodo,
    },
    {
      name: 'Sprints',
      href: `/projects/${extractedProjectId}/sprints`,
      icon: Calendar,
    },
    {
      name: 'Documents',
      href: `/projects/${extractedProjectId}/documents`,
      icon: BookOpen,
    },
    {
      name: 'Time Tracking',
      href: `/projects/${extractedProjectId}/time-tracking`,
      icon: Clock,
      roles: ['SUPER_ADMIN', 'TEAM_MEMBER', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'],
    },
    {
      name: 'Invoices',
      href: `/projects/${extractedProjectId}/invoices`,
      icon: FileText,
      roles: ['SUPER_ADMIN', 'VIEWER', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'],
      requiresInvoicesEnabled: true,
    },
    {
      name: 'Reports',
      href: `/projects/${extractedProjectId}/reports`,
      icon: BarChart3,
      roles: ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'],
    },
    {
      name: 'Settings',
      href: `/projects/${extractedProjectId}/settings`,
      icon: Settings,
      roles: ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'],
    },
    {
      name: 'Members',
      href: `/projects/${extractedProjectId}/members`,
      icon: Users,
      roles: ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'],
    },
  ] : [];

  return (
    <div className="h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <FolderKanban className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900 dark:text-white truncate">Pritul&apos;s workspace</span>
        </Link>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <Link href="/settings" className="flex items-center gap-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 p-1 -m-1 transition-colors">
          <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate text-gray-900 dark:text-white">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{user?.email}</p>
            <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">Account settings</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {/* Main Links */}
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            isActive('/dashboard') 
              ? 'bg-primary-600 text-white' 
              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboard</span>
        </Link>

        <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER']}>
          <Link
            href="/workspaces/new"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Building2 className="h-5 w-5" />
            <span>New Workspace</span>
          </Link>
        </RoleGuard>

        <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
          <Link
            href="/projects/new"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>New Project</span>
          </Link>
        </RoleGuard>

        {/* Project Links */}
        {extractedProjectId && (
          <>
            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
              <p className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Project
              </p>
              {projectLinks.map((link) => {
                const Icon = link.icon;
                // Check if link has role restrictions
                if (link.roles && user?.role && !hasRole(user.role, link.roles)) {
                  return null;
                }
                if ((link as any).requiresInvoicesEnabled && !invoicesEnabled) {
                  return null;
                }
                if ((link as any).requiresInvoicesEnabled && user?.role && !canViewInvoices(user.role)) {
                  return null;
                }
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive(link.href)
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{link.name}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* Admin Links */}
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER']}>
          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Admin
            </p>
            <Link
              href="/admin/users"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive('/admin/users')
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <UserPlus className="h-5 w-5" />
              <span>Manage Users</span>
            </Link>
          </div>
        </RoleGuard>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
        <Link
          href="/settings"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            isActive('/settings')
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <KeyRound className="h-5 w-5" />
          <span>Change Password</span>
        </Link>
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-5 w-5" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-5 w-5" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

