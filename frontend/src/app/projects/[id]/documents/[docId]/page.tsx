'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { DocumentEditor } from '@/components/DocumentEditor';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { usePermissions } from '@/contexts/PermissionContext';

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = Array.isArray(params.id) ? params.id[0] : params.id;
  const documentId = Array.isArray(params.docId) ? params.docId[0] : params.docId;
  const { user, loading: authLoading } = useAuth();
  const { can } = usePermissions();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loadedContent, setLoadedContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ title: '', content: '' });

  const canEdit = can('documents.edit');
  const canDelete = can('documents.delete');

  useEffect(() => {
    latestRef.current = { title, content };
  }, [title, content]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && documentId) fetchDocument();
  }, [user, authLoading, documentId, router]);

  const fetchDocument = async () => {
    try {
      const res = await api.get(`/documents/${documentId}`);
      const doc = res.data.document;
      setTitle(doc.title || '');
      setContent(doc.content || '');
      setLoadedContent(doc.content || '');
      setUpdatedAt(doc.updatedAt);
      if (doc.creator) {
        setCreatorName(`${doc.creator.firstName} ${doc.creator.lastName}`.trim());
      }
      setDirty(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to load document');
      router.push(`/projects/${projectId}/documents`);
    } finally {
      setLoading(false);
    }
  };

  const save = useCallback(
    async (silent = false) => {
      if (!canEdit) return;
      const { title: t, content: c } = latestRef.current;
      try {
        if (!silent) setSaving(true);
        setSaveMsg('');
        const res = await api.put(`/documents/${documentId}`, { title: t, content: c });
        setUpdatedAt(res.data.document.updatedAt);
        setDirty(false);
        setSaveMsg('Saved');
        setTimeout(() => setSaveMsg(''), 2000);
      } catch (err: any) {
        if (!silent) alert(err.response?.data?.error || 'Failed to save');
        else setSaveMsg('Save failed');
      } finally {
        setSaving(false);
      }
    },
    [canEdit, documentId]
  );

  // Autosave ~1.5s after edits (Google Docs–like)
  useEffect(() => {
    if (!canEdit || !dirty) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      save(true);
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [dirty, title, content, canEdit, save]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const remove = async () => {
    if (!canDelete) return;
    if (!confirm(`Delete “${title}”?`)) return;
    try {
      await api.delete(`/documents/${documentId}`);
      router.push(`/projects/${projectId}/documents`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
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

  return (
    <Layout projectId={projectId}>
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 z-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link
                href={`/projects/${projectId}/documents`}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              {canEdit ? (
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                  className="flex-1 min-w-0 text-lg font-semibold bg-transparent border-b border-transparent focus:border-blue-500 outline-none text-gray-900 dark:text-white py-1"
                  placeholder="Untitled document"
                />
              ) : (
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{title}</h1>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {saveMsg && (
                <span className="text-xs text-green-600 dark:text-green-400">{saveMsg}</span>
              )}
              {updatedAt && (
                <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                  {creatorName && `${creatorName} · `}
                  {format(new Date(updatedAt), 'MMM d, h:mm a')}
                  {dirty ? ' · Saving…' : ''}
                </span>
              )}
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => save(false)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              )}
              {canDelete && (
                  <button
                    type="button"
                    onClick={remove}
                    className="p-2 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 max-w-6xl w-full mx-auto px-2 sm:px-4 py-4">
          <DocumentEditor
            key={documentId}
            content={loadedContent}
            editable={canEdit}
            onChange={(html) => {
              setContent(html);
              setDirty(true);
            }}
          />
        </main>
      </div>
    </Layout>
  );
}
