'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { RoleGuard } from '@/components/RoleGuard';
import { BoardSwitcher } from '@/components/BoardSwitcher';
import { PageHeader, PageSpinner } from '@/components/PageHeader';
import { usePermissions } from '@/contexts/PermissionContext';
import {
  Settings,
  Users,
  History,
  Columns3,
  ListTodo,
  Calendar,
  BarChart3,
  BookOpen,
  Clock,
  FileText,
  ArrowRight,
} from 'lucide-react';

const SHORTCUTS = [
  { name: 'Boards', href: 'boards', icon: Columns3, hint: 'Kanban boards', permission: null },
  { name: 'Backlog', href: 'backlog', icon: ListTodo, hint: 'Unplanned work', permission: null },
  { name: 'Sprints', href: 'sprints', icon: Calendar, hint: 'Sprint planning', permission: null },
  { name: 'Documents', href: 'documents', icon: BookOpen, hint: 'Project docs', permission: 'documents.view' },
  { name: 'Timeline', href: 'timeline', icon: History, hint: 'Activity', permission: 'timeline.view' },
  { name: 'Time', href: 'time-tracking', icon: Clock, hint: 'Hours logged', permission: 'time.view' },
  { name: 'Invoices', href: 'invoices', icon: FileText, hint: 'Billing', permission: 'invoices.view' },
  { name: 'Reports', href: 'reports', icon: BarChart3, hint: 'Progress', permission: 'reports.view' },
];

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const { can } = usePermissions();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invoicesVisible, setInvoicesVisible] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user && params.id) {
      fetchProject();
    }
  }, [user, authLoading, params.id, router]);

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${params.id}`);
      setProject(response.data.project);
      if (typeof response.data.invoicesVisibleToUser === 'boolean') {
        setInvoicesVisible(response.data.invoicesVisibleToUser);
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <Layout projectId={params.id as string}>
        <PageSpinner />
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-600 dark:text-gray-300">Project not found</div>
      </Layout>
    );
  }

  const members = project.members || [];
  const boards = project.boards || [];

  return (
    <Layout projectId={params.id as string}>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: project.color || '#0ea5e9' }}
            />
            {project.name}
          </span>
        }
        subtitle={project.description || 'No description yet'}
        actions={
          <>
            <BoardSwitcher projectId={params.id as string} />
            <RoleGuard permission="timeline.view">
              <Link href={`/projects/${params.id}/timeline`} className="ui-btn-ghost">
                <History className="h-4 w-4" />
                Timeline
              </Link>
            </RoleGuard>
            <RoleGuard permission="members.manage">
              <Link href={`/projects/${params.id}/members`} className="ui-btn-secondary">
                <Users className="h-4 w-4" />
                {members.length}
              </Link>
            </RoleGuard>
            <RoleGuard permission="projects.manage">
              <Link href={`/projects/${params.id}/settings`} className="ui-btn-secondary">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </RoleGuard>
          </>
        }
      />

      <main className="px-4 sm:px-6 pb-8 max-w-6xl">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="ui-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Boards</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {project._count?.boards ?? boards.length}
            </p>
          </div>
          <div className="ui-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Tasks</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {project._count?.tasks ?? 0}
            </p>
          </div>
          <div className="ui-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Sprints</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {project._count?.sprints ?? 0}
            </p>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Jump to
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {SHORTCUTS.map((item) => {
            if (item.permission && !can(item.permission)) return null;
            if (item.href === 'invoices' && !invoicesVisible && !can('invoices.manage')) return null;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={`/projects/${params.id}/${item.href}`}
                className="ui-card p-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all group"
              >
                <div className="h-9 w-9 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3">
                  <Icon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.hint}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Boards
          </h2>
          <Link
            href={`/projects/${params.id}/boards`}
            className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
          >
            View all
          </Link>
        </div>
        {boards.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 ui-card p-6">
            No boards yet. Open Boards to create one.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {boards.map((board: any) => (
              <Link
                key={board.id}
                href={`/projects/${params.id}/boards/${board.id}`}
                className="ui-card p-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                    <Columns3 className="h-4 w-4 text-gray-500 dark:text-gray-300" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">{board.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                      {board.description || 'Open board'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </Layout>
  );
}
