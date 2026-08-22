'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { BoardView } from '@/components/BoardView';
import { BoardSwitcher } from '@/components/BoardSwitcher';
import { PageHeader, PageSpinner } from '@/components/PageHeader';
import api from '@/lib/api';
import { ArrowLeft } from 'lucide-react';

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
        <PageSpinner />
      </Layout>
    );
  }

  return (
    <Layout projectId={params.id as string}>
      <div className="h-[calc(100vh-3.5rem)] flex flex-col">
        <PageHeader
          title={
            <span className="inline-flex items-center gap-3 min-w-0">
              <Link
                href={`/projects/${params.id}/boards`}
                className="text-gray-400 hover:text-gray-800 dark:hover:text-white"
                title="All boards"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <BoardSwitcher
                projectId={params.id as string}
                currentBoardId={params.boardId as string}
                currentName={board?.name}
              />
            </span>
          }
          subtitle={board?.description || undefined}
        />
        <main className="flex-1 overflow-hidden px-3 sm:px-4 pb-4">
          {board && (
            <BoardView boardId={params.boardId as string} projectId={params.id as string} />
          )}
        </main>
      </div>
    </Layout>
  );
}
