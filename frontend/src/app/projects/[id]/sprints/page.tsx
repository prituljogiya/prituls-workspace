'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { RoleGuard } from '@/components/RoleGuard';
import { ArrowLeft, Plus, Play, Square, TrendingDown } from 'lucide-react';
import dynamic from 'next/dynamic';

const LineChart = dynamic(() => import('recharts').then((mod) => mod.LineChart as any), { ssr: false });
const Line = dynamic(() => import('recharts').then((mod) => mod.Line as any), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis as any), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((mod) => mod.YAxis as any), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((mod) => mod.CartesianGrid as any), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip as any), { ssr: false });
const Legend = dynamic(() => import('recharts').then((mod) => mod.Legend as any), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((mod) => mod.ResponsiveContainer as any), {
  ssr: false,
});

export default function SprintsPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [sprints, setSprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState<any>(null);
  const [burndownData, setBurndownData] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && params.id) {
      fetchSprints();
    }
  }, [user, authLoading, params.id, router]);

  const fetchSprints = async () => {
    try {
      const response = await api.get(`/sprints/project/${params.id}`);
      setSprints(response.data.sprints);
    } catch (error) {
      console.error('Failed to fetch sprints:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBurndown = async (sprintId: string) => {
    try {
      const response = await api.get(`/sprints/${sprintId}/burndown`);
      setBurndownData(response.data);
      setSelectedSprint(sprints.find(s => s.id === sprintId));
    } catch (error) {
      console.error('Failed to fetch burndown:', error);
    }
  };

  const createSprint = async (data: any) => {
    try {
      await api.post('/sprints', {
        ...data,
        projectId: params.id,
      });
      setShowCreateModal(false);
      fetchSprints();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create sprint');
    }
  };

  const startSprint = async (sprintId: string) => {
    try {
      await api.patch(`/sprints/${sprintId}/start`);
      fetchSprints();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to start sprint');
    }
  };

  const endSprint = async (sprintId: string) => {
    try {
      await api.patch(`/sprints/${sprintId}/end`);
      fetchSprints();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to end sprint');
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

  return (
    <Layout projectId={params.id as string}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href={`/projects/${params.id}`}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sprints</h1>
              </div>
              <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  New Sprint
                </button>
              </RoleGuard>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Burndown Chart */}
          {burndownData && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Burndown Chart - {selectedSprint?.name}
                </h2>
                <button
                  onClick={() => {
                    setBurndownData(null);
                    setSelectedSprint(null);
                  }}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={burndownData.burndown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="remaining" stroke="#ef4444" name="Remaining Points" />
                  <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="5 5" name="Ideal" />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                Total Story Points: {burndownData.totalStoryPoints}
              </div>
            </div>
          )}

          {/* Sprints List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sprints.map((sprint) => (
              <div key={sprint.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{sprint.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {sprint.startDate && new Date(sprint.startDate).toLocaleDateString()} -{' '}
                      {sprint.endDate && new Date(sprint.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${
                    sprint.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                    sprint.status === 'COMPLETED' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}>
                    {sprint.status}
                  </span>
                </div>

                {sprint.goal && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{sprint.goal}</p>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <span className="font-medium">{sprint._count?.tasks || 0} tasks</span>
                  <span className="text-xs">Created by {sprint.creator?.firstName} {sprint.creator?.lastName}</span>
                </div>

                <div className="flex gap-2">
                  <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
                    {sprint.status === 'PLANNED' && (
                      <button
                        onClick={() => startSprint(sprint.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                      >
                        <Play className="h-4 w-4" />
                        Start
                      </button>
                    )}
                    {sprint.status === 'ACTIVE' && (
                      <button
                        onClick={() => endSprint(sprint.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
                      >
                        <Square className="h-4 w-4" />
                        End
                      </button>
                    )}
                  </RoleGuard>
                  <button
                    onClick={() => fetchBurndown(sprint.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                  >
                    <TrendingDown className="h-4 w-4" />
                    Burndown
                  </button>
                  <Link
                    href={`/projects/${params.id}/sprints/${sprint.id}`}
                    className="flex-1 text-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
                  >
                    View
                  </Link>
                </div>
            </div>
          ))}
        </div>

          {sprints.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <p className="text-gray-600 dark:text-gray-400 mb-4">No sprints yet. Create your first sprint!</p>
              <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Create Sprint
                </button>
              </RoleGuard>
            </div>
          )}
        </main>
      </div>

      {/* Create Sprint Modal */}
      {showCreateModal && (
        <CreateSprintModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createSprint}
        />
      )}
    </Layout>
  );
}

function CreateSprintModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({ name, startDate, endDate, goal });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create Sprint</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Sprint Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
              placeholder="Sprint 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Goal</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 resize-none"
              placeholder="Sprint goal..."
            />
          </div>
          <div className="flex gap-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Create
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

