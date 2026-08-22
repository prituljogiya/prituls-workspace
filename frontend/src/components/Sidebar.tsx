'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Calendar,
  BarChart3,
  Settings,
  Users,
  Building2,
  UserPlus,
  Plus,
  Clock,
  FileText,
  BookOpen,
  GitPullRequest,
  ChevronDown,
  ChevronRight,
  Columns3,
  History,
  Shield,
  Search,
} from 'lucide-react';
import { RoleGuard } from './RoleGuard';
import { usePermissions } from '@/contexts/PermissionContext';
import api from '@/lib/api';

interface SidebarBoard {
  id: string;
  name: string;
  order?: number;
}

interface SidebarProject {
  id: string;
  name: string;
  color?: string | null;
  boards?: SidebarBoard[];
}

interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { can } = usePermissions();
  const [invoicesEnabled, setInvoicesEnabled] = useState(false);
  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');
  const PROJECT_PREVIEW_COUNT = 3;

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

  const pathBoardId = pathname?.match(/\/boards\/([^\/]+)/)?.[1];

  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    setProjectsLoading(true);
    api
      .get('/projects')
      .then((res) => {
        if (cancelled) return;
        const list: SidebarProject[] = res.data.projects || [];
        setProjects(list);
        setExpandedProjects((prev) => {
          const next = { ...prev };
          // Only auto-expand the project you're currently in
          if (extractedProjectId) next[extractedProjectId] = true;
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Keep current project expanded while navigating inside it
  useEffect(() => {
    if (!extractedProjectId) return;
    setExpandedProjects((prev) =>
      prev[extractedProjectId] ? prev : { ...prev, [extractedProjectId]: true }
    );
  }, [extractedProjectId]);

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
        const visible = res.data.invoicesVisibleToUser;
        const enabled = typeof visible === 'boolean' ? visible : !!res.data.project?.invoicesEnabled;
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

    const onToggle = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { projectId?: string; enabled?: boolean }
        | undefined;
      if (!detail || detail.projectId !== extractedProjectId) return;
      setInvoicesEnabled(!!detail.enabled);
    };
    window.addEventListener('pms:invoices-enabled', onToggle);

    return () => {
      cancelled = true;
      window.removeEventListener('pms:invoices-enabled', onToggle);
    };
  }, [extractedProjectId, user]);

  const currentProjectName = useMemo(
    () => projects.find((p) => p.id === extractedProjectId)?.name,
    [projects, extractedProjectId]
  );

  // Current project first, then the rest — collapsed list shows only a few
  const orderedProjects = useMemo(() => {
    if (!extractedProjectId) return projects;
    const current = projects.find((p) => p.id === extractedProjectId);
    if (!current) return projects;
    return [current, ...projects.filter((p) => p.id !== extractedProjectId)];
  }, [projects, extractedProjectId]);

  const filteredProjects = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    if (!q) return orderedProjects;
    return orderedProjects.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      return (p.boards || []).some((b) => b.name.toLowerCase().includes(q));
    });
  }, [orderedProjects, projectQuery]);

  const searching = projectQuery.trim().length > 0;
  const visibleProjects = searching
    ? filteredProjects
    : showAllProjects
      ? orderedProjects
      : orderedProjects.slice(0, PROJECT_PREVIEW_COUNT);
  const hiddenCount = searching ? 0 : Math.max(0, orderedProjects.length - PROJECT_PREVIEW_COUNT);

  const isActive = (path: string) => {
    if (!pathname) return false;
    if (pathname === path) return true;
    // Project overview is exact-match only so nested pages don't highlight it too
    if (/\/projects\/[^/]+$/.test(path)) return false;
    return pathname.startsWith(path + '/');
  };

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const projectLinks = extractedProjectId
    ? [
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
          permission: 'documents.view',
        },
        {
          name: 'Timeline',
          href: `/projects/${extractedProjectId}/timeline`,
          icon: History,
          permission: 'timeline.view',
        },
        {
          name: 'Time Tracking',
          href: `/projects/${extractedProjectId}/time-tracking`,
          icon: Clock,
          permission: 'time.view',
        },
        {
          name: 'Pull Requests',
          href: `/projects/${extractedProjectId}/pull-requests`,
          icon: GitPullRequest,
          permission: 'pullRequests.view',
        },
        {
          name: 'Invoices',
          href: `/projects/${extractedProjectId}/invoices`,
          icon: FileText,
          permission: 'invoices.view',
          requiresInvoicesEnabled: true,
        },
        {
          name: 'Reports',
          href: `/projects/${extractedProjectId}/reports`,
          icon: BarChart3,
          permission: 'reports.view',
        },
        {
          name: 'Settings',
          href: `/projects/${extractedProjectId}/settings`,
          icon: Settings,
          permission: 'projects.manage',
        },
        {
          name: 'Members',
          href: `/projects/${extractedProjectId}/members`,
          icon: Users,
          permission: 'members.manage',
        },
      ]
    : [];

  return (
    <div className="h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <FolderKanban className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900 dark:text-white truncate">
            Pritul&apos;s workspace
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
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

        <RoleGuard permission="workspaces.manage">
          <Link
            href="/workspaces/new"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Building2 className="h-5 w-5" />
            <span>New Workspace</span>
          </Link>
        </RoleGuard>

        {/* Projects + Boards quick access */}
        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
          <div className="px-3 mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Projects
            </p>
            <RoleGuard permission="projects.create">
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-0.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                title="New project"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Link>
            </RoleGuard>
          </div>
          <div className="px-3 mb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={projectQuery}
                onChange={(e) => setProjectQuery(e.target.value)}
                placeholder="Find project or board…"
                className="w-full pl-8 pr-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {projectsLoading && (
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">Loading…</p>
          )}

          {!projectsLoading && searching && filteredProjects.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No matching projects or boards</p>
          )}

          {visibleProjects.map((project) => {
            const expanded = searching || !!expandedProjects[project.id];
            const isCurrent = project.id === extractedProjectId;
            const q = projectQuery.trim().toLowerCase();
            const projectNameMatch = !q || project.name.toLowerCase().includes(q);
            const boards = (project.boards || []).filter(
              (board) => projectNameMatch || board.name.toLowerCase().includes(q)
            );

            return (
              <div key={project.id} className="mb-1">
                <div
                  className={`flex items-center gap-1 rounded-lg ${
                    isCurrent ? 'bg-gray-100 dark:bg-gray-800' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleProject(project.id)}
                    className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 shrink-0"
                    aria-label={expanded ? 'Collapse project' : 'Expand project'}
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex-1 min-w-0 flex items-center gap-2 py-2 pr-2 text-sm font-medium text-gray-800 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400"
                    title={project.name}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: project.color || '#6366f1' }}
                    />
                    <span className="truncate">{project.name}</span>
                  </Link>
                </div>

                {expanded && (
                  <div className="ml-4 pl-3 border-l border-gray-200 dark:border-gray-700 space-y-0.5 mb-1">
                    {boards.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500">No boards</p>
                    ) : (
                      boards.map((board) => {
                        const href = `/projects/${project.id}/boards/${board.id}`;
                        const active = pathBoardId === board.id;
                        return (
                          <Link
                            key={board.id}
                            href={href}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                              active
                                ? 'bg-primary-600 text-white'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                            title={board.name}
                          >
                            <Columns3 className="h-3.5 w-3.5 shrink-0 opacity-80" />
                            <span className="truncate">{board.name}</span>
                          </Link>
                        );
                      })
                    )}
                    <Link
                      href={`/projects/${project.id}/boards`}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                        pathname === `/projects/${project.id}/boards`
                          ? 'text-primary-600 dark:text-primary-400 font-medium'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                    >
                      All boards
                    </Link>
                  </div>
                )}
              </div>
            );
          })}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllProjects((v) => !v)}
              className="w-full mt-1 px-3 py-2 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors text-left"
            >
              {showAllProjects ? 'Show less' : `Show more (${hiddenCount})`}
            </button>
          )}
        </div>

        {/* Current project tools */}
        {extractedProjectId && (
          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 truncate">
              {currentProjectName ? `${currentProjectName}` : 'Project'}
            </p>
            {projectLinks.map((link) => {
              const Icon = link.icon;
              if (link.permission && !can(link.permission)) {
                return null;
              }
              if (
                (link as any).requiresInvoicesEnabled &&
                !can('invoices.manage') &&
                !['WORKSPACE_OWNER', 'PROJECT_MANAGER'].includes(user?.role || '') &&
                !invoicesEnabled
              ) {
                return null;
              }
              if ((link as any).requiresInvoicesEnabled && !can('invoices.view')) {
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
        )}

        {/* Admin Links */}
        <RoleGuard permission="users.manage">
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
            <RoleGuard permission="permissions.manage">
              <Link
                href="/admin/permissions"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive('/admin/permissions')
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Shield className="h-5 w-5" />
                <span>Permissions</span>
              </Link>
            </RoleGuard>
          </div>
        </RoleGuard>
      </nav>
    </div>
  );
}
