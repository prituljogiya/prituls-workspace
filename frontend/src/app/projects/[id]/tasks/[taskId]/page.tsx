'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTimer } from '@/contexts/TimerContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { ArrowLeft, User, Calendar, Tag, CheckSquare, Paperclip, MessageSquare, Clock, Edit2, Trash2, Save, X, Play, Square, Sparkles, Smile, Image as ImageIcon, AtSign, Rocket, XCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const {
    activeTimer,
    elapsedTime,
    startTimer,
    stopTimer,
    formatTime,
    refreshActiveTimer,
    autoStoppedMessage,
  } = useTimer();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newLabel, setNewLabel] = useState({ name: '', color: '#64748b' });
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [generatingSubtasks, setGeneratingSubtasks] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [manualHours, setManualHours] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [addingHours, setAddingHours] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntryHours, setEditEntryHours] = useState('');
  const [editEntryNote, setEditEntryNote] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && params.taskId) {
      fetchTask();
      fetchUsers();
      refreshActiveTimer();
      fetchSubtasks();
      fetchSprints();
      fetchTimeEntries();
    }
  }, [user, authLoading, params.taskId, router]);

  useEffect(() => {
    if (autoStoppedMessage && params.taskId) {
      fetchTimeEntries();
    }
  }, [autoStoppedMessage, params.taskId]);

  const fetchTask = async () => {
    try {
      const response = await api.get(`/tasks/${params.taskId}`);
      setTask(response.data.task);
      setEditTitle(response.data.task.title);
      setEditDescription(response.data.task.description || '');
    } catch (error) {
      console.error('Failed to fetch task:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTask = async () => {
    try {
      const response = await api.patch(`/tasks/${params.taskId}`, {
        title: editTitle,
        description: editDescription,
      });
      setTask(response.data.task);
      setEditing(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update task');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setAllUsers(response.data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchSprints = async () => {
    try {
      const response = await api.get(`/sprints/project/${params.id}`);
      setSprints(response.data.sprints || []);
    } catch (error) {
      console.error('Failed to fetch sprints:', error);
    }
  };

  const addTaskToSprint = async (sprintId: string) => {
    try {
      await api.patch(`/sprints/${sprintId}/tasks/${params.taskId}`);
      fetchTask();
      fetchSprints();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add task to sprint');
    }
  };

  const removeTaskFromSprint = async () => {
    if (!task?.sprintId) return;
    try {
      await api.delete(`/sprints/${task.sprintId}/tasks/${params.taskId}`);
      fetchTask();
      fetchSprints();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove task from sprint');
    }
  };

  const assignUser = async (userId: string) => {
    if (!userId) return;
    try {
      await api.post(`/tasks/${params.taskId}/assign`, { userId });
      setSelectedUserId('');
      fetchTask();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to assign user');
    }
  };

  const deleteTask = async () => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) return;
    try {
      await api.delete(`/tasks/${params.taskId}`);
      router.push(`/projects/${params.id}/boards/${task?.boardId}`);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete task');
    }
  };

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Use fetch directly for file upload to avoid axios content-type issues
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'}/tasks/${params.taskId}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      fetchTask();
    } catch (error: any) {
      alert(error.message || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    try {
      await api.post(`/tasks/${params.taskId}/comments`, { 
        content: newComment,
        mentionedUserIds: commentMentions,
      });
      setNewComment('');
      setCommentMentions([]);
      fetchTask();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add comment');
    }
  };

  const addReaction = async (commentId: string, emoji: string) => {
    try {
      await api.post(`/tasks/comments/${commentId}/reactions`, { emoji });
      fetchTask();
    } catch (error: any) {
      // Reaction might already exist, try removing it
      try {
        await api.delete(`/tasks/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`);
        fetchTask();
      } catch (e) {
        console.error('Failed to toggle reaction:', e);
      }
    }
  };

  const commonEmojis = ['👍', '❤️', '🎉', '😄', '👏', '🔥', '💯', '🚀'];

  const handleCommentChange = (value: string) => {
    setNewComment(value);
    // Check for @ mentions
    const atIndex = value.lastIndexOf('@');
    if (atIndex !== -1) {
      const query = value.substring(atIndex + 1).split(/\s/)[0];
      if (query.length > 0) {
        setMentionQuery(query);
        setShowMentionPicker(true);
      } else {
        setShowMentionPicker(false);
      }
    } else {
      setShowMentionPicker(false);
    }
  };

  const insertMention = (userId: string, userName: string) => {
    const atIndex = newComment.lastIndexOf('@');
    if (atIndex !== -1) {
      const before = newComment.substring(0, atIndex);
      const after = newComment.substring(atIndex + mentionQuery.length + 1);
      setNewComment(`${before}@${userName} ${after}`);
      setCommentMentions([...commentMentions, userId]);
      setShowMentionPicker(false);
      setMentionQuery('');
    }
  };

  const filteredUsers = allUsers.filter(user => 
    user.firstName.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    user.lastName.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 5);

  const addChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;
    try {
      await api.post(`/tasks/${params.taskId}/checklist`, { text: newChecklistItem });
      setNewChecklistItem('');
      fetchTask();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add checklist item');
    }
  };

  const toggleChecklistItem = async (itemId: string, isChecked: boolean) => {
    try {
      await api.patch(`/tasks/checklist/${itemId}`, { isChecked: !isChecked });
      fetchTask();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update checklist');
    }
  };

  const addLabel = async () => {
    if (!newLabel.name.trim()) return;
    try {
      await api.post(`/tasks/${params.taskId}/labels`, newLabel);
      setNewLabel({ name: '', color: '#64748b' });
      fetchTask();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add label');
    }
  };

  const setDueDate = async (date: string) => {
    try {
      await api.patch(`/tasks/${params.taskId}`, { dueDate: date });
      fetchTask();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to set due date');
    }
  };

  const handleStartTimer = async () => {
    try {
      await startTimer(params.taskId as string);
    } catch {
      // error already alerted in context
    }
  };

  const handleStopTimer = async () => {
    await stopTimer({ promptDescription: true });
    fetchTimeEntries();
  };

  const fetchTimeEntries = async () => {
    try {
      const response = await api.get(`/time-tracking/task/${params.taskId}`);
      setTimeEntries(response.data.entries || []);
    } catch (error) {
      console.error('Failed to fetch time entries:', error);
    }
  };

  const totalLoggedHours = timeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

  const addManualHours = async () => {
    const hours = parseFloat(manualHours);
    if (!manualHours || Number.isNaN(hours) || hours <= 0) {
      alert('Please enter hours greater than 0');
      return;
    }
    try {
      setAddingHours(true);
      await api.post('/time-tracking', {
        taskId: params.taskId,
        hours,
        description: manualNote.trim() || undefined,
        isBillable: true,
      });
      setManualHours('');
      setManualNote('');
      await fetchTimeEntries();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add hours');
    } finally {
      setAddingHours(false);
    }
  };

  const startEditEntry = (entry: any) => {
    setEditingEntryId(entry.id);
    setEditEntryHours(String(entry.hours ?? ''));
    setEditEntryNote(entry.description || '');
  };

  const saveEditEntry = async () => {
    if (!editingEntryId) return;
    const hours = parseFloat(editEntryHours);
    if (!editEntryHours || Number.isNaN(hours) || hours < 0) {
      alert('Please enter valid hours');
      return;
    }
    try {
      await api.patch(`/time-tracking/${editingEntryId}`, {
        hours,
        description: editEntryNote.trim() || null,
      });
      setEditingEntryId(null);
      setEditEntryHours('');
      setEditEntryNote('');
      await fetchTimeEntries();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update time entry');
    }
  };

  const deleteTimeEntry = async (entryId: string) => {
    if (!confirm('Delete this time entry?')) return;
    try {
      await api.delete(`/time-tracking/${entryId}`);
      await fetchTimeEntries();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete time entry');
    }
  };

  const fetchSubtasks = async () => {
    try {
      const response = await api.get(`/tasks/${params.taskId}/subtasks`);
      setSubtasks(response.data.subtasks || []);
    } catch (error) {
      console.error('Failed to fetch subtasks:', error);
    }
  };

  const generateSubtasks = async () => {
    if (!task || !task.title || !params.taskId) {
      alert('Task information is missing. Please refresh the page.');
      return;
    }
    setGeneratingSubtasks(true);
    try {
      const response = await api.post('/ai/generate-subtasks', {
        taskTitle: task.title.trim(),
        taskDescription: task.description?.trim() || '',
        taskId: params.taskId as string,
      });
      await fetchSubtasks(); // Refresh subtasks list
      alert('Subtasks generated successfully!');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.errors?.map((e: any) => e.msg).join(', ') ||
                          'Failed to generate subtasks. Make sure AI API key is configured.';
      console.error('Generate subtasks error:', error);
      alert(errorMessage);
    } finally {
      setGeneratingSubtasks(false);
    }
  };

  const toggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    try {
      await api.patch(`/tasks/subtasks/${subtaskId}`, { isCompleted: !isCompleted });
      fetchSubtasks();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update subtask');
    }
  };

  if (loading || authLoading) {
    return (
      <Layout projectId={params.id as string}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  if (!task) {
    return (
      <Layout projectId={params.id as string}>
        <div className="flex items-center justify-center min-h-screen">
          <div>Task not found</div>
        </div>
      </Layout>
    );
  }

  // Helper functions for Jira-style badges
  const getIssueTypeColor = (type: string) => {
    switch (type) {
      case 'BUG': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'STORY': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'EPIC': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'DONE': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'BLOCKED': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'IN_REVIEW': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <Layout projectId={params.id as string}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Jira-style Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center gap-3 mb-3">
              <Link
                href={`/projects/${params.id}/boards/${task.boardId}`}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              {editing ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xl font-semibold border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    autoFocus
                  />
                  <button
                    onClick={updateTask}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditTitle(task.title);
                      setEditDescription(task.description || '');
                    }}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{task.title}</h1>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${getIssueTypeColor(task.issueType)}`}>
                    {task.issueType}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(task.status)}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => setEditing(true)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {user?.role && ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'].includes(user.role) && (
                    <button
                      onClick={deleteTask}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Description - Jira Style */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Description</h2>
                </div>
                <div className="p-4">
                  {editing ? (
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 resize-none"
                      placeholder="Add a description..."
                    />
                  ) : (
                    <div 
                      className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap min-h-[60px] cursor-text"
                      onClick={() => setEditing(true)}
                    >
                      {task.description || <span className="text-gray-400 dark:text-gray-500 italic">No description</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Checklist - Jira Style */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Checklist
                  </h2>
                  {task.checklist && task.checklist.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      {task.checklist.filter((item: any) => item.isChecked).length} / {task.checklist.length}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  {task.checklist && task.checklist.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {task.checklist.map((item: any) => (
                        <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={item.isChecked}
                            onChange={() => toggleChecklistItem(item.id, item.isChecked)}
                            className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className={`text-sm flex-1 ${item.isChecked ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                            {item.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                      placeholder="Add checklist item..."
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
                    />
                    <button
                      onClick={addChecklistItem}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Comments - Enhanced Chat - Jira Style */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Comments ({task.comments?.length || 0})
                  </h2>
                </div>
                <div className="p-4 space-y-4">
                  {task.comments?.map((comment: any) => (
                    <div key={comment.id} className="flex gap-3 pb-4 border-b border-gray-100 dark:border-gray-700 last:border-0 last:pb-0 group">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                        {comment.user.firstName[0]}{comment.user.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <p className="font-medium text-sm text-gray-900 dark:text-white">{comment.user.firstName} {comment.user.lastName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{format(new Date(comment.createdAt), 'MMM d, yyyy h:mm a')}</p>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-2">
                          {comment.content.split(/(@\w+)/g).map((part: string, i: number) => {
                            if (part.startsWith('@')) {
                              const mentionedUser = comment.mentions?.find((m: any) => 
                                m.user.firstName === part.substring(1) || 
                                m.user.lastName === part.substring(1) ||
                                m.user.email === part.substring(1)
                              );
                              if (mentionedUser) {
                                return (
                                  <span key={i} className="text-blue-600 dark:text-blue-400 font-medium">
                                    @{mentionedUser.user.firstName} {mentionedUser.user.lastName}
                                  </span>
                                );
                              }
                            }
                            return <span key={i}>{part}</span>;
                          })}
                        </p>
                        {/* Reactions */}
                        {comment.reactions && comment.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {Object.entries(
                              comment.reactions.reduce((acc: any, r: any) => {
                                if (!acc[r.emoji]) acc[r.emoji] = [];
                                acc[r.emoji].push(r);
                                return acc;
                              }, {})
                            ).map(([emoji, reactions]: [string, any]) => (
                              <button
                                key={emoji}
                                onClick={() => addReaction(comment.id, emoji)}
                                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded flex items-center gap-1 transition-colors"
                              >
                                <span>{emoji}</span>
                                <span className="text-gray-600 dark:text-gray-400">{reactions.length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Reaction Picker */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {commonEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => addReaction(comment.id, emoji)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm transition-colors"
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                        {/* Comment Attachments */}
                        {comment.attachments && comment.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {comment.attachments.map((attachment: any) => (
                              <a
                                key={attachment.id}
                                href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/uploads/${attachment.filePath}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                              >
                                <Paperclip className="h-3 w-3" />
                                {attachment.fileName}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 pt-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <div className="flex-1 relative">
                      <textarea
                        value={newComment}
                        onChange={(e) => handleCommentChange(e.target.value)}
                        rows={3}
                        placeholder="Add a comment... (use @ to mention someone)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 resize-none"
                      />
                      {/* Mention Picker */}
                      {showMentionPicker && filteredUsers.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                          {filteredUsers.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => insertMention(u.id, `${u.firstName} ${u.lastName}`)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                                {u.firstName[0]}{u.lastName[0]}
                              </div>
                              <span className="text-gray-900 dark:text-white">{u.firstName} {u.lastName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowEmojiPicker(showEmojiPicker === 'comment' ? null : 'comment')}
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Add emoji"
                          >
                            <Smile className="h-4 w-4" />
                          </button>
                          <label className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer">
                            <input
                              type="file"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const formData = new FormData();
                                  formData.append('file', file);
                                  const token = localStorage.getItem('token');
                                  // We'll need to create a comment first, then attach
                                  const commentRes = await api.post(`/tasks/${params.taskId}/comments`, { content: `📎 ${file.name}` });
                                  await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'}/tasks/comments/${commentRes.data.comment.id}/attachments`, {
                                    method: 'POST',
                                    headers: { 'Authorization': `Bearer ${token}` },
                                    body: formData,
                                  });
                                  fetchTask();
                                } catch (error: any) {
                                  alert(error.message || 'Failed to upload file');
                                }
                              }}
                              className="hidden"
                            />
                            <ImageIcon className="h-4 w-4" />
                          </label>
                        </div>
                        <button
                          onClick={addComment}
                          disabled={!newComment.trim()}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Comment
                        </button>
                      </div>
                      {/* Emoji Picker */}
                      {showEmojiPicker === 'comment' && (
                        <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                          <div className="grid grid-cols-4 gap-1">
                            {commonEmojis.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  setNewComment(newComment + emoji);
                                  setShowEmojiPicker(null);
                                }}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Log - Jira Style */}
              {task.activities && task.activities.length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Activity
                    </h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {task.activities.map((activity: any) => (
                      <div key={activity.id} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
                          {activity.user.firstName[0]}{activity.user.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">{activity.user.firstName} {activity.user.lastName}</span>
                            {' '}
                            <span className="text-gray-600 dark:text-gray-400">{activity.action.replace('_', ' ')}</span>
                            {activity.newValue && (
                              <span className="text-gray-500 dark:text-gray-400">: {activity.newValue}</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {format(new Date(activity.createdAt), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

            {/* Sidebar - Jira Style */}
            <div className="space-y-4">
              {/* Time Logged */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time Logged
                  </h2>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                      {totalLoggedHours.toFixed(2)}h
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {timeEntries.length} {timeEntries.length === 1 ? 'entry' : 'entries'}
                    </p>
                  </div>

                  {activeTimer && activeTimer.taskId === params.taskId ? (
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 text-center">
                        {formatTime(elapsedTime)}
                      </p>
                      <button
                        onClick={handleStopTimer}
                        className="w-full px-3 py-2.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                      >
                        <Square className="h-4 w-4" />
                        Stop Timer
                      </button>
                    </div>
                  ) : activeTimer ? (
                    <div className="space-y-2">
                      <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-200">
                        Timer running on: {activeTimer.task?.title || 'another task'}
                      </div>
                      <button
                        onClick={handleStopTimer}
                        className="w-full px-3 py-2.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                      >
                        <Square className="h-4 w-4" />
                        Stop Timer
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartTimer}
                      className="w-full px-3 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <Play className="h-4 w-4" />
                      Start Timer
                    </button>
                  )}

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Manual Entry
                    </p>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      placeholder="Hours"
                      value={manualHours}
                      onChange={(e) => setManualHours(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <textarea
                      placeholder="Note (optional)"
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-y min-h-[72px]"
                    />
                    <button
                      onClick={addManualHours}
                      disabled={addingHours}
                      className="w-full px-3 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                    >
                      {addingHours ? 'Adding...' : 'Add hours'}
                    </button>
                  </div>

                  {timeEntries.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 -mx-4">
                      {timeEntries.map((entry) => (
                        <div key={entry.id} className="px-4 py-3">
                          {editingEntryId === entry.id ? (
                            <div className="space-y-2">
                              <input
                                type="number"
                                min="0"
                                step="0.25"
                                value={editEntryHours}
                                onChange={(e) => setEditEntryHours(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              <textarea
                                placeholder="Note (optional)"
                                value={editEntryNote}
                                onChange={(e) => setEditEntryNote(e.target.value)}
                                rows={3}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-y min-h-[64px]"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={saveEditEntry}
                                  className="flex-1 px-2 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingEntryId(null)}
                                  className="flex-1 px-2 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {(entry.hours || 0).toFixed(2)}h
                                </p>
                                {entry.description && (
                                  <div className="mt-0.5">
                                    <p
                                      className={`text-sm text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap ${
                                        expandedNotes[entry.id] ? '' : 'line-clamp-2'
                                      }`}
                                    >
                                      {entry.description}
                                    </p>
                                    {entry.description.length > 100 ||
                                    (entry.description.match(/\n/g) || []).length >= 2 ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedNotes((prev) => ({
                                            ...prev,
                                            [entry.id]: !prev[entry.id],
                                          }))
                                        }
                                        className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                      >
                                        {expandedNotes[entry.id] ? 'Show less' : 'Show more'}
                                      </button>
                                    ) : null}
                                  </div>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {entry.user
                                    ? `${entry.user.firstName} ${entry.user.lastName}`
                                    : 'Unknown'}{' '}
                                  · {format(new Date(entry.date), 'MMM d')}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => startEditEntry(entry)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                  title="Edit entry"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteTimeEntry(entry.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                  title="Delete entry"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Details</h2>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Issue Type</label>
                    <select
                      value={task.issueType}
                      onChange={(e) => api.patch(`/tasks/${params.taskId}`, { issueType: e.target.value }).then(() => fetchTask())}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="TASK">Task</option>
                      <option value="BUG">Bug</option>
                      <option value="STORY">Story</option>
                      <option value="EPIC">Epic</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Status</label>
                    <select
                      value={task.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        try {
                          // Update status
                          await api.patch(`/tasks/${params.taskId}`, { status: newStatus });
                          
                          // If task is on a board, try to move it to matching column
                          if (task.boardId) {
                            try {
                              // Map status to column name
                              const statusToColumnName: Record<string, string> = {
                                'TODO': 'To Do',
                                'IN_PROGRESS': 'In Progress',
                                'IN_REVIEW': 'In Review',
                                'DONE': 'Done',
                                'BLOCKED': 'Blocked'
                              };
                              
                              const targetColumnName = statusToColumnName[newStatus];
                              if (targetColumnName) {
                                // Get board columns
                                const boardResponse = await api.get(`/boards/${task.boardId}`);
                                const targetColumn = boardResponse.data.board.columns?.find(
                                  (col: any) => col.name.toLowerCase() === targetColumnName.toLowerCase()
                                );
                                
                                if (targetColumn) {
                                  await api.patch(`/tasks/${params.taskId}/move`, {
                                    columnId: targetColumn.id,
                                    boardId: task.boardId,
                                    order: 0,
                                  });
                                }
                              }
                            } catch (colError) {
                              // If column move fails, just continue - status is already updated
                              console.log('Could not move to matching column:', colError);
                            }
                          }
                          
                          fetchTask();
                        } catch (error: any) {
                          alert(error.response?.data?.error || 'Failed to update status');
                        }
                      }}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="DONE">Done</option>
                      <option value="BLOCKED">Blocked</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : ''}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Story Points</label>
                    <input
                      type="number"
                      value={task.storyPoints || ''}
                      onChange={(e) => api.patch(`/tasks/${params.taskId}`, { storyPoints: parseInt(e.target.value) || null }).then(() => fetchTask())}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Time Estimate (hours)</label>
                    <input
                      type="number"
                      value={task.timeEstimate || ''}
                      onChange={(e) => api.patch(`/tasks/${params.taskId}`, { timeEstimate: parseInt(e.target.value) || null }).then(() => fetchTask())}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Sprint - Jira Style */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                    <Rocket className="h-4 w-4" />
                    Sprint
                  </h2>
                </div>
                <div className="p-4">
                  {task.sprint ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                        <div className="flex items-center gap-2">
                          <Rocket className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{task.sprint.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {task.sprint.startDate && new Date(task.sprint.startDate).toLocaleDateString()} -{' '}
                              {task.sprint.endDate && new Date(task.sprint.endDate).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={removeTaskFromSprint}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Remove from sprint"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                      <Link
                        href={`/projects/${params.id}/sprints/${task.sprint.id}`}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View Sprint →
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            addTaskToSprint(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Add to Sprint...</option>
                        {sprints
                          .filter(s => s.status === 'PLANNED' || s.status === 'ACTIVE')
                          .map((sprint) => (
                            <option key={sprint.id} value={sprint.id}>
                              {sprint.name} {sprint.status === 'ACTIVE' && '(Active)'}
                            </option>
                          ))}
                      </select>
                      {sprints.filter(s => s.status === 'PLANNED' || s.status === 'ACTIVE').length === 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                          No active or planned sprints. <Link href={`/projects/${params.id}/sprints`} className="text-blue-600 dark:text-blue-400 hover:underline">Create one</Link>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Assignees - Jira Style */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Assignees
                  </h2>
                </div>
                <div className="p-4">
                  <div className="space-y-2 mb-4">
                    {task.assignments?.map((assignment: any) => (
                      <div key={assignment.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium">
                            {assignment.user.firstName[0]}{assignment.user.lastName[0]}
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{assignment.user.firstName} {assignment.user.lastName}</span>
                        </div>
                        <button
                          onClick={() => api.delete(`/tasks/${params.taskId}/assign/${assignment.user.id}`).then(() => fetchTask())}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select user to assign</option>
                      {allUsers
                        .filter(u => !task.assignments?.some((a: any) => a.userId === u.id))
                        .map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={() => assignUser(selectedUserId)}
                      disabled={!selectedUserId}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              </div>

              {/* Labels - Jira Style */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Labels
                  </h2>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {task.labels?.map((label: any) => (
                      <span
                        key={label.id}
                        className="px-2 py-0.5 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: label.color }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newLabel.name}
                      onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })}
                      placeholder="Label name"
                      className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
                    />
                    <input
                      type="color"
                      value={newLabel.color}
                      onChange={(e) => setNewLabel({ ...newLabel, color: e.target.value })}
                      className="w-10 h-8 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                    />
                    <button
                      onClick={addLabel}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Subtasks - Jira Style */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Subtasks
                  </h2>
                  <button
                    onClick={generateSubtasks}
                    disabled={generatingSubtasks}
                    className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 flex items-center gap-1"
                    title="Generate subtasks with AI"
                  >
                    <Sparkles className="h-3 w-3" />
                    {generatingSubtasks ? 'Generating...' : 'AI Generate'}
                  </button>
                </div>
                <div className="p-4">
                  {subtasks.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No subtasks yet. Click "AI Generate" to create subtasks automatically.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {subtasks.map((subtask) => (
                        <label key={subtask.id} className="flex items-start gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={subtask.isCompleted}
                            onChange={() => toggleSubtask(subtask.id, subtask.isCompleted)}
                            className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className={`text-sm flex-1 ${subtask.isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                            {subtask.title}
                            {subtask.isAIGenerated && (
                              <span className="ml-2 text-xs text-blue-500">(AI)</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Attachments - Jira Style */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Attachments ({task.attachments?.length || 0})
                  </h2>
                </div>
                <div className="p-4">
                  {task.attachments && task.attachments.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {task.attachments.map((attachment: any) => (
                        <div key={attachment.id} className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded group">
                          <a
                            href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/uploads/${attachment.filePath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            {attachment.fileName}
                          </a>
                          <button
                            onClick={() => api.delete(`/tasks/attachments/${attachment.id}`).then(() => fetchTask())}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="block">
                    <input
                      type="file"
                      onChange={uploadFile}
                      disabled={uploadingFile}
                      className="hidden"
                      id="file-upload"
                    />
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded cursor-pointer transition-colors">
                      <Paperclip className="h-3.5 w-3.5" />
                      {uploadingFile ? 'Uploading...' : 'Upload File'}
                    </span>
                  </label>
                </div>
              </div>
          </div>
        </div>
        </main>
      </div>
    </Layout>
  );
}

