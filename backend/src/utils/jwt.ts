import jwt from 'jsonwebtoken';

export type JwtUserPayload = {
  userId: string;
  email?: string;
  role?: string;
};

export const generateToken = (
  userId: string,
  extras?: { email?: string; role?: string }
): string => {
  const payload: JwtUserPayload = {
    userId,
    ...(extras?.email ? { email: extras.email } : {}),
    ...(extras?.role ? { role: extras.role } : {}),
  };
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtUserPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as JwtUserPayload;
};
