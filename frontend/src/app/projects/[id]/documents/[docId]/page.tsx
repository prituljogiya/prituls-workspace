'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { ArrowLeft, Eye, Pencil, Save, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from 'date-fns';
import { canManageDocuments } from '@/utils/rbac';

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = Array.isArray(params.id) ? params.id[0] : params.id;
  const documentId = Array.isArray(params.docId) ? params.docId[0] : params.docId;
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const canEdit = user?.role ? canManageDocuments(user.role) : false;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && documentId) fetchDocument();
  }, [user, authLoading, documentId, router]);

  useEffect(() => {
    if (!canEdit) setMode('preview');
  }, [canEdit]);

  const fetchDocument = async () => {
    try {
      const res = await api.get(`/documents/${documentId}`);
      const doc = res.data.document;
      setTitle(doc.title || '');
      setContent(doc.content || '');
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

  const save = async () => {
    if (!canEdit) return;
    try {
      setSaving(true);
      setSaveMsg('');
      const res = await api.put(`/documents/${documentId}`, { title, content });
      setUpdatedAt(res.data.document.updatedAt);
      setDirty(false);
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete “${title}”?`)) return;
    try {
      await api.delete(`/documents/${documentId}`);
      router.push(`/projects/${projectId}/documents`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const preview = useMemo(
    () => (
      <div className="doc-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content || '_No content yet._'}
        </ReactMarkdown>
      </div>
    ),
    [content]
  );

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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
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
                />
              ) : (
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{title}</h1>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {saveMsg && <span className="text-xs text-green-600 dark:text-green-400">{saveMsg}</span>}
              {updatedAt && (
                <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                  {creatorName && `${creatorName} · `}
                  {format(new Date(updatedAt), 'MMM d, h:mm a')}
                  {dirty ? ' · unsaved' : ''}
                </span>
              )}
              {canEdit && (
                <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                  <button
                    type="button"
                    onClick={() => setMode('edit')}
                    className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${
                      mode === 'edit'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('preview')}
                    className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${
                      mode === 'preview'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>
                </div>
              )}
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !dirty}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    className="p-2 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {mode === 'edit' && canEdit ? (
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              spellCheck
              className="w-full min-h-[70vh] font-mono text-sm leading-relaxed p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
              placeholder="Write Markdown here…"
            />
          ) : (
            <div className="min-h-[70vh] p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              {preview}
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
