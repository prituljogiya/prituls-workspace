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
  user: { id: string; email: string; role: string; isActive: boolean };
  at: number;
};

// Short-lived cache so warm API invocations skip a DB round-trip per request
const userCache = new Map<string, CachedUser>();
const CACHE_TTL_MS = 60_000;

function getCached(userId: string): CachedUser['user'] | null {
  const hit = userCache.get(userId);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    userCache.delete(userId);
    return null;
  }
  return hit.user;
}

function setCached(user: CachedUser['user']) {
  userCache.set(user.id, { user, at: Date.now() });
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

    const cached = getCached(decoded.userId);
    if (cached) {
      if (!cached.isActive) {
        return res.status(401).json({ error: 'Invalid or inactive user' });
      }
      req.userId = cached.id;
      req.user = { id: cached.id, email: cached.email, role: cached.role };
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    setCached(user);
    req.userId = user.id;
    req.user = user;
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

    // SUPER_ADMIN has full access to all protected routes
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

/** Only Super Admin and Team Member may use timesheet / see hours */
export const allowHoursAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!['SUPER_ADMIN', 'TEAM_MEMBER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Hours are only available to Super Admin and Team Member' });
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
