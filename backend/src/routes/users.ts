import express from 'express';
import { authenticate, AuthRequest, invalidateAuthUserCache } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

// Get all users (for assigning tasks, etc.)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
      },
      orderBy: { firstName: 'asc' },
    });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
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

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, role } = req.body;

    // Only SUPER_ADMIN can change roles
    const updateData: any = { firstName, lastName };
    if (req.user?.role === 'SUPER_ADMIN' && role) {
      updateData.role = role;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
      },
    });

    invalidateAuthUserCache(user.id);

    res.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    // Only SUPER_ADMIN can delete users
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    invalidateAuthUserCache(req.params.id);

    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;

