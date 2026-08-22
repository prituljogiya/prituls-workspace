'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  BarChart3,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { RoleGuard } from '@/components/RoleGuard';
import { PageHeader, PageSpinner, EmptyState } from '@/components/PageHeader';
import dynamic from 'next/dynamic';

const ProductivityChart = dynamic(
  () => import('@/components/ReportsCharts').then((m) => m.ProductivityChart),
  { ssr: false, loading: () => <ChartLoading /> }
);
const DistributionPie = dynamic(
  () => import('@/components/ReportsCharts').then((m) => m.DistributionPie),
  { ssr: false, loading: () => <ChartLoading /> }
);

function ChartLoading() {
  return (
    <div className="h-[300px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
      Loading chart...
    </div>
  );
}

interface DashboardData {
  projects: any[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    blockedTasks: number;
    tasksByStatus: Record<string, number>;
    tasksByType: Record<string, number>;
  };
  charts?: {
    byStatus: Array<{ name: string; value: number }>;
    byType: Array<{ name: string; value: number }>;
    byProject: Array<{
      projectId: string;
      name: string;
      totalTasks: number;
      completedTasks: number;
      inProgressTasks: number;
    }>;
  };
  assignedTasks: any[];
  tasksDueSoon: any[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      setData(null);
      router.push('/login');
      return;
    }

    if (user) {
      setLoading(true);
      setData(null);
      fetchDashboard();
    }
  }, [user?.id, authLoading, router]);

  const fetchDashboard = async () => {
    try {
      const response = await api.get('/dashboard', {
        params: { _u: user?.id, _t: Date.now() },
      });
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusChartData = useMemo(() => {
    if (data?.charts?.byStatus) return data.charts.byStatus;
    if (!data?.stats?.tasksByStatus) return [];
    const s = data.stats.tasksByStatus;
    return [
      { name: 'To Do', value: s.TODO || 0 },
      { name: 'In Progress', value: s.IN_PROGRESS || 0 },
      { name: 'In Review', value: s.IN_REVIEW || 0 },
      { name: 'Done', value: s.DONE || 0 },
      { name: 'Blocked', value: s.BLOCKED || 0 },
    ];
  }, [data]);

  const typeChartData = useMemo(() => {
    if (data?.charts?.byType) return data.charts.byType;
    if (!data?.stats?.tasksByType) return [];
    const t = data.stats.tasksByType;
    return [
      { name: 'Task', value: t.TASK || 0 },
      { name: 'Bug', value: t.BUG || 0 },
      { name: 'Story', value: t.STORY || 0 },
      { name: 'Epic', value: t.EPIC || 0 },
    ];
  }, [data]);

  const projectChartData = useMemo(() => {
    if (data?.charts?.byProject?.length) {
      return data.charts.byProject.map((p) => ({
        name: p.name,
        totalTasks: p.totalTasks,
        completedTasks: p.completedTasks,
      }));
    }
    return (data?.projects || []).map((p) => ({
      name: p.name,
      totalTasks: p._count?.tasks || 0,
      completedTasks: 0,
    }));
  }, [data]);

  if (loading || authLoading) {
    return (
      <Layout>
        <PageSpinner />
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="p-6 text-gray-900 dark:text-white">Error loading dashboard</div>
      </Layout>
    );
  }

  const firstName = user?.firstName || 'there';
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Layout>
      <PageHeader
        title={`${hello}, ${firstName}`}
        subtitle="Your projects, tasks, and progress in one place."
        actions={
          <RoleGuard permission="projects.create">
            <Link href="/projects/new" className="ui-btn-primary">
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </RoleGuard>
        }
      />

        <main className="px-4 sm:px-6 pb-8">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {[
              { label: 'Total tasks', value: data.stats.totalTasks, icon: FolderKanban, tint: 'text-primary-600' },
              { label: 'Completed', value: data.stats.completedTasks, icon: CheckCircle2, tint: 'text-emerald-600' },
              { label: 'In progress', value: data.stats.inProgressTasks, icon: Clock, tint: 'text-sky-600' },
              { label: 'Pending', value: data.stats.pendingTasks, icon: AlertCircle, tint: 'text-amber-600' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="ui-card p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {stat.label}
                      </p>
                      <p className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white mt-1">
                        {stat.value}
                      </p>
                    </div>
                    <Icon className={`h-8 w-8 ${stat.tint} opacity-80`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Projects */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Projects</h2>
            {data.projects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                description="Create a project to start boards, tasks, and invoices."
                action={
                  <RoleGuard permission="projects.create">
                    <Link href="/projects/new" className="ui-btn-primary">
                      <Plus className="h-4 w-4" />
                      New Project
                    </Link>
                  </RoleGuard>
                }
              />
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.projects.map((project) => (
                <div
                  key={project.id}
                  className="ui-card overflow-hidden hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800 transition-all"
                >
                  <div className="h-1.5" style={{ backgroundColor: project.color || '#0ea5e9' }} />
                  <div className="p-5">
                  <Link href={`/projects/${project.id}`}>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                      {project.description || 'No description'}
                    </p>
                  </Link>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                    <span>{project._count?.tasks || 0} tasks</span>
                    <span>{project._count?.boards || 0} boards</span>
                  </div>
                  {project.boards?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {project.boards.slice(0, 4).map((board: any) => (
                        <Link
                          key={board.id}
                          href={`/projects/${project.id}/boards/${board.id}`}
                          className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-primary-100 dark:hover:bg-primary-900/40 hover:text-primary-700 dark:hover:text-primary-300"
                        >
                          {board.name}
                        </Link>
                      ))}
                      {project.boards.length > 4 && (
                        <Link
                          href={`/projects/${project.id}/boards`}
                          className="px-2 py-1 text-xs rounded-md text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          +{project.boards.length - 4} more
                        </Link>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>

          {/* Project Reports Charts */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Project Reports
              </h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="ui-card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Tasks by Project
                </h3>
                <ProductivityChart data={projectChartData} />
              </div>

              <div className="ui-card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Task Status
                </h3>
                <DistributionPie
                  data={statusChartData}
                  emptyMessage="No tasks yet. Create tasks in a project to see status charts."
                />
              </div>

              <div className="ui-card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Issue Types
                </h3>
                <DistributionPie
                  data={typeChartData}
                  emptyMessage="No tasks yet. Create tasks to see issue type charts."
                />
              </div>

              <div className="ui-card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Projects Overview
                </h3>
                {data.projects.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-16 text-sm">
                    No projects yet.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {(data.charts?.byProject || []).map((project) => {
                      const pct =
                        project.totalTasks > 0
                          ? Math.round((project.completedTasks / project.totalTasks) * 100)
                          : 0;
                      return (
                        <Link
                          key={project.projectId}
                          href={`/projects/${project.projectId}/reports`}
                          className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {project.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {project.completedTasks}/{project.totalTasks} done
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-green-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{pct}% complete</p>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Assigned Tasks */}
          {data.assignedTasks?.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                My Assigned Tasks
              </h2>
              <div className="ui-card overflow-hidden">
                <div className="divide-y dark:divide-gray-700">
                  {data.assignedTasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/projects/${task.project.id}/tasks/${task.id}`}
                      className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">{task.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{task.project.name}</p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            task.status === 'DONE'
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                              : task.status === 'IN_PROGRESS'
                                ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
    </Layout>
  );
}
