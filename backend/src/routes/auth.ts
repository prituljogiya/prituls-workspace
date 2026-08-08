import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { generateToken } from '../utils/jwt';
import { sendPasswordResetEmail } from '../utils/email';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      });

      const token = generateToken(user.id, { email: user.email, role: user.role });

      res.status(201).json({
        user,
        token,
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Login
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      let user;
      try {
        user = await prisma.user.findUnique({
          where: { email },
        });
      } catch (dbError: any) {
        console.error('Database connection error:', dbError);
        if (dbError.code === 'P2010' || dbError.message?.includes('Server selection timeout')) {
          return res.status(503).json({ 
            error: 'Database connection failed. Please check Neon Postgres connection settings.',
            details: 'See MONGODB_CONNECTION_FIX.md for troubleshooting steps'
          });
        }
        throw dbError;
      }

      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken(user.id, { email: user.email, role: user.role });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        token,
      });
    } catch (error: any) {
      console.error('Login error:', error);
      
      // If it's a database connection error that wasn't caught earlier
      if (error.code === 'P2010' || error.message?.includes('Server selection timeout') || error.message?.includes('fatal alert')) {
        return res.status(503).json({ 
          error: 'Database connection failed. Please check Neon Postgres connection settings.',
          message: 'Unable to connect to the database. Please verify your Neon DATABASE_URL and that the project is active.',
          details: 'See MONGODB_CONNECTION_FIX.md for troubleshooting steps'
        });
      }
      
      res.status(500).json({ 
        error: 'Login failed',
        message: error.message || 'An unexpected error occurred'
      });
    }
  }
);

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Forgot Password
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal if email exists
        return res.json({ message: 'If email exists, reset link sent' });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date();
      resetExpires.setHours(resetExpires.getHours() + 1);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetExpires,
        },
      });

      await sendPasswordResetEmail(email, resetToken);

      res.json({ message: 'If email exists, reset link sent' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  }
);

// Reset Password
router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, password } = req.body;

      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetExpires: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetExpires: null,
        },
      });

      res.json({ message: 'Password reset successful' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

// Logout (client-side token removal, but we can track it here if needed)
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;

