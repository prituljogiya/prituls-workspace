'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { ArrowLeft, Plus, Play, Square, TrendingDown, MoveRight } from 'lucide-react';
import dynamic from 'next/dynamic';

const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });

export default function SprintDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [sprint, setSprint] = useState<any>(null);
  const [backlogTasks, setBacklogTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [burndownData, setBurndownData] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && params.sprintId) {
      fetchSprint();
      fetchBurndown();
    }
  }, [user, authLoading, params.sprintId, router]);

  useEffect(() => {
    if (sprint) {
      fetchBacklog();
    }
  }, [sprint]);

  const fetchSprint = async () => {
    try {
      const response = await api.get(`/sprints/${params.sprintId}`);
      setSprint(response.data.sprint);
    } catch (error) {
      console.error('Failed to fetch sprint:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBacklog = async () => {
    try {
      // Fetch all tasks from project (both backlog and board tasks)
      const response = await api.get(`/tasks/project/${params.id}`);
      const allTasks = response.data.tasks || [];
      
      // Filter out tasks already in this sprint
      const sprintTaskIds = new Set(sprint?.tasks?.map((t: any) => t.id) || []);
      
      // Show tasks that are either in backlog OR on boards but not in any sprint
      const availableTasks = allTasks.filter((task: any) => 
        !sprintTaskIds.has(task.id) && (!task.sprintId || task.sprintId === null)
      );
      
      setBacklogTasks(availableTasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      setBacklogTasks([]);
    }
  };

  const fetchBurndown = async () => {
    try {
      const response = await api.get(`/sprints/${params.sprintId}/burndown`);
      if (response.data && response.data.burndown) {
        setBurndownData(response.data);
      } else {
        console.warn('Burndown data missing or invalid:', response.data);
        setBurndownData(null);
      }
    } catch (error: any) {
      console.error('Failed to fetch burndown:', error);
      // If sprint dates are not set, don't show error, just don't show chart
      if (error.response?.status !== 400) {
        console.error('Burndown fetch error details:', error.response?.data);
      }
      setBurndownData(null);
    }
  };

  const addTaskToSprint = async (taskId: string) => {
    try {
      await api.patch(`/sprints/${params.sprintId}/tasks/${taskId}`);
      await fetchSprint();
      fetchBacklog();
      fetchBurndown(); // Refresh chart
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add task to sprint');
    }
  };

  const removeTaskFromSprint = async (taskId: string) => {
    try {
      await api.delete(`/sprints/${params.sprintId}/tasks/${taskId}`);
      await fetchSprint();
      fetchBurndown(); // Refresh chart
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove task from sprint');
    }
  };

  if (loading || authLoading) {
    return (
      <Layout projectId={params.id as string}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!sprint) {
    return (
      <Layout projectId={params.id as string}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-900 dark:text-white">Sprint not found</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout projectId={params.id as string}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href={`/projects/${params.id}/sprints`}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{sprint.name}</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {sprint.startDate && new Date(sprint.startDate).toLocaleDateString()} -{' '}
                    {sprint.endDate && new Date(sprint.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded ${
                sprint.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                sprint.status === 'COMPLETED' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}>
                {sprint.status}
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Burndown Chart */}
          {sprint.startDate && sprint.endDate ? (
            burndownData && burndownData.burndown && burndownData.burndown.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Burndown Chart</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart 
                    data={burndownData.burndown}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280"
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      domain={[0, 'auto']}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1f2937', 
                        border: '1px solid #374151',
                        borderRadius: '6px',
                        color: '#fff'
                      }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend 
                      wrapperStyle={{ color: '#6b7280' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="remaining" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      name="Remaining Points"
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="ideal" 
                      stroke="#94a3b8" 
                      strokeDasharray="5 5" 
                      strokeWidth={2}
                      name="Ideal"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  Total Story Points: {burndownData.totalStoryPoints || 0}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Burndown Chart</h2>
                <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <p className="mb-2">Loading chart data...</p>
                    <p className="text-sm">Make sure tasks have story points assigned</p>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Burndown Chart</h2>
              <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                <p>Please set sprint start and end dates to view burndown chart</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sprint Tasks */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sprint Tasks ({sprint.tasks?.length || 0})</h2>
                <div className="space-y-2">
                  {sprint.tasks?.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No tasks in this sprint</p>
                  ) : (
                    sprint.tasks?.map((task: any) => (
                      <div key={task.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <Link
                          href={`/projects/${params.id}/tasks/${task.id}`}
                          className="flex-1 font-medium text-sm text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {task.title}
                        </Link>
                        <div className="flex items-center gap-2">
                          {task.storyPoints && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{task.storyPoints} SP</span>
                          )}
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            task.status === 'DONE' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                            task.status === 'IN_PROGRESS' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                            'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                          }`}>
                            {task.status.replace('_', ' ')}
                          </span>
                          <button
                            onClick={() => removeTaskFromSprint(task.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Backlog & Board Tasks */}
            <div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Add Tasks</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">From backlog or boards</p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {backlogTasks.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No tasks in backlog</p>
                  ) : (
                    backlogTasks.slice(0, 10).map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{task.title}</span>
                        <button
                          onClick={() => addTaskToSprint(task.id)}
                          className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title="Add to sprint"
                        >
                          <MoveRight className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
}

