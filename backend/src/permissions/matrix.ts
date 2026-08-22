import { prisma } from '../utils/prisma';
import {
  PermissionMatrix,
  grantsForRole,
  mergePermissionMatrix,
  roleHasPermissionInMatrix,
} from './catalog';

export const ROLE_PERMISSIONS_KEY = 'role_permissions';

type CachedMatrix = {
  matrix: PermissionMatrix;
  cachedAt: number;
};

const CACHE_TTL_MS = 15_000;
let cache: CachedMatrix | null = null;

export function invalidatePermissionCache() {
  cache = null;
}

export async function getPermissionMatrix(): Promise<PermissionMatrix> {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return cache.matrix;
  }

  let stored: PermissionMatrix | null = null;
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: ROLE_PERMISSIONS_KEY } });
    if (row?.value) {
      stored = JSON.parse(row.value) as PermissionMatrix;
    }
  } catch (error) {
    console.error('Failed to load role permissions, using defaults:', error);
  }

  const matrix = mergePermissionMatrix(stored);
  cache = { matrix, cachedAt: Date.now() };
  return matrix;
}

export async function savePermissionMatrix(overrides: PermissionMatrix) {
  const merged = mergePermissionMatrix(overrides);
  const toStore: PermissionMatrix = {};
  for (const [role, perms] of Object.entries(merged)) {
    if (role === 'SUPER_ADMIN') continue;
    toStore[role] = perms;
  }

  await prisma.appSetting.upsert({
    where: { key: ROLE_PERMISSIONS_KEY },
    create: { key: ROLE_PERMISSIONS_KEY, value: JSON.stringify(toStore) },
    update: { value: JSON.stringify(toStore) },
  });
  invalidatePermissionCache();
  return mergePermissionMatrix(toStore);
}

export async function roleHasPermission(role: string | undefined, permission: string) {
  const matrix = await getPermissionMatrix();
  return roleHasPermissionInMatrix(matrix, role, permission);
}

export async function getGrantsForRole(role: string | undefined) {
  const matrix = await getPermissionMatrix();
  return grantsForRole(matrix, role);
}

export async function getEffectiveRole(
  userId: string,
  globalRole: string | undefined,
  projectId?: string | null
): Promise<string> {
  if (globalRole === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (!projectId) return globalRole || 'VIEWER';

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });

  return member?.role || globalRole || 'VIEWER';
}
