import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

// Get all projects for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const projects = await prisma.project.findMany({
      where: isSuperAdmin
        ? { isArchived: false }
        : {
            members: {
              some: {
                userId: req.userId!,
              },
            },
            isArchived: false,
          },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            tasks: true,
            boards: true,
            members: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ projects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

// Get project by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        workspace: true,
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
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
        boards: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            tasks: true,
            boards: true,
            sprints: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is member
    const isMember = project.members.some((m) => m.userId === req.userId!);

    if (!isMember && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// Create project
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  [body('name').trim().notEmpty(), body('workspaceId').notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, workspaceId, color } = req.body;

      const project = await prisma.project.create({
        data: {
          name,
          description,
          workspaceId,
          createdById: req.userId!,
          color,
          members: {
            create: {
              userId: req.userId!,
              role: 'PROJECT_MANAGER',
            },
          },
        },
        include: {
          workspace: true,
          creator: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
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

      res.status(201).json({ project });
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  }
);

// Update project
router.patch(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const { name, description, color } = req.body;

      const project = await prisma.project.update({
        where: { id: req.params.id },
        data: {
          name,
          description,
          color,
        },
        include: {
          workspace: true,
          creator: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      res.json({ project });
    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  }
);

// Archive/Delete project
router.patch(
  '/:id/archive',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const project = await prisma.project.update({
        where: { id: req.params.id },
        data: {
          isArchived: true,
        },
      });

      res.json({ project });
    } catch (error) {
      console.error('Archive project error:', error);
      res.status(500).json({ error: 'Failed to archive project' });
    }
  }
);

// Add member to project
router.post(
  '/:id/members',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  [body('userId').notEmpty(), body('role').notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, role } = req.body;

      const member = await prisma.projectMember.create({
        data: {
          projectId: req.params.id,
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

// Remove member from project
router.delete(
  '/:id/members/:memberId',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      await prisma.projectMember.delete({
        where: { id: req.params.memberId },
      });

      res.json({ message: 'Member removed' });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);

export default router;

