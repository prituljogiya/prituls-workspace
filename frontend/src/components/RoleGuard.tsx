'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { hasRole } from '@/utils/rbac';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  permission?: string;
  fallback?: React.ReactNode;
}

export function RoleGuard({
  children,
  allowedRoles,
  permission,
  fallback = null,
}: RoleGuardProps) {
  const { user } = useAuth();
  const { can, effectiveRole } = usePermissions();

  if (!user) {
    return <>{fallback}</>;
  }

  if (permission) {
    return can(permission) ? <>{children}</> : <>{fallback}</>;
  }

  if (allowedRoles && !hasRole(effectiveRole || user.role, allowedRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
