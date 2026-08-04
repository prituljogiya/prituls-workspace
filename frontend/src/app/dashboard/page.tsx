'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  LayoutDashboard,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  BarChart3,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { RoleGuard } from '@/components/RoleGuard';
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
      router.push('/login');
      return;
    }

    if (user) {
      fetchDashboard();
    }
  }, [user, authLoading, router]);

  const fetchDashboard = async () => {
    try {
      const response = await api.get('/dashboard');
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-gray-900 dark:text-white">Error loading dashboard</div>;
  }

  return (
    <Layout>
      <div className="min-h-screen">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <LayoutDashboard className="h-8 w-8 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tasks</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {data.stats.totalTasks}
                  </p>
                </div>
                <FolderKanban className="h-12 w-12 text-primary-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                    {data.stats.completedTasks}
                  </p>
                </div>
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">In Progress</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                    {data.stats.inProgressTasks}
                  </p>
                </div>
                <Clock className="h-12 w-12 text-blue-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</p>
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">
                    {data.stats.pendingTasks}
                  </p>
                </div>
                <AlertCircle className="h-12 w-12 text-yellow-500" />
              </div>
            </div>
          </div>

          {/* Projects */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Projects</h2>
              <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
                <Link
                  href="/projects/new"
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4" />
                  New Project
                </Link>
              </RoleGuard>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {project.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {project.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>{project._count.tasks} tasks</span>
                    <span>{project._count.boards} boards</span>
                  </div>
                </Link>
              ))}
            </div>
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
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Tasks by Project
                </h3>
                <ProductivityChart data={projectChartData} />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Task Status
                </h3>
                <DistributionPie
                  data={statusChartData}
                  emptyMessage="No tasks yet. Create tasks in a project to see status charts."
                />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Issue Types
                </h3>
                <DistributionPie
                  data={typeChartData}
                  emptyMessage="No tasks yet. Create tasks to see issue type charts."
                />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
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
          {data.assignedTasks.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                My Assigned Tasks
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
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
      </div>
    </Layout>
  );
}
