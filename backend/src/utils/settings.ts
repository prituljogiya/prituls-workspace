import { prisma } from './prisma';

export const SETTING_KEYS = {
  GITHUB_TOKEN: 'github_token',
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value?.trim() || null;
}

export async function setSetting(key: string, value: string) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function deleteSetting(key: string) {
  try {
    await prisma.appSetting.delete({ where: { key } });
    return true;
  } catch {
    return false;
  }
}

/** Prefer admin-saved token; fall back to env. */
export async function getGithubToken(): Promise<{
  token: string | null;
  source: 'admin' | 'env' | null;
}> {
  const fromDb = await getSetting(SETTING_KEYS.GITHUB_TOKEN);
  if (fromDb) return { token: fromDb, source: 'admin' };
  const fromEnv = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || null;
  if (fromEnv) return { token: fromEnv, source: 'env' };
  return { token: null, source: null };
}

export function maskToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 8) return '••••••••';
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}
