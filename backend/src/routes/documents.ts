import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

const creatorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatar: true,
};

// List documents for a project
router.get('/project/:projectId', authenticate, async (req: AuthRequest, res) => {
  try {
    const documents = await prisma.projectDocument.findMany({
      where: { projectId: req.params.projectId },
      select: {
        id: true,
        title: true,
        projectId: true,
        createdById: true,
        updatedById: true,
        createdAt: true,
        updatedAt: true,
        creator: { select: creatorSelect },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ documents });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// Get single document
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const document = await prisma.projectDocument.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: creatorSelect },
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ document });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

// Create document
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'),
  [body('projectId').notEmpty(), body('title').trim().notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { projectId, title, content } = req.body;

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const document = await prisma.projectDocument.create({
        data: {
          projectId,
          title: title.trim(),
          content: typeof content === 'string' ? content : '',
          createdById: req.userId!,
          updatedById: req.userId!,
        },
        include: {
          creator: { select: creatorSelect },
        },
      });

      res.status(201).json({ document });
    } catch (error) {
      console.error('Create document error:', error);
      res.status(500).json({ error: 'Failed to create document' });
    }
  }
);

// Update document
router.put(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'),
  async (req: AuthRequest, res) => {
    try {
      const existing = await prisma.projectDocument.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const { title, content } = req.body;
      const data: { title?: string; content?: string; updatedById: string } = {
        updatedById: req.userId!,
      };
      if (typeof title === 'string' && title.trim()) data.title = title.trim();
      if (typeof content === 'string') data.content = content;

      const document = await prisma.projectDocument.update({
        where: { id: req.params.id },
        data,
        include: {
          creator: { select: creatorSelect },
        },
      });

      res.json({ document });
    } catch (error) {
      console.error('Update document error:', error);
      res.status(500).json({ error: 'Failed to update document' });
    }
  }
);

// Delete document
router.delete(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'),
  async (req: AuthRequest, res) => {
    try {
      const existing = await prisma.projectDocument.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Viewers already blocked; members can delete own, managers any
      const role = req.user?.role;
      const isManager = role === 'SUPER_ADMIN' || role === 'WORKSPACE_OWNER' || role === 'PROJECT_MANAGER';
      if (!isManager && existing.createdById !== req.userId) {
        return res.status(403).json({ error: 'You can only delete documents you created' });
      }

      await prisma.projectDocument.delete({ where: { id: req.params.id } });
      res.json({ message: 'Document deleted' });
    } catch (error) {
      console.error('Delete document error:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  }
);

export default router;
