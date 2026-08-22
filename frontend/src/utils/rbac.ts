import { roleHasPermission } from './permissions';

/** SUPER_ADMIN always has full access unless a specific permission is checked via the matrix */
export const hasRole = (userRole: string, allowedRoles: string[]): boolean => {
  if (userRole === 'SUPER_ADMIN') return true;
  return allowedRoles.includes(userRole);
};

export const canCreateProject = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'projects.create');
};

export const canUseTimeTracking = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'time.track') || roleHasPermission(userRole, 'time.view');
};

/** Alias — who can see logged hours and time estimates */
export const canViewHours = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'time.view') || roleHasPermission(userRole, 'time.track');
};

export const canManageProject = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'projects.manage');
};

export const canCreateBoard = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'boards.create');
};

export const canCreateTask = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'tasks.create');
};

export const canEditTask = (userRole: string, taskAssigneeIds?: string[], userId?: string): boolean => {
  if (roleHasPermission(userRole, 'projects.manage')) {
    return true;
  }
  if (roleHasPermission(userRole, 'tasks.edit') && userId && taskAssigneeIds?.includes(userId)) {
    return true;
  }
  if (roleHasPermission(userRole, 'tasks.edit') && userRole !== 'TEAM_MEMBER') {
    return true;
  }
  if (userRole === 'TEAM_MEMBER' && userId && taskAssigneeIds?.includes(userId)) {
    return roleHasPermission(userRole, 'tasks.edit');
  }
  return false;
};

export const canDeleteTask = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'tasks.delete');
};

export const canManageSprint = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'sprints.manage');
};

/** Create sprint — includes Team Member */
export const canCreateSprint = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'sprints.create');
};

/** Team can pull/remove issues during planning; managers control sprint lifecycle */
export const canAssignSprintTasks = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'sprints.assign');
};

export const canViewReports = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'reports.view');
};

export const canManageMembers = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'members.manage');
};

export const canViewOnly = (userRole: string): boolean => {
  return userRole === 'VIEWER';
};

export const canManageDocuments = (userRole: string): boolean => {
  return (
    roleHasPermission(userRole, 'documents.create') ||
    roleHasPermission(userRole, 'documents.edit') ||
    roleHasPermission(userRole, 'documents.delete')
  );
};

export const canCreateDocuments = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'documents.create');
};

export const canEditDocuments = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'documents.edit');
};

export const canDeleteDocuments = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'documents.delete');
};

export const canViewTimeline = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'timeline.view');
};

/** Managers who approve time deletion requests */
export const canApproveTimeDeletion = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'time.approve');
};

/** Team members must request deletion; managers may delete directly */
export const canHardDeleteTime = (userRole: string): boolean => {
  return canApproveTimeDeletion(userRole);
};

/** Invoices module — full manage (generate) */
export const canManageInvoices = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'invoices.manage');
};

/** Invoices module — view rates/hours/PDFs when project has invoices enabled */
export const canViewInvoices = (userRole: string): boolean => {
  return roleHasPermission(userRole, 'invoices.view');
};
