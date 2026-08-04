import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

// Get all workspaces for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const workspaces = await prisma.workspace.findMany({
      where: isSuperAdmin
        ? { isActive: true }
        : {
            members: {
              some: {
                userId: req.userId!,
              },
            },
            isActive: true,
          },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    res.json({ workspaces });
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Failed to get workspaces' });
  }
});

// Create workspace
router.post(
  '/',
  authenticate,
  [body('name').trim().notEmpty(), body('slug').trim().notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, slug } = req.body;

      const existingWorkspace = await prisma.workspace.findUnique({
        where: { slug },
      });

      if (existingWorkspace) {
        return res.status(400).json({ error: 'Slug already exists' });
      }

      const workspace = await prisma.workspace.create({
        data: {
          name,
          description,
          slug,
          members: {
            create: {
              userId: req.userId!,
              role: 'WORKSPACE_OWNER',
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });

      res.status(201).json({ workspace });
    } catch (error) {
      console.error('Create workspace error:', error);
      res.status(500).json({ error: 'Failed to create workspace' });
    }
  }
);

// Get workspace by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
                role: true,
              },
            },
          },
        },
        projects: {
          include: {
            _count: {
              select: {
                tasks: true,
                boards: true,
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is member
    const isMember = workspace.members.some(
      (m) => m.userId === req.userId!
    );

    if (!isMember && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ workspace });
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Failed to get workspace' });
  }
});

// Update workspace
router.patch(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER'),
  async (req: AuthRequest, res) => {
    try {
      const { name, description } = req.body;

      const workspace = await prisma.workspace.update({
        where: { id: req.params.id },
        data: {
          name,
          description,
        },
      });

      res.json({ workspace });
    } catch (error) {
      console.error('Update workspace error:', error);
      res.status(500).json({ error: 'Failed to update workspace' });
    }
  }
);

// Add member to workspace
router.post(
  '/:id/members',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER'),
  [body('userId').notEmpty(), body('role').notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, role } = req.body;

      const member = await prisma.workspaceMember.create({
        data: {
          workspaceId: req.params.id,
          userId,
          role,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      });

      res.status(201).json({ member });
    } catch (error) {
      console.error('Add member error:', error);
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
);

// Remove member from workspace
router.delete(
  '/:id/members/:memberId',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER'),
  async (req: AuthRequest, res) => {
    try {
      await prisma.workspaceMember.delete({
        where: { id: req.params.memberId },
      });

      res.json({ message: 'Member removed' });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);

// Update workspace member role
router.patch(
  '/:id/members/:memberId',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER'),
  [body('role').notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { role } = req.body;

      const member = await prisma.workspaceMember.update({
        where: { id: req.params.memberId },
        data: { role },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      });

      res.json({ member });
    } catch (error) {
      console.error('Update member error:', error);
      res.status(500).json({ error: 'Failed to update member' });
    }
  }
);

export default router;

