'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import {
  GitPullRequest,
  ExternalLink,
  RefreshCw,
  Settings,
  AlertCircle,
  GitBranch,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type PullRequest = {
  id: number;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  user: { login: string; avatarUrl: string; htmlUrl: string } | null;
  head: string | null;
  base: string | null;
  labels: { name: string; color: string }[];
};

export default function ProjectPullRequestsPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [pulls, setPulls] = useState<PullRequest[]>([]);
  const [repo, setRepo] = useState<{ fullName: string; htmlUrl: string } | null>(null);
  const [configured, setConfigured] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && params.id) {
      loadConfigAndPulls();
    }
  }, [user, authLoading, params.id, router, stateFilter]);

  const loadConfigAndPulls = async () => {
    try {
      setLoading(true);
      setError(null);
      const configRes = await api.get(`/projects/${params.id}/github`);
      setConfigured(Boolean(configRes.data.configured));
      setHasToken(Boolean(configRes.data.hasToken));
      if (configRes.data.parsed) {
        setRepo({
          fullName: configRes.data.parsed.fullName,
          htmlUrl: configRes.data.parsed.htmlUrl,
        });
      } else {
        setRepo(null);
        setPulls([]);
        return;
      }

      const pullsRes = await api.get(`/projects/${params.id}/github/pulls`, {
        params: { state: stateFilter, per_page: 50 },
      });
      setPulls(pullsRes.data.pulls || []);
      if (pullsRes.data.repo) {
        setRepo({
          fullName: pullsRes.data.repo.fullName,
          htmlUrl: pullsRes.data.repo.htmlUrl,
        });
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Failed to load GitHub pull requests';
      setError(msg);
      setPulls([]);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadConfigAndPulls();
    setRefreshing(false);
  };

  const statusBadge = (pr: PullRequest) => {
    if (pr.mergedAt) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200';
    }
    if (pr.draft) {
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
    }
    if (pr.state === 'open') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
    }
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  };

  const statusLabel = (pr: PullRequest) => {
    if (pr.mergedAt) return 'Merged';
    if (pr.draft) return 'Draft';
    return pr.state === 'open' ? 'Open' : 'Closed';
  };

  if (authLoading || (loading && !refreshing)) {
    return (
      <Layout projectId={params.id as string}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout projectId={params.id as string}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <GitPullRequest className="h-6 w-6" />
                Pull Requests
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                GitHub PRs linked to this project
                {repo ? (
                  <>
                    {' '}
                    ·{' '}
                    <a
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {repo.fullName}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value as any)}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="all">All</option>
              </select>
              <button
                onClick={refresh}
                disabled={refreshing || !configured}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <Link
                href={`/projects/${params.id}/settings`}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Link repo
              </Link>
            </div>
          </div>

          {!configured && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
              <GitPullRequest className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Connect a GitHub repository
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
                Link a GitHub repo in project settings to show pull requests here in the portal.
              </p>
              <Link
                href={`/projects/${params.id}/settings`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <Settings className="h-4 w-4" />
                Open Project Settings
              </Link>
            </div>
          )}

          {configured && error && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{error}</p>
                {!hasToken && (
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                    For private repos, add <code className="px-1 bg-amber-100 dark:bg-amber-900/50 rounded">GITHUB_TOKEN</code> to the backend environment.
                  </p>
                )}
              </div>
            </div>
          )}

          {configured && !error && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  {stateFilter} PRs ({pulls.length})
                </h2>
                {repo && (
                  <a
                    href={`${repo.htmlUrl}/pulls`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    Open on GitHub
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {pulls.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                    No {stateFilter} pull requests found.
                  </div>
                ) : (
                  pulls.map((pr) => (
                    <a
                      key={pr.id}
                      href={pr.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {pr.user?.avatarUrl ? (
                          <img
                            src={pr.user.avatarUrl}
                            alt={pr.user.login}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-gray-900 dark:text-white">
                              #{pr.number} {pr.title}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded ${statusBadge(pr)}`}
                            >
                              {statusLabel(pr)}
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-3">
                            <span>{pr.user?.login || 'unknown'}</span>
                            <span>
                              updated{' '}
                              {formatDistanceToNow(new Date(pr.updatedAt), { addSuffix: true })}
                            </span>
                            {(pr.head || pr.base) && (
                              <span className="flex items-center gap-1">
                                <GitBranch className="h-3 w-3" />
                                {pr.head} → {pr.base}
                              </span>
                            )}
                          </div>
                          {pr.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {pr.labels.map((label) => (
                                <span
                                  key={label.name}
                                  className="px-1.5 py-0.5 text-[10px] rounded border border-gray-200 dark:border-gray-600"
                                  style={{
                                    borderColor: `#${label.color}`,
                                    color: `#${label.color}`,
                                  }}
                                >
                                  {label.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
