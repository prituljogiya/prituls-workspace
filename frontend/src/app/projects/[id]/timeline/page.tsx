'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { ArrowLeft, Clock, History } from 'lucide-react';
import { format } from 'date-fns';

type TimelineItem = {
  id: string;
  action: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null;
  task?: {
    id: string;
    title: string;
    status?: string;
    issueType?: string;
  } | null;
};

function actionLabel(action: string) {
  return (action || 'updated').replace(/_/g, ' ');
}

export default function ProjectTimelinePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, loading: authLoading } = useAuth();
  const { can, loading: permLoading } = usePermissions();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || permLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!can('timeline.view')) {
      router.push(`/projects/${projectId}`);
      return;
    }
    if (projectId) fetchTimeline();
  }, [user, authLoading, permLoading, projectId, can, router]);

  const fetchTimeline = async () => {
    try {
      setError('');
      const res = await api.get(`/projects/${projectId}/timeline`);
      setItems(res.data.activities || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || permLoading || loading) {
    return (
      <Layout projectId={projectId}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout projectId={projectId}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <Link
                href={`/projects/${projectId}`}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <History className="h-6 w-6" />
                  Timeline
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Recent task activity across this project
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          {items.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No activity yet</p>
              <p className="mt-1 text-sm">Task creates, moves, and status changes will show up here.</p>
            </div>
          ) : (
            <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-3 space-y-6">
              {items.map((item) => {
                const name = item.user
                  ? `${item.user.firstName || ''} ${item.user.lastName || ''}`.trim() || item.user.email
                  : 'Someone';
                const initials = item.user
                  ? `${item.user.firstName?.[0] || ''}${item.user.lastName?.[0] || ''}` || '?'
                  : '?';
                return (
                  <li key={item.id} className="ml-6">
                    <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-[10px] font-semibold text-white">
                      {initials}
                    </span>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
                      <p className="text-sm text-gray-800 dark:text-gray-200">
                        <span className="font-medium">{name}</span>{' '}
                        <span className="text-gray-600 dark:text-gray-400">{actionLabel(item.action)}</span>
                        {item.task && (
                          <>
                            {' '}
                            <Link
                              href={`/projects/${projectId}/tasks/${item.task.id}`}
                              className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              {item.task.title}
                            </Link>
                          </>
                        )}
                        {item.newValue && (
                          <span className="text-gray-500 dark:text-gray-400"> → {item.newValue}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {format(new Date(item.createdAt), 'MMM d, yyyy h:mm a')}
                        {item.oldValue ? ` · from ${item.oldValue}` : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </main>
      </div>
    </Layout>
  );
}
