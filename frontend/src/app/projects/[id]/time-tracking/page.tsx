'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { Clock, Play, Square, Plus, TrendingUp, Pencil, Trash2, X, Check, Send } from 'lucide-react';
import { format } from 'date-fns';
import { usePermissions } from '@/contexts/PermissionContext';

export default function TimeTrackingPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const { can } = usePermissions();
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    taskId: '',
    hours: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [tasks, setTasks] = useState<any[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ hours: '', description: '', date: '' });
  const [deletionRequests, setDeletionRequests] = useState<any[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());

  const canHours = can('time.view') || can('time.track');
  const canApprove = can('time.approve');
  const canHardDelete = can('time.approve');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && !canHours && !canApprove) {
      router.replace(`/projects/${params.id}`);
      return;
    }
    if (user && params.id) {
      if (canHours) {
        fetchData();
        fetchActiveTimer();
        fetchTasks();
      } else {
        setLoading(false);
      }
      if (canApprove) {
        fetchDeletionRequests();
      }
    }
  }, [user, authLoading, params.id, router, canHours, canApprove]);

  const fetchDeletionRequests = async () => {
    try {
      const res = await api.get(`/time-tracking/deletion-requests/project/${params.id}?status=PENDING`);
      const list = res.data.requests || [];
      setDeletionRequests(list);
      setPendingDeleteIds(new Set(list.map((r: any) => r.timeEntryId)));
    } catch (err) {
      console.error('Failed to fetch deletion requests:', err);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTimer && activeTimer.startTime) {
      interval = setInterval(() => {
        const start = new Date(activeTimer.startTime).getTime();
        const now = Date.now();
        setElapsedTime(Math.floor((now - start) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimer]);

  const fetchData = async () => {
    try {
      const response = await api.get(`/time-tracking/project/${params.id}`);
      setEntries(response.data.entries || []);
      setSummary(response.data.summary || {});
    } catch (error) {
      console.error('Failed to fetch time entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveTimer = async () => {
    try {
      const response = await api.get('/time-tracking/timer/active');
      if (response.data.entry) {
        setActiveTimer(response.data.entry);
      }
    } catch (error) {
      setActiveTimer(null);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await api.get(`/tasks/project/${params.id}`);
      setTasks(response.data.tasks || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const startTimer = async (taskId: string, taskStatus?: string) => {
    if (taskStatus === 'DONE') {
      alert('This task is completed. Add time manually instead of starting a timer.');
      return;
    }
    try {
      const response = await api.post('/time-tracking/timer/start', { taskId });
      setActiveTimer(response.data.entry);
      setElapsedTime(0);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to start timer');
    }
  };

  const stopTimer = async () => {
    if (!activeTimer) return;
    try {
      const description = prompt('Add a description (optional):');
      await api.post('/time-tracking/timer/stop', {
        entryId: activeTimer.id,
        description: description || '',
      });
      setActiveTimer(null);
      setElapsedTime(0);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to stop timer');
    }
  };

  const addManualEntry = async () => {
    if (!manualEntry.taskId || !manualEntry.hours) {
      alert('Please select a task and enter hours');
      return;
    }
    try {
      await api.post('/time-tracking', {
        taskId: manualEntry.taskId,
        hours: parseFloat(manualEntry.hours),
        date: manualEntry.date,
        description: manualEntry.description,
      });
      setShowManualEntry(false);
      setManualEntry({
        taskId: '',
        hours: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add time entry');
    }
  };

  const startEdit = (entry: any) => {
    setEditingId(entry.id);
    setEditForm({
      hours: String(entry.hours),
      description: entry.description || '',
      date: format(new Date(entry.date), 'yyyy-MM-dd'),
    });
  };

  const saveEdit = async (entryId: string) => {
    try {
      await api.patch(`/time-tracking/${entryId}`, {
        hours: parseFloat(editForm.hours),
        description: editForm.description,
        date: editForm.date,
      });
      setEditingId(null);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update time entry');
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (canHardDelete) {
      if (!confirm('Delete this time entry?')) return;
      try {
        await api.delete(`/time-tracking/${entryId}`);
        fetchData();
        if (canApprove) fetchDeletionRequests();
      } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to delete time entry');
      }
      return;
    }

    const reason = window.prompt(
      'Team members cannot delete time directly. Add a short reason for admin approval (optional):'
    );
    if (reason === null) return;
    try {
      await api.post(`/time-tracking/${entryId}/request-delete`, { reason });
      alert('Deletion request sent to admin for approval.');
      setPendingDeleteIds((prev) => new Set(prev).add(entryId));
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to request deletion');
    }
  };

  const approveDeletion = async (requestId: string) => {
    try {
      await api.post(`/time-tracking/deletion-requests/${requestId}/approve`);
      fetchDeletionRequests();
      if (canHours) fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to approve');
    }
  };

  const rejectDeletion = async (requestId: string) => {
    try {
      await api.post(`/time-tracking/deletion-requests/${requestId}/reject`);
      fetchDeletionRequests();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reject');
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Time Tracking</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {canHours
                  ? 'Log time with a timer, or add and edit hours manually. Team members must request deletion for admin approval.'
                  : 'Review time deletion requests from team members.'}
              </p>
            </div>
            {canHours && (
              <button
                onClick={() => setShowManualEntry(!showManualEntry)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Manual Entry
              </button>
            )}
          </div>

          {canApprove && deletionRequests.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-6">
              <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-800">
                <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                  Pending deletion requests ({deletionRequests.length})
                </h2>
              </div>
              <div className="divide-y divide-amber-200 dark:divide-amber-900/50">
                {deletionRequests.map((req) => (
                  <div key={req.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {req.timeEntry?.hours?.toFixed(2)}h · {req.timeEntry?.task?.title || 'Task'}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        Requested by {req.requestedBy?.firstName} {req.requestedBy?.lastName}
                        {req.reason ? ` — “${req.reason}”` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => approveDeletion(req.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectDeletion(req.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canHours && activeTimer && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Currently tracking</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {activeTimer.task?.title || 'Unknown Task'}
                  </p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                    {formatTime(elapsedTime)}
                  </p>
                </div>
                <button
                  onClick={stopTimer}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Square className="h-4 w-4" />
                  Stop Timer
                </button>
              </div>
            </div>
          )}

          {canHours && (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Hours</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {summary?.totalHours?.toFixed(1) || '0.0'}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Entries</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {summary?.totalEntries || 0}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-indigo-500" />
              </div>
            </div>
          </div>

          {showManualEntry && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Manual Time Entry</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Task</label>
                  <select
                    value={manualEntry.taskId}
                    onChange={(e) => setManualEntry({ ...manualEntry, taskId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select a task</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                        {task.status === 'DONE' ? ' (Completed)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Hours</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={manualEntry.hours}
                    onChange={(e) => setManualEntry({ ...manualEntry, hours: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="0.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={manualEntry.date}
                    onChange={(e) => setManualEntry({ ...manualEntry, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
                  <textarea
                    value={manualEntry.description}
                    onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    placeholder="What did you work on?"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={addManualEntry}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Entry
                </button>
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Time Entries</h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {entries.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No time entries yet. Start a timer or add a manual entry.</p>
                </div>
              ) : (
                entries.map((entry) => (
                  <div key={entry.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    {editingId === entry.id ? (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Hours</label>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={editForm.hours}
                            onChange={(e) => setEditForm({ ...editForm, hours: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
                          <input
                            type="date"
                            value={editForm.date}
                            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editForm.description}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <button
                              onClick={() => saveEdit(entry.id)}
                              className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                              title="Save"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium shrink-0">
                            {entry.user.firstName[0]}
                            {entry.user.lastName[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                              {entry.task?.title || 'Unknown Task'}
                              {entry.task?.status === 'DONE' && (
                                <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-400">
                                  Completed
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {entry.user.firstName} {entry.user.lastName} •{' '}
                              {format(new Date(entry.date), 'MMM d, yyyy')}
                            </p>
                            {entry.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                                {entry.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-lg font-semibold text-gray-900 dark:text-white w-16 text-right">
                            {entry.hours.toFixed(2)}h
                          </p>
                          <button
                            onClick={() => startEdit(entry)}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Edit entry"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {pendingDeleteIds.has(entry.id) ? (
                            <span className="text-xs text-amber-600 dark:text-amber-400 px-2">Pending delete</span>
                          ) : (
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title={canHardDelete ? 'Delete entry' : 'Request deletion'}
                            >
                              {canHardDelete ? <Trash2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                            </button>
                          )}
                          {!activeTimer && entry.task?.status !== 'DONE' && (
                            <button
                              onClick={() => startTimer(entry.taskId, entry.task?.status)}
                              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              title="Start timer for this task"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </Layout>
  );
}
