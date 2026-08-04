// RBAC utility functions

/** SUPER_ADMIN always has full access */
export const hasRole = (userRole: string, allowedRoles: string[]): boolean => {
  if (userRole === 'SUPER_ADMIN') return true;
  return allowedRoles.includes(userRole);
};

export const canCreateProject = (userRole: string): boolean => {
  return hasRole(userRole, ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']);
};

export const canUseTimeTracking = (userRole: string): boolean => {
  // Hours / timers visible only to Super Admin and Team Member
  return hasRole(userRole, ['SUPER_ADMIN', 'TEAM_MEMBER']);
};

/** Alias — who can see logged hours and time estimates */
export const canViewHours = (userRole: string): boolean => {
  return canUseTimeTracking(userRole);
};

export const canManageProject = (userRole: string): boolean => {
  return hasRole(userRole, ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']);
};

export const canCreateBoard = (userRole: string): boolean => {
  return hasRole(userRole, ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']);
};

export const canCreateTask = (userRole: string): boolean => {
  return hasRole(userRole, ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER']);
};

export const canEditTask = (userRole: string, taskAssigneeIds?: string[], userId?: string): boolean => {
  if (hasRole(userRole, ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'])) {
    return true;
  }
  if (userRole === 'TEAM_MEMBER' && userId && taskAssigneeIds?.includes(userId)) {
    return true;
  }
  return false;
};

export const canDeleteTask = (userRole: string): boolean => {
  return hasRole(userRole, ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']);
};

export const canManageSprint = (userRole: string): boolean => {
  return hasRole(userRole, ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']);
};

/** Create sprint — includes Team Member */
export const canCreateSprint = (userRole: string): boolean => {
  return hasRole(userRole, [
    'SUPER_ADMIN',
    'WORKSPACE_OWNER',
    'PROJECT_MANAGER',
    'TEAM_MEMBER',
  ]);
};

/** Team can pull/remove issues during planning; managers control sprint lifecycle */
export const canAssignSprintTasks = (userRole: string): boolean => {
  return hasRole(userRole, [
    'SUPER_ADMIN',
    'WORKSPACE_OWNER',
    'PROJECT_MANAGER',
    'TEAM_MEMBER',
  ]);
};

export const canViewReports = (userRole: string): boolean => {
  return hasRole(userRole, ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']);
};

export const canManageMembers = (userRole: string): boolean => {
  return hasRole(userRole, ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']);
};

export const canViewOnly = (userRole: string): boolean => {
  return userRole === 'VIEWER';
};

export const canManageDocuments = (userRole: string): boolean => {
  return hasRole(userRole, [
    'SUPER_ADMIN',
    'WORKSPACE_OWNER',
    'PROJECT_MANAGER',
    'TEAM_MEMBER',
  ]);
};

/** Managers who approve time deletion requests */
export const canApproveTimeDeletion = (userRole: string): boolean => {
  return hasRole(userRole, ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']);
};

/** Team members must request deletion; managers may delete directly */
export const canHardDeleteTime = (userRole: string): boolean => {
  return canApproveTimeDeletion(userRole);
};
