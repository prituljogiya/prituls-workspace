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

      const token = generateToken(user.id);

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
            error: 'Database connection failed. Please check MongoDB Atlas connection settings.',
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

      const token = generateToken(user.id);

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
          error: 'Database connection failed. Please check MongoDB Atlas connection settings.',
          message: 'Unable to connect to the database. Please verify your IP is whitelisted in MongoDB Atlas.',
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

// Forgot Password — returns reset link in response for local/dev (no SMTP required)
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

      // Same generic message whether or not the user exists
      const generic = { message: 'If that email exists, a reset link was generated.' };

      if (!user) {
        return res.json(generic);
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

      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
      const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

      // Try email if SMTP is configured; never fail the request on mail errors
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        try {
          await sendPasswordResetEmail(email, resetToken);
        } catch (mailErr) {
          console.warn('Password reset email failed (dev token still returned):', mailErr);
        }
      }

      console.log(`[forgot-password] Reset link for ${email}: ${resetUrl}`);

      res.json({
        ...generic,
        // Dev mode: expose token/link so you can reset without email
        resetToken,
        resetUrl,
        expiresIn: '1 hour',
      });
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

// Change password (authenticated)
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;

      if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'New password must be different from current password' });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
      });

      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'User not found' });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

// Logout (client-side token removal, but we can track it here if needed)
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;

