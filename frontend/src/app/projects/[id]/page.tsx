'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { ArrowLeft, Settings, Users, Plus } from 'lucide-react';

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user && params.id) {
      fetchProject();
    }
  }, [user, authLoading, params.id, router]);

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${params.id}`);
      setProject(response.data.project);
    } catch (error) {
      console.error('Failed to fetch project:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!project) {
    return <div>Project not found</div>;
  }

  return (
    <Layout projectId={params.id as string}>
      <div className="min-h-screen">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{project.description || 'No description'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/projects/${params.id}/members`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <Users className="h-4 w-4" />
                  {project.members.length} Members
                </Link>
                <Link
                  href={`/projects/${params.id}/settings`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Link
            href={`/projects/${params.id}/boards`}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Boards
          </Link>
          <Link
            href={`/projects/${params.id}/backlog`}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Backlog
          </Link>
          <Link
            href={`/projects/${params.id}/sprints`}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Sprints
          </Link>
          <Link
            href={`/projects/${params.id}/reports`}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Reports
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Boards</h3>
            <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{project._count.boards}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tasks</h3>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{project._count.tasks}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sprints</h3>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{project._count.sprints}</p>
          </div>
        </div>

        {project.boards && project.boards.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Boards</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.boards.map((board: any) => (
                <Link
                  key={board.id}
                  href={`/projects/${params.id}/boards/${board.id}`}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{board.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{board.description || 'No description'}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
        </main>
      </div>
    </Layout>
  );
}

