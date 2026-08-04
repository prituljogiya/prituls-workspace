'use client';

import { useAuth } from '@/contexts/AuthContext';
import { hasRole } from '@/utils/rbac';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  fallback?: React.ReactNode;
}

export function RoleGuard({ children, allowedRoles, fallback = null }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user || !hasRole(user.role, allowedRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

