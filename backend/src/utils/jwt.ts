import jwt, { SignOptions } from 'jsonwebtoken';

export const generateToken = (userId: string): string => {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  };
  return jwt.sign({ userId }, process.env.JWT_SECRET as string, options);
};

export const verifyToken = (token: string): { userId: string } => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
};

