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
  const { can, effectiveRole, loading } = usePermissions();

  if (!user) {
    return <>{fallback}</>;
  }

  if (permission) {
    if (loading && user.role !== 'SUPER_ADMIN') {
      return <>{fallback}</>;
    }
    return can(permission) ? <>{children}</> : <>{fallback}</>;
  }

  if (allowedRoles) {
    const role = user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : effectiveRole;
    if (!role) return <>{fallback}</>;
    if (!hasRole(role, allowedRoles)) return <>{fallback}</>;
  }

  return <>{children}</>;
}
