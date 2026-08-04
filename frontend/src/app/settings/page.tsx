'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Layout } from '@/components/Layout';
import { KeyRound, Shield } from 'lucide-react';

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (form.newPassword.length < 6) {
      setMessage({ type: 'err', text: 'New password must be at least 6 characters' });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setMessage({ type: 'err', text: 'New password and confirmation do not match' });
      return;
    }

    try {
      setSaving(true);
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'ok', text: 'Password changed successfully' });
    } catch (error: any) {
      const err =
        error.response?.data?.error ||
        error.response?.data?.errors?.[0]?.msg ||
        'Failed to change password';
      setMessage({ type: 'err', text: err });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Account Settings</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage your profile security
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium">
                {user.firstName?.[0]}
                {user.lastName?.[0]}
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{user.role}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Change Password</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Use a strong password you don’t reuse elsewhere
            </p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Current password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={form.currentPassword}
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  New password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={form.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Confirm new password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
