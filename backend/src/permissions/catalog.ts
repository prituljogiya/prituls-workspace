/**
 * Single source of truth for PMS role permissions.
 * Super Admin can tick/untick these in /admin/permissions.
 * Defaults below are used until an override is saved.
 */

export const USER_ROLES = [
  'SUPER_ADMIN',
  'WORKSPACE_OWNER',
  'PROJECT_MANAGER',
  'TEAM_MEMBER',
  'VIEWER',
] as const;

export type UserRoleName = (typeof USER_ROLES)[number];

export const MANAGEABLE_ROLES = USER_ROLES.filter((role) => role !== 'SUPER_ADMIN');

export const PERMISSION_GROUPS = [
  { id: 'pms', label: 'PMS — Project management' },
  { id: 'documents', label: 'Documents' },
  { id: 'timeline', label: 'Timeline & activity' },
  { id: 'time', label: 'Time tracking' },
  { id: 'billing', label: 'Invoices & contracts' },
  { id: 'admin', label: 'Admin' },
] as const;

export type PermissionGroupId = (typeof PERMISSION_GROUPS)[number]['id'];

export const PERMISSIONS = [
  {
    key: 'projects.view',
    label: 'View projects',
    description: 'Open projects the user is a member of',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER', 'VIEWER'],
  },
  {
    key: 'projects.create',
    label: 'Create projects',
    description: 'Create new projects in a workspace',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER'],
  },
  {
    key: 'projects.manage',
    label: 'Manage project settings',
    description: 'Edit project details, archive, GitHub link',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER'],
  },
  {
    key: 'boards.create',
    label: 'Create boards',
    description: 'Add boards to a project',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER'],
  },
  {
    key: 'boards.manage',
    label: 'Manage boards',
    description: 'Rename, reorder, or delete boards and columns',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER'],
  },
  {
    key: 'tasks.create',
    label: 'Create tasks',
    description: 'Add tasks on boards and backlog',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'],
  },
  {
    key: 'tasks.edit',
    label: 'Edit tasks',
    description: 'Update task fields, comments, checklists',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'],
  },
  {
    key: 'tasks.delete',
    label: 'Delete tasks',
    description: 'Permanently remove tasks',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER'],
  },
  {
    key: 'sprints.create',
    label: 'Create sprints',
    description: 'Create a sprint in a project',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'],
  },
  {
    key: 'sprints.manage',
    label: 'Manage sprints',
    description: 'Start, complete, or delete sprints',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER'],
  },
  {
    key: 'sprints.assign',
    label: 'Assign sprint tasks',
    description: 'Move issues into or out of a sprint',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'],
  },
  {
    key: 'members.manage',
    label: 'Manage members',
    description: 'Add, remove, or change project member roles',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER'],
  },
  {
    key: 'reports.view',
    label: 'View reports',
    description: 'Open project reports and charts',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER'],
  },
  {
    key: 'pullRequests.view',
    label: 'View pull requests',
    description: 'See GitHub PRs linked to the project',
    group: 'pms',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER', 'VIEWER'],
  },
  {
    key: 'documents.view',
    label: 'View documents',
    description: 'Read project documents',
    group: 'documents',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER', 'VIEWER'],
  },
  {
    key: 'documents.create',
    label: 'Create documents',
    description: 'Add new project documents',
    group: 'documents',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'],
  },
  {
    key: 'documents.edit',
    label: 'Edit documents',
    description: 'Change document title and content',
    group: 'documents',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'],
  },
  {
    key: 'documents.delete',
    label: 'Delete documents',
    description: 'Remove project documents',
    group: 'documents',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'],
  },
  {
    key: 'timeline.view',
    label: 'View timeline',
    description: 'See project and task activity timeline',
    group: 'timeline',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER', 'VIEWER'],
  },
  {
    key: 'time.view',
    label: 'View time tracking',
    description: 'Open timesheets and logged hours',
    group: 'time',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'],
  },
  {
    key: 'time.track',
    label: 'Log time',
    description: 'Start timers and add time entries',
    group: 'time',
    defaultRoles: ['TEAM_MEMBER'],
  },
  {
    key: 'time.approve',
    label: 'Approve time deletion',
    description: 'Approve or reject time-entry deletion requests',
    group: 'time',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER'],
  },
  {
    key: 'invoices.view',
    label: 'View invoices',
    description: 'See invoices when the module is enabled',
    group: 'billing',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'VIEWER'],
  },
  {
    key: 'invoices.manage',
    label: 'Manage invoices',
    description: 'Create and delete invoices',
    group: 'billing',
    defaultRoles: [],
  },
  {
    key: 'invoices.pay',
    label: 'Mark invoices paid',
    description: 'Record payment details on an invoice',
    group: 'billing',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER', 'VIEWER'],
  },
  {
    key: 'contracts.manage',
    label: 'Manage contracts',
    description: 'Create and review freelancer contracts',
    group: 'billing',
    defaultRoles: ['WORKSPACE_OWNER', 'PROJECT_MANAGER'],
  },
  {
    key: 'workspaces.manage',
    label: 'Manage workspaces',
    description: 'Create workspaces and manage workspace members',
    group: 'admin',
    defaultRoles: ['WORKSPACE_OWNER'],
  },
  {
    key: 'users.manage',
    label: 'Manage users',
    description: 'Create, edit, or deactivate users',
    group: 'admin',
    defaultRoles: ['WORKSPACE_OWNER'],
  },
  {
    key: 'settings.manage',
    label: 'Manage integrations',
    description: 'Configure GitHub token and system settings',
    group: 'admin',
    defaultRoles: [],
  },
  {
    key: 'permissions.manage',
    label: 'Manage role permissions',
    description: 'Tick or untick what each role can do',
    group: 'admin',
    defaultRoles: [],
  },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export type PermissionMatrix = Record<string, Record<string, boolean>>;

