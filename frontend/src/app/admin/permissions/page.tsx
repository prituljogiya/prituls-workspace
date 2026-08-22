'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { Layout } from '@/components/Layout';
import { PermissionMatrix } from '@/utils/permissions';
import { Check, RotateCcw, Save, Shield } from 'lucide-react';

export default function PermissionsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { catalog, matrix, loading, saveMatrix, can } = usePermissions();
  const [draft, setDraft] = useState<PermissionMatrix>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!can('permissions.manage') && user.role !== 'SUPER_ADMIN') {
      router.push('/dashboard');
    }
  }, [user, authLoading, can, router]);

  useEffect(() => {
    if (matrix) setDraft(structuredClone(matrix));
  }, [matrix]);

  const roles = catalog?.roles || [];
  const groups = catalog?.groups || [];
  const permissions = catalog?.permissions || [];

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(matrix || {}), [draft, matrix]);

  const toggle = (role: string, key: string, locked: boolean) => {
    if (locked) return;
    setDraft((prev) => ({
      ...prev,
      [role]: {
        ...(prev[role] || {}),
        [key]: !prev[role]?.[key],
      },
    }));
    setMessage(null);
  };

  const save = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await saveMatrix(draft);
      setMessage({ type: 'ok', text: 'Permissions saved. Users pick this up on their next page load.' });
    } catch (error: any) {
      setMessage({
        type: 'err',
        text: error.response?.data?.error || 'Failed to save permissions',
      });
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (!matrix) return;
    setDraft(structuredClone(matrix));
    setMessage(null);
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Role permissions
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Super Admin can tick or untick what each role can do across PMS, documents, and timeline.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetDefaults}
                disabled={!dirty}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                <RotateCcw className="h-4 w-4" />
                Discard
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !dirty}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </header>

        <main className="p-6 max-w-[1100px]">
          {message && (
            <div
              className={`mb-4 px-4 py-3 rounded-lg text-sm ${
                message.type === 'ok'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Super Admin is always fully enabled. Viewers are read-only for documents unless you tick create/edit/delete.
            Project members use the role assigned on that project.
          </p>

          <div className="overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/80">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 min-w-[220px]">
                    Capability
                  </th>
                  {roles.map((role) => (
                    <th
                      key={role.key}
                      className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap"
                    >
                      {role.label}
                      {role.locked && (
                        <span className="block text-[10px] uppercase tracking-wide text-gray-400">locked</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const groupPerms = permissions.filter((p) => p.group === group.id);
                  if (!groupPerms.length) return null;
                  return (
                    <FragmentGroup key={group.id} label={group.label} colSpan={roles.length + 1}>
                      {groupPerms.map((perm) => (
                        <tr
                          key={perm.key}
                          className="border-t border-gray-100 dark:border-gray-700/80 hover:bg-gray-50/70 dark:hover:bg-gray-700/30"
                        >
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-900 dark:text-white">{perm.label}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{perm.description}</p>
                          </td>
                          {roles.map((role) => {
                            const checked = !!draft[role.key]?.[perm.key];
                            return (
                              <td key={role.key} className="px-3 py-2 text-center">
                                <label className="inline-flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-60"
                                    checked={checked}
                                    disabled={role.locked}
                                    onChange={() => toggle(role.key, perm.key, role.locked)}
                                    aria-label={`${perm.label} for ${role.label}`}
                                  />
                                  {checked && role.locked && (
                                    <Check className="h-3.5 w-3.5 text-primary-600 sr-only" />
                                  )}
                                </label>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </FragmentGroup>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </Layout>
  );
}

function FragmentGroup({
  label,
  colSpan,
  children,
}: {
  label: string;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="bg-gray-100 dark:bg-gray-900">
        <td
          colSpan={colSpan}
          className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300"
        >
          {label}
        </td>
      </tr>
      {children}
    </>
  );
}
