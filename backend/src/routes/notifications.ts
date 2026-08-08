import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

// List notifications for current user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const take = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.userId!, readAt: null },
    });
    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('List notifications error:', error);
    res.status(500).json({ error: 'Failed to list notifications' });
  }
});

router.get('/unread-count', authenticate, async (req: AuthRequest, res) => {
  try {
    const unreadCount = await prisma.notification.count({
      where: { userId: req.userId!, readAt: null },
    });
    res.json({ unreadCount });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

router.post('/:id/read', authenticate, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    const notification = await prisma.notification.update({
      where: { id: existing.id },
      data: { readAt: existing.readAt || new Date() },
    });
    res.json({ notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

router.post('/read-all', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId!, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

export default router;
