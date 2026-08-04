'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { ArrowLeft, TrendingUp, BarChart3, Users } from 'lucide-react';
import dynamic from 'next/dynamic';

const ProductivityChart = dynamic(
  () => import('@/components/ReportsCharts').then((m) => m.ProductivityChart),
  { ssr: false, loading: () => <ChartLoading /> }
);
const DistributionPie = dynamic(
  () => import('@/components/ReportsCharts').then((m) => m.DistributionPie),
  { ssr: false, loading: () => <ChartLoading /> }
);
const VelocityChart = dynamic(
  () => import('@/components/ReportsCharts').then((m) => m.VelocityChart),
  { ssr: false, loading: () => <ChartLoading /> }
);

function ChartLoading() {
  return (
    <div className="h-[300px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
      Loading chart...
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, loading: authLoading } = useAuth();
  const [productivity, setProductivity] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any>(null);
  const [velocity, setVelocity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && projectId) {
      fetchReports();
    }
  }, [user, authLoading, projectId, router]);

  const fetchReports = async () => {
    try {
      setError('');
      const [prodRes, statusRes, velRes] = await Promise.all([
        api.get(`/reports/productivity/${projectId}`),
        api.get(`/reports/status/${projectId}`),
        api.get(`/reports/velocity/${projectId}`),
      ]);
      setProductivity(prodRes.data.productivity || []);
      setStatusData(statusRes.data);
      setVelocity(velRes.data);
    } catch (err: any) {
      console.error('Failed to fetch reports:', err);
      setError(err.response?.data?.error || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const productivityChartData = useMemo(
    () =>
      productivity.map((row) => ({
        name: row.user?.firstName || row.user?.email || 'User',
        totalTasks: row.totalTasks || 0,
        completedTasks: row.completedTasks || 0,
      })),
    [productivity]
  );

  const statusChartData = useMemo(
    () =>
      statusData
        ? [
            { name: 'To Do', value: statusData.statusCounts?.TODO || 0 },
            { name: 'In Progress', value: statusData.statusCounts?.IN_PROGRESS || 0 },
            { name: 'In Review', value: statusData.statusCounts?.IN_REVIEW || 0 },
            { name: 'Done', value: statusData.statusCounts?.DONE || 0 },
            { name: 'Blocked', value: statusData.statusCounts?.BLOCKED || 0 },
          ]
        : [],
    [statusData]
  );

  const typeChartData = useMemo(
    () =>
      statusData
        ? [
            { name: 'Task', value: statusData.typeCounts?.TASK || 0 },
            { name: 'Bug', value: statusData.typeCounts?.BUG || 0 },
            { name: 'Story', value: statusData.typeCounts?.STORY || 0 },
            { name: 'Epic', value: statusData.typeCounts?.EPIC || 0 },
          ]
        : [],
    [statusData]
  );

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Layout projectId={projectId}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center gap-4">
              <Link
                href={`/projects/${projectId}`}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
            </div>
          </div>
        </header>

        <main className="p-6">
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Productivity
              </h2>
              <ProductivityChart data={productivityChartData} />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Task Status Distribution
              </h2>
              <DistributionPie
                data={statusChartData}
                emptyMessage="No board tasks yet. Create tasks to see status distribution."
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Issue Types</h2>
              <DistributionPie
                data={typeChartData}
                emptyMessage="No board tasks yet. Create tasks to see issue types."
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Sprint Velocity
              </h2>
              <VelocityChart
                data={velocity?.velocity || []}
                averageVelocity={velocity?.averageVelocity || 0}
              />
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
}
