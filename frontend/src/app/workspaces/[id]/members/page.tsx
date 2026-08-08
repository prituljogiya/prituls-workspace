'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { X, UserPlus } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';

export default function WorkspaceMembersPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [workspace, setWorkspace] = useState<any>(null);
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
      fetchWorkspace();
      fetchUsers();
    }
  }, [user, authLoading, params.id, router]);

  const fetchWorkspace = async () => {
    try {
      const response = await api.get(`/workspaces/${params.id}`);
      setWorkspace(response.data.workspace);
    } catch (error) {
      console.error('Failed to fetch workspace:', error);
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
      await api.post(`/workspaces/${params.id}/members`, {
        userId: selectedUserId,
        role: selectedRole,
      });
      setShowAddModal(false);
      setSelectedUserId('');
      fetchWorkspace();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add member');
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      await api.delete(`/workspaces/${params.id}/members/${memberId}`);
      fetchWorkspace();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove member');
    }
  };

  const availableUsers = allUsers.filter(
    (u) => !workspace?.members?.some((m: any) => m.userId === u.id)
  );

  if (loading || authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workspace Members</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{workspace?.name}</p>
              </div>
              <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER']}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <UserPlus className="h-4 w-4" />
                  Add Member
                </button>
              </RoleGuard>
            </div>
          </div>
        </header>

        <main className="p-6 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {!workspace?.members?.length ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">No members yet.</div>
              ) : (
                workspace.members.map((member: any) => (
                  <div
                    key={member.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center shrink-0">
                        {member.user.firstName?.[0]}
                        {member.user.lastName?.[0]}
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
                      <RoleGuard allowedRoles={['SUPER_ADMIN', 'WORKSPACE_OWNER']}>
                        <select
                          value={member.role}
                          onChange={async (e) => {
                            try {
                              await api.patch(`/workspaces/${params.id}/members/${member.id}`, {
                                role: e.target.value,
                              });
                              fetchWorkspace();
                            } catch (error: any) {
                              alert(error.response?.data?.error || 'Failed to update role');
                            }
                          }}
                          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="WORKSPACE_OWNER">Workspace Owner</option>
                          <option value="PROJECT_MANAGER">Project Manager</option>
                          <option value="TEAM_MEMBER">Team Member</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeMember(member.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </RoleGuard>
                      {!['SUPER_ADMIN', 'WORKSPACE_OWNER'].includes(user?.role || '') && (
                        <span className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                          {member.role}
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
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                Add Workspace Member
              </h2>
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
              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={addMember}
                  disabled={!selectedUserId}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedUserId('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
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
