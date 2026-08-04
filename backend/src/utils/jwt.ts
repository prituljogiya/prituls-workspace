import jwt, { SignOptions } from 'jsonwebtoken';

export type TokenPayload = {
  userId: string;
  email?: string;
  role?: string;
};

export const generateToken = (
  userId: string,
  claims?: { email: string; role: string }
): string => {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  };
  const payload: TokenPayload = {
    userId,
    ...(claims ? { email: claims.email, role: claims.role } : {}),
  };
  return jwt.sign(payload, process.env.JWT_SECRET as string, options);
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
};
