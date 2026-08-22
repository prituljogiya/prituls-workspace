'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { RoleGuard } from '@/components/RoleGuard';
import { ArrowLeft, Plus, Filter, MoveRight, User, Calendar, Tag } from 'lucide-react';

export default function BacklogPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ issueType: '', status: '', assigneeId: '' });
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && params.id) {
      fetchBacklog();
      fetchSprints();
    }
  }, [user, authLoading, params.id, router]);

  const fetchBacklog = async () => {
    try {
      const response = await api.get(`/tasks/project/${params.id}?isInBacklog=true`);
      setTasks(response.data.tasks);
    } catch (error) {
      console.error('Failed to fetch backlog:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSprints = async () => {
    try {
      const response = await api.get(`/sprints/project/${params.id}`);
      setSprints(response.data.sprints);
    } catch (error) {
      console.error('Failed to fetch sprints:', error);
    }
  };

  const moveToBoard = async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}`, { isInBacklog: false });
      fetchBacklog();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to move task');
    }
  };

  const moveToSprint = async (sprintId: string) => {
    try {
      await Promise.all(
        selectedTasks.map(taskId =>
          api.patch(`/sprints/${sprintId}/tasks/${taskId}`)
        )
      );
      setSelectedTasks([]);
      setShowMoveModal(false);
      fetchBacklog();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to move tasks to sprint');
    }
  };

  const createTask = async () => {
    const title = prompt('Task title:');
    if (!title) return;
    try {
      await api.post('/tasks', {
        title,
        projectId: params.id,
        isInBacklog: true,
        issueType: 'TASK',
      });
      fetchBacklog();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create task');
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter.issueType && task.issueType !== filter.issueType) return false;
    if (filter.status && task.status !== filter.status) return false;
    if (filter.assigneeId) {
      const hasAssignee = task.assignments?.some((a: any) => a.userId === filter.assigneeId);
      if (!hasAssignee) return false;
    }
    return true;
  });

  if (loading || authLoading) {
    return (
      <Layout projectId={params.id as string}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout projectId={params.id as string}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Backlog</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{filteredTasks.length} tasks</p>
              </div>
              <RoleGuard permission="tasks.create">
                <div className="flex items-center gap-2">
                  {selectedTasks.length > 0 && (
                    <RoleGuard permission="sprints.assign">
                      <button
                        onClick={() => setShowMoveModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        <MoveRight className="h-4 w-4" />
                        Move to Sprint ({selectedTasks.length})
                      </button>
                    </RoleGuard>
                  )}
                  <button
                    onClick={createTask}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Task
                  </button>
                </div>
              </RoleGuard>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-gray-500" />
            <select
              value={filter.issueType}
              onChange={(e) => setFilter({ ...filter, issueType: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
            >
              <option value="">All Issue Types</option>
              <option value="TASK">Task</option>
              <option value="BUG">Bug</option>
              <option value="STORY">Story</option>
              <option value="EPIC">Epic</option>
            </select>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
            >
              <option value="">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">No tasks in backlog</p>
              <RoleGuard permission="tasks.create">
                <button
                  onClick={createTask}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4" />
                  Create First Task
                </button>
              </RoleGuard>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow ${
                  selectedTasks.includes(task.id) ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(task.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTasks([...selectedTasks, task.id]);
                      } else {
                        setSelectedTasks(selectedTasks.filter(id => id !== task.id));
                      }
                    }}
                    className="mt-1 w-5 h-5 text-primary-600 rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Link
                          href={`/projects/${params.id}/tasks/${task.id}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-primary-600"
                        >
                          {task.title}
                        </Link>
                        {task.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <span className={`px-2 py-1 text-xs rounded ${
                          task.issueType === 'BUG' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                          task.issueType === 'STORY' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                          task.issueType === 'EPIC' ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                          {task.issueType}
                        </span>
                        {task.storyPoints && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">{task.storyPoints} SP</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                      {task.assignments && task.assignments.length > 0 && (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {task.assignments.map((a: any) => a.user.firstName).join(', ')}
                        </div>
                      )}
                      {task.dueDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(task.dueDate).toLocaleDateString()}
                        </div>
                      )}
                      {task.labels && task.labels.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Tag className="h-4 w-4" />
                          {task.labels.length} labels
                        </div>
                      )}
                    </div>
                  </div>
                  <RoleGuard permission="tasks.edit">
                    <button
                      onClick={() => moveToBoard(task.id)}
                      className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded-lg flex items-center gap-1"
                    >
                      <MoveRight className="h-4 w-4" />
                      Move to Board
                    </button>
                  </RoleGuard>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Move to Sprint Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Move to Sprint</h2>
            <div className="space-y-2 mb-4">
              {sprints.filter(s => s.status === 'PLANNED' || s.status === 'ACTIVE').map((sprint) => (
                <button
                  key={sprint.id}
                  type="button"
                  onClick={() => moveToSprint(sprint.id)}
                  className="w-full text-left px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <div className="font-medium">{sprint.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {sprint.status} • {sprint._count?.tasks || 0} tasks
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowMoveModal(false)}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      </div>
    </Layout>
  );
}

