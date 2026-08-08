import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

type CachedUser = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  cachedAt: number;
};

/** Avoid a Neon round-trip on every API request (remote DB is ~300–600ms from local). */
const USER_CACHE_TTL_MS = 60_000;
const userCache = new Map<string, CachedUser>();

async function getAuthUser(userId: string): Promise<CachedUser | null> {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < USER_CACHE_TTL_MS) {
    return cached;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!user) {
    userCache.delete(userId);
    return null;
  }

  const entry: CachedUser = { ...user, cachedAt: Date.now() };
  userCache.set(userId, entry);
  return entry;
}

/** Call after role/active changes so permissions update immediately. */
export function invalidateAuthUserCache(userId?: string) {
  if (userId) userCache.delete(userId);
  else userCache.clear();
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email?: string;
      role?: string;
    };

    const user = await getAuthUser(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    req.userId = user.id;
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (...rolesOrArray: (string | string[])[]) => {
  const roles = rolesOrArray.flat();
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

/** Super Admin, managers, and team members may use timesheet / see hours */
export const allowHoursAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (
    !['SUPER_ADMIN', 'TEAM_MEMBER', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'].includes(
      req.user.role
    )
  ) {
    return res.status(403).json({ error: 'Hours are not available for your role' });
  }
  next();
};

/** Block VIEWER from mutating / using timesheet features */
export const denyViewer = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role === 'VIEWER') {
    return res.status(403).json({ error: 'Viewers cannot access time tracking' });
  }
  next();
};
