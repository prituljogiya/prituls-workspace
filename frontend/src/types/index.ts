export type UserRole = 
  | 'SUPER_ADMIN'
  | 'WORKSPACE_OWNER'
  | 'PROJECT_MANAGER'
  | 'TEAM_MEMBER'
  | 'VIEWER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
}

