'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { ArrowLeft, Plus, BookOpen, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { usePermissions } from '@/contexts/PermissionContext';

type DocSummary = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  creator?: { firstName: string; lastName: string; email: string };
};

export default function DocumentsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, loading: authLoading } = useAuth();
  const { can } = usePermissions();
  const [documents, setDocuments] = useState<DocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && projectId) fetchDocuments();
  }, [user, authLoading, projectId, router]);

  const fetchDocuments = async () => {
    try {
      const res = await api.get(`/documents/project/${projectId}`);
      setDocuments(res.data.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      setCreating(true);
      const res = await api.post('/documents', {
        projectId,
        title: newTitle.trim(),
        content: `<h1>${newTitle.trim().replace(/</g, '')}</h1><p></p>`,
      });
      setShowCreate(false);
      setNewTitle('');
      router.push(`/projects/${projectId}/documents/${res.data.document.id}`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create document');
    } finally {
      setCreating(false);
    }
  };

  const deleteDocument = async (id: string, title: string) => {
    if (!confirm(`Delete “${title}”? This cannot be undone.`)) return;
    try {
      await api.delete(`/documents/${id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete document');
    }
  };

  if (loading || authLoading) {
    return (
      <Layout projectId={projectId}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  const canCreate = can('documents.create');
  const canDelete = can('documents.delete');

  return (
    <Layout projectId={projectId}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link
                  href={`/projects/${projectId}`}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="h-6 w-6" />
                    Documents
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Rich docs like Google Docs — headings, lists, links, images, autosave
                    {!canCreate && !canDelete ? ' · view only' : ''}
                  </p>
                </div>
              </div>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  New document
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {documents.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No documents yet</p>
              <p className="mt-1 text-sm">Create a README, runbook, or product brief.</p>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  New document
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <Link
                    href={`/projects/${projectId}/documents/${doc.id}`}
                    className="flex-1 min-w-0"
                  >
                    <p className="font-medium text-gray-900 dark:text-white truncate">{doc.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Updated {format(new Date(doc.updatedAt), 'MMM d, yyyy h:mm a')}
                      {doc.creator &&
                        ` · ${doc.creator.firstName} ${doc.creator.lastName}`.trim()}
                    </p>
                  </Link>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteDocument(doc.id, doc.title)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={createDocument}
            className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New document</h2>
            <label className="block mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              Title
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g. Project README"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setNewTitle('');
                }}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newTitle.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
}
