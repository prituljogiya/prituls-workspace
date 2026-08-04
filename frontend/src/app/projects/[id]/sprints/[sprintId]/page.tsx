'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { RoleGuard } from '@/components/RoleGuard';
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  MoveRight,
  Pencil,
  Trash2,
  X,
  LayoutDashboard,
} from 'lucide-react';
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

export default function SprintDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [sprint, setSprint] = useState<any>(null);
  const [nextSprints, setNextSprints] = useState<any[]>([]);
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [burndownData, setBurndownData] = useState<any>(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', startDate: '', endDate: '', goal: '' });
  const [showComplete, setShowComplete] = useState(false);
  const [incompleteAction, setIncompleteAction] = useState<'backlog' | 'next_sprint' | 'keep'>('backlog');
  const [nextSprintId, setNextSprintId] = useState('');
  const [boards, setBoards] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && params.sprintId) {
      refreshAll();
      fetchBoards();
    }
  }, [user, authLoading, params.sprintId, router]);

  useEffect(() => {
    if (
      sprint?.status === 'ACTIVE' &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('complete') === '1'
    ) {
      setShowComplete(true);
    }
  }, [sprint?.status]);

  const refreshAll = async () => {
    await fetchSprint();
    fetchBurndown();
  };

  const fetchSprint = async () => {
    try {
      const response = await api.get(`/sprints/${params.sprintId}`);
      const s = response.data.sprint;
      setSprint(s);
      setNextSprints(response.data.nextSprints || []);
      if (response.data.nextSprints?.[0]) {
        setNextSprintId(response.data.nextSprints[0].id);
      }
      setEditForm({
        name: s.name || '',
        startDate: s.startDate ? s.startDate.split('T')[0] : '',
        endDate: s.endDate ? s.endDate.split('T')[0] : '',
        goal: s.goal || '',
      });
      await fetchAvailable(s);
    } catch (error) {
      console.error('Failed to fetch sprint:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailable = async (currentSprint?: any) => {
    try {
      const response = await api.get(`/tasks/project/${params.id}`);
      const allTasks = response.data.tasks || [];
      const sprintTaskIds = new Set((currentSprint || sprint)?.tasks?.map((t: any) => t.id) || []);
      setAvailableTasks(
        allTasks.filter((task: any) => !sprintTaskIds.has(task.id) && !task.sprintId)
      );
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      setAvailableTasks([]);
    }
  };

  const fetchBurndown = async () => {
    try {
      const response = await api.get(`/sprints/${params.sprintId}/burndown`);
      setBurndownData(response.data?.burndown ? response.data : null);
    } catch {
      setBurndownData(null);
    }
  };

  const fetchBoards = async () => {
    try {
      const response = await api.get(`/boards/project/${params.id}`);
      setBoards(response.data.boards || []);
    } catch {
      setBoards([]);
    }
  };

  const saveEdit = async () => {
    try {
      await api.patch(`/sprints/${params.sprintId}`, editForm);
      setEditing(false);
      refreshAll();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update sprint');
    }
  };

  const startSprint = async () => {
    if (!confirm('Start this sprint? Tasks without a board column will move to the Todo column.')) return;
    try {
      const response = await api.patch(`/sprints/${params.sprintId}/start`, { placeOnBoard: true });
      await refreshAll();
      const boardId = response.data.board?.boardId || boards[0]?.id;
      if (boardId && confirm('Sprint is active. Open the board?')) {
        router.push(`/projects/${params.id}/boards/${boardId}`);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to start sprint');
    }
  };

  const completeSprint = async () => {
    if (incompleteAction === 'next_sprint' && !nextSprintId) {
      alert('Select a planned sprint for incomplete work');
      return;
    }
    try {
      await api.patch(`/sprints/${params.sprintId}/complete`, {
        incompleteAction,
        nextSprintId: incompleteAction === 'next_sprint' ? nextSprintId : undefined,
      });
      setShowComplete(false);
      await refreshAll();
      alert('Sprint completed');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to complete sprint');
    }
  };

  const cancelSprint = async () => {
    if (!confirm('Cancel this planned sprint? Tasks will return to the backlog.')) return;
    try {
      await api.patch(`/sprints/${params.sprintId}/cancel`);
      refreshAll();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to cancel sprint');
    }
  };

  const deleteSprint = async () => {
    if (!confirm('Delete this sprint permanently?')) return;
    try {
      await api.delete(`/sprints/${params.sprintId}`);
      router.push(`/projects/${params.id}/sprints`);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete sprint');
    }
  };

  const addTaskToSprint = async (taskId: string) => {
    try {
      await api.patch(`/sprints/${params.sprintId}/tasks/${taskId}`);
      await refreshAll();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add task');
    }
  };

  const removeTaskFromSprint = async (taskId: string) => {
    try {
      await api.delete(`/sprints/${params.sprintId}/tasks/${taskId}`);
      await refreshAll();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove task');
    }
  };

  const filteredAvailable = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return availableTasks;
    return availableTasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [availableTasks, taskSearch]);

  const incompleteTasks = (sprint?.tasks || []).filter((t: any) => t.status !== 'DONE');
  const canMutateTasks = sprint && !['COMPLETED', 'CANCELLED'].includes(sprint.status);

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
        <div className="flex items-center justify-center min-h-screen text-gray-900 dark:text-white">
          Sprint not found
        </div>
      </Layout>
    );
  }

  const stats = sprint.stats || {};
  const steps = [
    { key: 'PLANNED', label: 'Plan' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'COMPLETED', label: 'Done' },
  ];
  const stepIndex =
    sprint.status === 'ACTIVE' ? 1 : sprint.status === 'COMPLETED' ? 2 : sprint.status === 'CANCELLED' ? -1 : 0;

  return (
    <Layout projectId={params.id as string}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <Link
                  href={`/projects/${params.id}/sprints`}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mt-1"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{sprint.name}</h1>
                    <span
                      className={`px-2.5 py-1 text-xs font-medium rounded ${
                        sprint.status === 'ACTIVE'
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : sprint.status === 'COMPLETED'
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : sprint.status === 'CANCELLED'
                              ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {sprint.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {sprint.startDate ? new Date(sprint.startDate).toLocaleDateString() : 'No start'} –{' '}
                    {sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : 'No end'}
                    {sprint.goal ? ` · ${sprint.goal}` : ''}
                  </p>
                </div>
              </div>

              <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
                <div className="flex flex-wrap gap-2">
                  {canMutateTasks && (
                    <button
                      onClick={() => setEditing(true)}
                      className="px-3 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1.5"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  )}
                  {sprint.status === 'PLANNED' && (
                    <>
                      <button
                        onClick={startSprint}
                        className="px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5"
                      >
                        <Play className="h-4 w-4" />
                        Start Sprint
                      </button>
                      <button
                        onClick={cancelSprint}
                        className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {sprint.status === 'ACTIVE' && (
                    <>
                      {boards[0] && (
                        <Link
                          href={`/projects/${params.id}/boards/${boards[0].id}`}
                          className="px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          Open Board
                        </Link>
                      )}
                      <button
                        onClick={() => setShowComplete(true)}
                        className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Complete Sprint
                      </button>
                    </>
                  )}
                  {['PLANNED', 'CANCELLED'].includes(sprint.status) && (
                    <button
                      onClick={deleteSprint}
                      className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  )}
                </div>
              </RoleGuard>
            </div>

            {/* Progress steps */}
            {sprint.status !== 'CANCELLED' && (
              <div className="mt-5 flex items-center gap-2">
                {steps.map((step, idx) => (
                  <div key={step.key} className="flex items-center gap-2 flex-1">
                    <div
                      className={`flex-1 h-1.5 rounded-full ${
                        idx <= stepIndex ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                    <span
                      className={`text-xs font-medium whitespace-nowrap ${
                        idx <= stepIndex
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Tasks', value: stats.totalTasks || 0 },
              { label: 'Done', value: stats.doneTasks || 0 },
              { label: 'Remaining', value: stats.incompleteTasks || 0 },
              { label: 'Story points', value: `${stats.donePoints || 0}/${stats.storyPoints || 0}` },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Burndown */}
          {sprint.startDate && sprint.endDate && burndownData?.burndown?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Burndown</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={burndownData.burndown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis domain={[0, 'auto']} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="remaining" stroke="#ef4444" name="Remaining" strokeWidth={2} />
                  <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="5 5" name="Ideal" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {(() => {
                const remaining = (sprint.tasks || []).filter((t: any) => t.status !== 'DONE');
                const completed = (sprint.tasks || []).filter((t: any) => t.status === 'DONE');
                const renderTask = (task: any, showRemove: boolean) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/projects/${params.id}/tasks/${task.id}`}
                        className={`font-medium text-sm hover:text-blue-600 dark:hover:text-blue-400 ${
                          task.status === 'DONE'
                            ? 'text-gray-500 dark:text-gray-400 line-through'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {task.title}
                      </Link>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {task.board?.name ? `Board: ${task.board.name}` : 'Not on board'}
                        {task.column?.name ? ` · ${task.column.name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {task.storyPoints != null && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{task.storyPoints} SP</span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          task.status === 'DONE'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : task.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {task.status.replace('_', ' ')}
                      </span>
                      {showRemove && canMutateTasks && (
                        <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER']}>
                          <button
                            onClick={() => removeTaskFromSprint(task.id)}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
                          >
                            Remove
                          </button>
                        </RoleGuard>
                      )}
                    </div>
                  </div>
                );

                if ((sprint.tasks || []).length === 0) {
                  return (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Sprint backlog (0)
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">
                        No issues yet. Add from the picker, or multi-select in Backlog → Move to Sprint.
                      </p>
                    </div>
                  );
                }

                return (
                  <>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        To do / in progress ({remaining.length})
                      </h2>
                      <div className="space-y-2">
                        {remaining.length === 0 ? (
                          <p className="text-sm text-green-700 dark:text-green-400 text-center py-6">
                            All sprint issues are completed.
                          </p>
                        ) : (
                          remaining.map((task: any) => renderTask(task, true))
                        )}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Completed ({completed.length})
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Finished issues stay on the sprint until it is completed.
                      </p>
                      <div className="space-y-2">
                        {completed.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                            No completed issues yet.
                          </p>
                        ) : (
                          completed.map((task: any) => renderTask(task, false))
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {canMutateTasks && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Add issues</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Unassigned backlog / board issues
                </p>
                <input
                  type="search"
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="Search issues…"
                  className="w-full mb-3 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                  {filteredAvailable.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                      No available issues
                    </p>
                  ) : (
                    filteredAvailable.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{task.title}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {task.isInBacklog ? 'Backlog' : 'Board'} · {task.status.replace('_', ' ')}
                          </p>
                        </div>
                        <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER']}>
                          <button
                            onClick={() => addTaskToSprint(task.id)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            title="Add to sprint"
                          >
                            <MoveRight className="h-4 w-4" />
                          </button>
                        </RoleGuard>
                      </div>
                    ))
                  )}
                </div>
                <Link
                  href={`/projects/${params.id}/backlog`}
                  className="mt-4 block text-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Open backlog for bulk move →
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Sprint</h2>
              <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Name"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <textarea
                value={editForm.goal}
                onChange={(e) => setEditForm({ ...editForm, goal: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                placeholder="Goal"
              />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showComplete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Complete Sprint</h2>
              <button onClick={() => setShowComplete(false)} className="text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {stats.doneTasks || 0} done · {incompleteTasks.length} incomplete
            </p>

            {incompleteTasks.length > 0 ? (
              <div className="space-y-3 mb-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  What should happen to incomplete issues?
                </p>
                {[
                  { id: 'backlog', label: 'Move to backlog', desc: 'Clear sprint + board placement' },
                  {
                    id: 'next_sprint',
                    label: 'Move to next planned sprint',
                    desc: 'Carry unfinished work forward',
                  },
                  { id: 'keep', label: 'Leave on this sprint', desc: 'Keep history as-is' },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex gap-3 p-3 border rounded-lg cursor-pointer ${
                      incompleteAction === opt.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="incomplete"
                      checked={incompleteAction === opt.id}
                      onChange={() => setIncompleteAction(opt.id as any)}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</p>
                    </div>
                  </label>
                ))}

                {incompleteAction === 'next_sprint' && (
                  <select
                    value={nextSprintId}
                    onChange={(e) => setNextSprintId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select planned sprint…</option>
                    {nextSprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}

                {incompleteAction === 'next_sprint' && nextSprints.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No planned sprints available. Create one first, or choose backlog.
                  </p>
                )}

                <div className="max-h-32 overflow-y-auto text-xs text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700 rounded p-2">
                  {incompleteTasks.map((t: any) => (
                    <div key={t.id}>• {t.title}</div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-green-700 dark:text-green-400 mb-4">
                All issues are done. Nice work!
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={completeSprint}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                Complete Sprint
              </button>
              <button
                onClick={() => setShowComplete(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
