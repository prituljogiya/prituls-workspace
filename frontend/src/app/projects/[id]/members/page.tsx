'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { RoleGuard } from '@/components/RoleGuard';
import { X, UserPlus } from 'lucide-react';

export default function MembersPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('TEAM_MEMBER');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && params.id) {
      fetchProject();
      fetchUsers();
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

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setAllUsers(response.data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const addMember = async () => {
    if (!selectedUserId) return;
    try {
      await api.post(`/projects/${params.id}/members`, {
        userId: selectedUserId,
        role: selectedRole,
      });
      setShowAddModal(false);
      setSelectedUserId('');
      fetchProject();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add member');
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      await api.delete(`/projects/${params.id}/members/${memberId}`);
      fetchProject();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove member');
    }
  };

  const availableUsers = allUsers.filter(
    (u) => !project?.members?.some((m: any) => m.userId === u.id)
  );

  if (loading || authLoading) {
    return (
      <Layout projectId={params.id as string}>
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout projectId={params.id as string}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Members</h1>
                {project?.name && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{project.name}</p>
                )}
              </div>
              <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  Add Member
                </button>
              </RoleGuard>
            </div>
          </div>
        </header>

        <main className="p-6 max-w-4xl">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {!project?.members?.length ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No members yet.
                </div>
              ) : (
                project.members.map((member: any) => (
                  <div
                    key={member.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center shrink-0 font-medium">
                        {member.user.firstName?.[0] || ''}
                        {member.user.lastName?.[0] || ''}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {member.user.firstName} {member.user.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']}>
                        <select
                          value={member.role}
                          onChange={async (e) => {
                            try {
                              await api.patch(`/projects/${params.id}/members/${member.id}`, {
                                role: e.target.value,
                              });
                              fetchProject();
                            } catch (error: any) {
                              alert(error.response?.data?.error || 'Failed to update role');
                            }
                          }}
                          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="PROJECT_MANAGER">Project Manager</option>
                          <option value="TEAM_MEMBER">Team Member</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeMember(member.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                          title="Remove member"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </RoleGuard>
                      {!['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'].includes(
                        user?.role || ''
                      ) && (
                        <span className="text-sm text-gray-600 dark:text-gray-300 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">
                          {member.role?.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Team Member</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    User
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select a user</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="PROJECT_MANAGER">Project Manager</option>
                    <option value="TEAM_MEMBER">Team Member</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={addMember}
                  disabled={!selectedUserId}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedUserId('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
