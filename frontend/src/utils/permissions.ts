export const PERMISSION_KEYS = [
  'projects.view',
  'projects.create',
  'projects.manage',
  'boards.create',
  'boards.manage',
  'tasks.create',
  'tasks.edit',
  'tasks.delete',
  'sprints.create',
  'sprints.manage',
  'sprints.assign',
  'members.manage',
  'reports.view',
  'pullRequests.view',
  'documents.view',
  'documents.create',
  'documents.edit',
  'documents.delete',
  'timeline.view',
  'time.view',
  'time.track',
  'time.approve',
  'invoices.view',
  'invoices.manage',
  'invoices.pay',
  'contracts.manage',
  'workspaces.manage',
  'users.manage',
  'settings.manage',
  'permissions.manage',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionMatrix = Record<string, Record<string, boolean>>;

export type PermissionCatalog = {
  roles: Array<{ key: string; label: string; locked: boolean }>;
  groups: Array<{ id: string; label: string }>;
  permissions: Array<{
    key: PermissionKey | string;
    label: string;
    description: string;
    group: string;
  }>;
};

/** Defaults used before /api/permissions loads — viewers cannot mutate documents. */
const FALLBACK_ALLOWED: Record<string, string[]> = {
  SUPER_ADMIN: [...PERMISSION_KEYS],
  WORKSPACE_OWNER: PERMISSION_KEYS.filter((k) => !['invoices.manage', 'settings.manage', 'permissions.manage'].includes(k)),
  PROJECT_MANAGER: [
    'projects.view',
    'projects.create',
    'projects.manage',
    'boards.create',
    'boards.manage',
    'tasks.create',
    'tasks.edit',
    'tasks.delete',
    'sprints.create',
    'sprints.manage',
    'sprints.assign',
    'members.manage',
    'reports.view',
    'pullRequests.view',
    'documents.view',
    'documents.create',
    'documents.edit',
    'documents.delete',
    'timeline.view',
    'time.view',
    'time.approve',
    'invoices.view',
    'invoices.pay',
    'contracts.manage',
  ],
  TEAM_MEMBER: [
    'projects.view',
    'tasks.create',
    'tasks.edit',
    'sprints.create',
    'sprints.assign',
    'pullRequests.view',
    'documents.view',
    'documents.create',
    'documents.edit',
    'documents.delete',
    'timeline.view',
    'time.view',
    'time.track',
    'invoices.pay',
  ],
  VIEWER: [
    'projects.view',
    'pullRequests.view',
    'documents.view',
    'timeline.view',
    'invoices.view',
    'invoices.pay',
  ],
};

let liveMatrix: PermissionMatrix | null = null;

export function setLivePermissionMatrix(matrix: PermissionMatrix | null) {
  liveMatrix = matrix;
}

export function roleHasPermission(role: string | undefined, permission: string): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;
  if (liveMatrix?.[role] && typeof liveMatrix[role][permission] === 'boolean') {
    return liveMatrix[role][permission];
  }
  return FALLBACK_ALLOWED[role]?.includes(permission) ?? false;
}