export function buildDefaultMatrix(): PermissionMatrix {
  const matrix: PermissionMatrix = {};
  for (const role of USER_ROLES) {
    matrix[role] = {};
    for (const perm of PERMISSIONS) {
      matrix[role][perm.key] =
        role === 'SUPER_ADMIN' || (perm.defaultRoles as readonly string[]).includes(role);
    }
  }
  return matrix;
}

export function mergePermissionMatrix(overrides?: PermissionMatrix | null): PermissionMatrix {
  const merged = buildDefaultMatrix();
  if (!overrides || typeof overrides !== 'object') return merged;

  for (const role of USER_ROLES) {
    if (role === 'SUPER_ADMIN') continue;
    const row = overrides[role];
    if (!row || typeof row !== 'object') continue;
    for (const perm of PERMISSIONS) {
      if (typeof row[perm.key] === 'boolean') {
        merged[role][perm.key] = row[perm.key];
      }
    }
  }
  return merged;
}

export function roleHasPermissionInMatrix(
  matrix: PermissionMatrix,
  role: string | undefined,
  permission: string
): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;
  return !!matrix[role]?.[permission];
}

export function grantsForRole(matrix: PermissionMatrix, role: string | undefined): string[] {
  if (!role) return [];
  if (role === 'SUPER_ADMIN') return PERMISSIONS.map((p) => p.key);
  return PERMISSIONS.filter((p) => !!matrix[role]?.[p.key]).map((p) => p.key);
}

export const catalogPayload = {
  roles: USER_ROLES.map((role) => ({
    key: role,
    label: role.replace(/_/g, ' '),
    locked: role === 'SUPER_ADMIN',
  })),
  groups: PERMISSION_GROUPS,
  permissions: PERMISSIONS.map((p) => ({
    key: p.key,
    label: p.label,
    description: p.description,
    group: p.group,
  })),
};
