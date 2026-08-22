'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { RoleGuard } from '@/components/RoleGuard';
import { BoardSwitcher } from '@/components/BoardSwitcher';
import { Plus, Trash2, Search, Columns3, LayoutDashboard } from 'lucide-react';
import { format } from 'date-fns';

export default function BoardsPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && params.id) {
      fetchBoards();
    }
  }, [user, authLoading, params.id, router]);

  const fetchBoards = async () => {
    try {
      const response = await api.get(`/boards/project/${params.id}`);
      setBoards(response.data.boards || []);
    } catch (error) {
      console.error('Failed to fetch boards:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBoard = async () => {
    try {
      const response = await api.post('/boards', {
        name: newBoardName,
        description: newBoardDesc,
        projectId: params.id,
      });
      setBoards([...boards, response.data.board]);
      setShowCreateModal(false);
      setNewBoardName('');
      setNewBoardDesc('');
      router.push(`/projects/${params.id}/boards/${response.data.board.id}`);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create board');
    }
  };

  const deleteBoard = async (boardId: string) => {
    if (!confirm('Are you sure you want to delete this board?')) return;
    try {
      await api.delete(`/boards/${boardId}`);
      setBoards(boards.filter((b) => b.id !== boardId));
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete board');
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter(
      (b) =>
        b.name?.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q)
    );
  }, [boards, query]);

  if (loading || authLoading) {
    return (
      <Layout projectId={params.id as string}>
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout projectId={params.id as string}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Boards</h1>
                  <BoardSwitcher projectId={params.id as string} />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {boards.length} board{boards.length === 1 ? '' : 's'} · search and jump in
                </p>
              </div>
              <RoleGuard permission="boards.create">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4" />
                  New Board
                </button>
              </RoleGuard>
            </div>
            {boards.length > 0 && (
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a board by name…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            )}
          </div>
        </header>

        <main className="p-6">
          {boards.length === 0 ? (
            <div className="text-center py-12">
              <LayoutDashboard className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No boards yet. Create your first board to get started!
              </p>
              <RoleGuard permission="boards.create">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4" />
                  Create Board
                </button>
              </RoleGuard>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No boards match “{query}”.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((board) => {
                const taskCount =
                  board._count?.tasks ??
                  board.columns?.reduce((sum: number, col: any) => sum + (col._count?.tasks || 0), 0) ??
                  0;
                return (
                  <div
                    key={board.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-lg transition-all p-5 relative group"
                  >
                    <Link href={`/projects/${params.id}/boards/${board.id}`} className="block">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                          <Columns3 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                            {board.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {board.description || 'Open this board'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>{board._count?.columns || board.columns?.length || 0} columns</span>
                        <span>·</span>
                        <span>{taskCount} tasks</span>
                        {board.updatedAt && (
                          <>
                            <span>·</span>
                            <span>Updated {format(new Date(board.updatedAt), 'MMM d')}</span>
                          </>
                        )}
                      </div>
                    </Link>
                    <RoleGuard permission="boards.manage">
                      <button
                        type="button"
                        onClick={() => deleteBoard(board.id)}
                        className="absolute top-3 right-3 p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete board"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </RoleGuard>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create New Board</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Board Name *
                  </label>
                  <input
                    type="text"
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="My Board"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newBoardDesc}
                    onChange={(e) => setNewBoardDesc(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Board description..."
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={createBoard}
                  disabled={!newBoardName}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewBoardName('');
                    setNewBoardDesc('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
