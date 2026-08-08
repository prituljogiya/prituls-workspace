'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { RoleGuard } from '@/components/RoleGuard';
import { canManageInvoices } from '@/utils/rbac';
import { Save, Archive, Users } from 'lucide-react';

function getProjectId(params: ReturnType<typeof useParams>): string | undefined {
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || id === 'new') return undefined;
  return id;
}

export default function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = getProjectId(params);
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366f1',
    invoicesEnabled: false,
    githubRepo: '',
  });

  const fetchProject = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/projects/${id}`);
      const proj = response.data.project;
      setProject(proj);
      setFormData({
        name: proj.name,
        description: proj.description || '',
        color: proj.color || '#6366f1',
        invoicesEnabled: !!proj.invoicesEnabled,
        githubRepo: proj.githubRepo || '',
      });
    } catch (error) {
      console.error('Failed to fetch project:', error);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    fetchProject(projectId);
  }, [user, authLoading, projectId, router, fetchProject]);

  const handleSave = async () => {
    if (!projectId) return;
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        name: formData.name,
        description: formData.description,
        color: formData.color,
        githubRepo: formData.githubRepo,
      };
      // Only Super Admin can show/hide the Invoices module
      if (user?.role && canManageInvoices(user.role)) {
        payload.invoicesEnabled = formData.invoicesEnabled;
      }
      await api.patch(`/projects/${projectId}`, payload);
      if (typeof payload.invoicesEnabled === 'boolean') {
        try {
          sessionStorage.setItem(
            `pms:inv:${projectId}`,
            payload.invoicesEnabled ? '1' : '0'
          );
          window.dispatchEvent(
            new CustomEvent('pms:invoices-enabled', {
              detail: { projectId, enabled: payload.invoicesEnabled },
            })
          );
        } catch {
          /* ignore */
        }
      }
      alert('Project updated successfully!');
      fetchProject(projectId);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!projectId) return;
    if (!confirm('Are you sure you want to archive this project?')) return;
    try {
      await api.patch(`/projects/${projectId}/archive`);
      alert('Project archived successfully!');
      router.push('/dashboard');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to archive project');
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!project || !projectId) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-900 p-6">
          <p className="text-lg text-gray-900 dark:text-white">Project not found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
            Open a project first, then use Settings from that project&apos;s sidebar.
          </p>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout projectId={projectId}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-10">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Project Settings</h1>
          </div>
        </header>

        <main className="p-6 max-w-4xl">
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">General</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Project Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Color</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    GitHub repository
                  </label>
                  <input
                    type="text"
                    value={formData.githubRepo}
                    onChange={(e) => setFormData({ ...formData, githubRepo: e.target.value })}
                    placeholder="owner/repo or https://github.com/owner/repo"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Used by the Pull Requests page. Private repos need GITHUB_TOKEN in backend .env.
                  </p>
                </div>
                <RoleGuard allowedRoles={['SUPER_ADMIN']}>
                  <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Invoices module</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        You always see Invoices. Turn this on so VIEWER (and other allowed roles) can view invoices for this project.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.invoicesEnabled}
                      onClick={() =>
                        setFormData({ ...formData, invoicesEnabled: !formData.invoicesEnabled })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        formData.invoicesEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          formData.invoicesEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </RoleGuard>
                <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </RoleGuard>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Members ({project.members?.length || 0})
                </h2>
                <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
                  <Link
                    href={`/projects/${projectId}/members`}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm"
                  >
                    Manage Members
                  </Link>
                </RoleGuard>
              </div>
              <div className="space-y-2">
                {project.members?.map((member: any) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center">
                        {member.user?.firstName?.[0] || '?'}
                        {member.user?.lastName?.[0] || ''}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {member.user?.firstName} {member.user?.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{member.user?.email}</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Account security</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Change your login password from account settings.
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:opacity-90 text-sm font-medium"
              >
                Change Password
              </Link>
            </div>

            <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-2 border-red-200 dark:border-red-700">
                <h2 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-4">Danger Zone</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/50 rounded-lg">
                    <div>
                      <h3 className="font-medium text-red-900 dark:text-red-200">Archive Project</h3>
                      <p className="text-sm text-red-700 dark:text-red-200">Archive this project. It can be restored later.</p>
                    </div>
                    <button
                      onClick={handleArchive}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <Archive className="h-4 w-4" />
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            </RoleGuard>
          </div>
        </main>
      </div>
    </Layout>
  );
}
