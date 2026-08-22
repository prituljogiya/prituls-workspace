'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from './AuthContext';
import {
  PermissionCatalog,
  PermissionKey,
  PermissionMatrix,
  roleHasPermission,
  setLivePermissionMatrix,
} from '@/utils/permissions';

type PermissionState = {
  catalog: PermissionCatalog | null;
  matrix: PermissionMatrix | null;
  globalRole: string | null;
  effectiveRole: string | null;
  grants: string[];
  loading: boolean;
  can: (permission: string) => boolean;
  refresh: (projectId?: string) => Promise<void>;
  saveMatrix: (matrix: PermissionMatrix) => Promise<void>;
};

const PermissionContext = createContext<PermissionState | undefined>(undefined);

function projectIdFromPath(pathname: string | null): string | undefined {
  const match = pathname?.match(/\/projects\/([^/]+)/);
  const id = match?.[1];
  if (!id || id === 'new') return undefined;
  return id;
}

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const projectId = projectIdFromPath(pathname);
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [globalRole, setGlobalRole] = useState<string | null>(null);
  const [effectiveRole, setEffectiveRole] = useState<string | null>(null);
  const [grants, setGrants] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    async (overrideProjectId?: string) => {
      if (!user) {
        setCatalog(null);
        setMatrix(null);
        setLivePermissionMatrix(null);
        setGlobalRole(null);
        setEffectiveRole(null);
        setGrants([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (projectId || overrideProjectId) {
          setEffectiveRole(null);
        }
        const pid = overrideProjectId ?? projectId;
        const { data } = await api.get('/permissions', {
          params: pid ? { projectId: pid } : undefined,
        });
        setCatalog(data.catalog || null);
        setMatrix(data.matrix || null);
        setLivePermissionMatrix(data.matrix || null);
        setGlobalRole(data.globalRole || user.role);
        setEffectiveRole(data.effectiveRole || user.role);
        setGrants(data.grants || []);
      } catch (error) {
        console.error('Failed to load permissions:', error);
        setGlobalRole(user.role);
        setEffectiveRole(user.role);
      } finally {
        setLoading(false);
      }
    },
    [user, projectId]
  );

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  const saveMatrix = useCallback(
    async (next: PermissionMatrix) => {
      const { data } = await api.put('/permissions', { matrix: next });
      setMatrix(data.matrix || next);
      setLivePermissionMatrix(data.matrix || next);
      await refresh();
    },
    [refresh]
  );

  const can = useCallback(
    (permission: string) => {
      if (user?.role === 'SUPER_ADMIN') return true;
      const role = effectiveRole || (!projectId ? user?.role : undefined);
      if (!role) return false;
      return roleHasPermission(role, permission as PermissionKey);
    },
    [effectiveRole, user?.role, projectId]
  );

  const value = useMemo(
    () => ({
      catalog,
      matrix,
      globalRole,
      effectiveRole: effectiveRole || user?.role || null,
      grants,
      loading,
      can,
      refresh,
      saveMatrix,
    }),
    [catalog, matrix, globalRole, effectiveRole, grants, loading, can, refresh, saveMatrix, user?.role]
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}
