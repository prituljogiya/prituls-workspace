'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { RoleGuard } from '@/components/RoleGuard';
import { Github, Save, Trash2, RefreshCw, ShieldCheck } from 'lucide-react';

type GithubStatus = {
  configured: boolean;
  source: 'admin' | 'env' | null;
  maskedToken: string | null;
};

export default function AdminIntegrationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && user.role !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    if (user) loadStatus();
  }, [user, authLoading, router]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/settings/github');
      setStatus(data);
    } catch (error: any) {
      setMessage({
        type: 'err',
        text: error.response?.data?.error || 'Failed to load settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveToken = async () => {
    setMessage(null);
    if (!token.trim()) {
      setMessage({ type: 'err', text: 'Paste a GitHub token first' });
      return;
    }
    try {
      setSaving(true);
      const { data } = await api.put('/settings/github', { token: token.trim() });
      setStatus({
        configured: data.configured,
        source: data.source,
        maskedToken: data.maskedToken,
      });
      setToken('');
      setMessage({ type: 'ok', text: 'GitHub token saved for workspace access' });
    } catch (error: any) {
      setMessage({
        type: 'err',
        text:
          error.response?.data?.details ||
          error.response?.data?.error ||
          'Failed to save token',
      });
    } finally {
      setSaving(false);
    }
  };

  const clearToken = async () => {
    if (!confirm('Clear the admin-saved GitHub token?')) return;
    setMessage(null);
    try {
      setSaving(true);
      const { data } = await api.delete('/settings/github');
      setStatus({
        configured: data.configured,
        source: data.source,
        maskedToken: data.maskedToken,
      });
      setMessage({ type: 'ok', text: data.message });
    } catch (error: any) {
      setMessage({
        type: 'err',
        text: error.response?.data?.error || 'Failed to clear token',
      });
    } finally {
      setSaving(false);
    }
  };

  const testToken = async () => {
    setMessage(null);
    try {
      setTesting(true);
      const { data } = await api.post('/settings/github/test');
      if (data.ok) {
        setMessage({
          type: 'ok',
          text: `Connected as @${data.login}${data.name ? ` (${data.name})` : ''}`,
        });
      } else {
        setMessage({ type: 'err', text: data.error || 'Test failed' });
      }
    } catch (error: any) {
      setMessage({
        type: 'err',
        text: error.response?.data?.error || 'GitHub connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  if (authLoading || !user || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Github className="h-6 w-6" />
              Integrations
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Super Admin — GitHub token for workspace access
            </p>
          </div>
        </header>

        <main className="p-6 max-w-2xl">
          <RoleGuard allowedRoles={['SUPER_ADMIN']}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">GitHub</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Store a personal access token so the app can reach private GitHub workspaces.
                  The full token is never shown again after you save.
                </p>
              </div>

              {status && (
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm">
                  <p className="text-gray-700 dark:text-gray-200">
                    Status:{' '}
                    <span className={status.configured ? 'text-green-600 dark:text-green-400' : 'text-amber-600'}>
                      {status.configured ? 'Configured' : 'Not configured'}
                    </span>
                  </p>
                  {status.configured && (
                    <>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Source: {status.source === 'admin' ? 'Admin settings' : 'Environment (.env)'}
                      </p>
                      <p className="font-mono text-xs text-gray-500 mt-1">{status.maskedToken}</p>
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Personal access token
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_… or github_pat_…"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {message && (
                <p
                  className={`text-sm ${
                    message.type === 'ok'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {message.text}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveToken}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save token'}
                </button>
                <button
                  type="button"
                  onClick={testToken}
                  disabled={testing || !status?.configured}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {testing ? 'Testing…' : 'Test connection'}
                </button>
                <button
                  type="button"
                  onClick={loadStatus}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
                {status?.source === 'admin' && (
                  <button
                    type="button"
                    onClick={clearToken}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 dark:border-red-900 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear
                  </button>
                )}
              </div>
            </div>
          </RoleGuard>
        </main>
      </div>
    </Layout>
  );
}
