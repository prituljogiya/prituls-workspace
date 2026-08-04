'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { RoleGuard } from '@/components/RoleGuard';
import { ArrowLeft, Plus, Play, CheckCircle2, Calendar, Target, ListTodo } from 'lucide-react';

export default function SprintsPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [sprints, setSprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
      setSprints(response.data.sprints || []);
    } catch (error) {
      console.error('Failed to fetch sprints:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSprint = async (data: any) => {
    try {
      const response = await api.post('/sprints', {
        ...data,
        projectId: params.id,
      });
      setShowCreateModal(false);
      router.push(`/projects/${params.id}/sprints/${response.data.sprint.id}`);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create sprint');
    }
  };

  const startSprint = async (sprintId: string) => {
    if (!confirm('Start this sprint? Tasks will be placed on the project board.')) return;
    try {
      const response = await api.patch(`/sprints/${sprintId}/start`, { placeOnBoard: true });
      await fetchSprints();
      const boardId = response.data.board?.boardId;
      if (boardId) {
        if (confirm('Sprint started. Open the board to begin work?')) {
          router.push(`/projects/${params.id}/boards/${boardId}`);
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to start sprint');
    }
  };

  const activeSprint = sprints.find((s) => s.status === 'ACTIVE');
  const planned = sprints.filter((s) => s.status === 'PLANNED');
  const completed = sprints.filter((s) => s.status === 'COMPLETED' || s.status === 'CANCELLED');

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
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sprints</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Plan → Start → Work on board → Complete
                  </p>
                </div>
              </div>
              <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER']}>
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

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          {/* Flow strip */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {[
                { step: '1', title: 'Create & plan', desc: 'Set dates, goal, pull backlog' },
                { step: '2', title: 'Start sprint', desc: 'One active sprint at a time' },
                { step: '3', title: 'Work on board', desc: 'Tasks land on the board' },
                { step: '4', title: 'Complete', desc: 'Move leftover work cleanly' },
              ].map((item) => (
                <div key={item.step} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {activeSprint && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-green-700 dark:text-green-400 mb-3">
                Active Sprint
              </h2>
              <SprintCard
                sprint={activeSprint}
                projectId={params.id as string}
                onStart={startSprint}
                highlight
              />
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
              Planned ({planned.length})
            </h2>
            {planned.length === 0 ? (
              <EmptyHint text="No planned sprints. Create one, then add backlog items." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {planned.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    projectId={params.id as string}
                    onStart={startSprint}
                  />
                ))}
              </div>
            )}
          </section>

          {completed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                Completed / Cancelled ({completed.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completed.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    projectId={params.id as string}
                    onStart={startSprint}
                  />
                ))}
              </div>
            </section>
          )}

          {sprints.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <ListTodo className="h-10 w-10 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">No sprints yet. Create your first sprint to start planning.</p>
              <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER']}>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Create Sprint
                </button>
              </RoleGuard>
            </div>
          )}
        </main>
      </div>

      {showCreateModal && (
        <CreateSprintModal onClose={() => setShowCreateModal(false)} onCreate={createSprint} />
      )}
    </Layout>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-sm text-gray-500 dark:text-gray-400">
      {text}
    </div>
  );
}

function SprintCard({
  sprint,
  projectId,
  onStart,
  highlight,
}: {
  sprint: any;
  projectId: string;
  onStart: (id: string) => void;
  highlight?: boolean;
}) {
  const stats = sprint.stats || {};
  const progress =
    stats.totalTasks > 0 ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0;

  return (
    <div
      className={`bg-white dark:bg-gray-800 border rounded-lg p-5 ${
        highlight
          ? 'border-green-400 dark:border-green-600 shadow-sm'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <Link
            href={`/projects/${projectId}/sprints/${sprint.id}`}
            className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
          >
            {sprint.name}
          </Link>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {sprint.startDate ? new Date(sprint.startDate).toLocaleDateString() : 'No start'} –{' '}
            {sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : 'No end'}
          </p>
        </div>
        <StatusBadge status={sprint.status} />
      </div>

      {sprint.goal && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2 flex gap-1.5">
          <Target className="h-4 w-4 shrink-0 mt-0.5" />
          {sprint.goal}
        </p>
      )}

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>
            {stats.doneTasks || 0}/{stats.totalTasks || 0} done
          </span>
          <span>{stats.storyPoints || 0} SP</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/projects/${projectId}/sprints/${sprint.id}`}
          className="flex-1 text-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium"
        >
          Open
        </Link>
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
          {sprint.status === 'PLANNED' && (
            <button
              onClick={() => onStart(sprint.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              <Play className="h-4 w-4" />
              Start
            </button>
          )}
          {sprint.status === 'ACTIVE' && (
            <Link
              href={`/projects/${projectId}/sprints/${sprint.id}?complete=1`}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <CheckCircle2 className="h-4 w-4" />
              Complete
            </Link>
          )}
        </RoleGuard>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    COMPLETED: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    CANCELLED: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    PLANNED: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded shrink-0 ${styles[status] || styles.PLANNED}`}>
      {status}
    </span>
  );
}

function CreateSprintModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate && endDate && endDate < startDate) {
      alert('End date must be on or after start date');
      return;
    }
    onCreate({ name, startDate, endDate, goal });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-1 text-gray-900 dark:text-white">Create Sprint</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          After creating, you’ll add issues from the backlog before starting.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Sprint Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Sprint 1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Goal</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="What should this sprint achieve?"
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              Create & Plan
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
