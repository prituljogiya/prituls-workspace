'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { BoardView } from '@/components/BoardView';
import api from '@/lib/api';
import { ArrowLeft, Settings } from 'lucide-react';

export default function BoardDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [board, setBoard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && params.boardId) {
      fetchBoard();
    }
  }, [user, authLoading, params.boardId, router]);

  const fetchBoard = async () => {
    try {
      const response = await api.get(`/boards/${params.boardId}`);
      setBoard(response.data.board);
    } catch (error) {
      console.error('Failed to fetch board:', error);
    } finally {
      setLoading(false);
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

  return (
    <Layout projectId={params.id as string}>
      <div className="h-screen flex flex-col">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 flex-shrink-0 sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{board?.name || 'Board'}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{board?.description || ''}</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <Settings className="h-4 w-4" />
                Settings
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden p-4">
          {board && (
            <BoardView boardId={params.boardId as string} projectId={params.id as string} />
          )}
        </main>
      </div>
    </Layout>
  );
}

