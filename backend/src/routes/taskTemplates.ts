import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

// Get all templates (project, workspace, or global)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { projectId, workspaceId } = req.query;
    const userId = req.userId!;

    const where: any = {
      OR: [
        { isPublic: true }, // Public templates
        { createdById: userId }, // User's own templates
      ],
    };

    if (projectId) {
      where.OR.push({ projectId: projectId as string });
    } else if (workspaceId) {
      where.OR.push({ workspaceId: workspaceId as string });
    } else {
      // Global templates (no project or workspace)
      where.OR.push({ projectId: null, workspaceId: null });
    }

    const templates = await prisma.taskTemplate.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { usageCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

// Get template by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const template = await prisma.taskTemplate.findUnique({
      where: { id: req.params.id },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check access
    if (!template.isPublic && template.createdById !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ template });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

// Create template
router.post(
  '/',
  authenticate,
  [
    body('name').trim().notEmpty().withMessage('Template name is required'),
    body('issueType').optional().isIn(['TASK', 'BUG', 'STORY', 'EPIC']),
    body('priority').optional().isInt({ min: 0, max: 3 }),
    body('storyPoints').optional().isInt({ min: 0 }),
    body('timeEstimate').optional().isInt({ min: 0 }),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name,
        description,
        issueType,
        priority,
        storyPoints,
        timeEstimate,
        labels,
        checklist,
        projectId,
        workspaceId,
        isPublic,
      } = req.body;

      // Validate project/workspace access
      if (projectId) {
        const projectMember = await prisma.projectMember.findFirst({
          where: {
            projectId,
            userId: req.userId!,
            role: { in: ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'] },
          },
        });
        if (!projectMember) {
          return res.status(403).json({ error: 'Access denied to project' });
        }
      }

      if (workspaceId) {
        const workspaceMember = await prisma.workspaceMember.findFirst({
          where: {
            workspaceId,
            userId: req.userId!,
            role: { in: ['SUPER_ADMIN', 'WORKSPACE_OWNER'] },
          },
        });
        if (!workspaceMember) {
          return res.status(403).json({ error: 'Access denied to workspace' });
        }
      }

      const template = await prisma.taskTemplate.create({
        data: {
          name,
          description,
          issueType: issueType || 'TASK',
          priority: priority || 0,
          storyPoints,
          timeEstimate,
          labels: labels || [],
          checklist: checklist || [],
          projectId: projectId || null,
          workspaceId: workspaceId || null,
          createdById: req.userId!,
          isPublic: isPublic || false,
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      res.status(201).json({ template });
    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  }
);

// Update template
router.patch(
  '/:id',
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      const template = await prisma.taskTemplate.findUnique({
        where: { id: req.params.id },
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Only creator can update
      if (template.createdById !== req.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const {
        name,
        description,
        issueType,
        priority,
        storyPoints,
        timeEstimate,
        labels,
        checklist,
        isPublic,
      } = req.body;

      const updated = await prisma.taskTemplate.update({
        where: { id: req.params.id },
        data: {
          name,
          description,
          issueType,
          priority,
          storyPoints,
          timeEstimate,
          labels,
          checklist,
          isPublic,
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      res.json({ template: updated });
    } catch (error) {
      console.error('Update template error:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  }
);

// Delete template
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const template = await prisma.taskTemplate.findUnique({
      where: { id: req.params.id },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Only creator can delete
    if (template.createdById !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.taskTemplate.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Template deleted' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Create task from template
router.post(
  '/:id/create-task',
  authenticate,
  [
    body('projectId').notEmpty().withMessage('Project ID is required'),
    body('boardId').optional(),
    body('columnId').optional(),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const template = await prisma.taskTemplate.findUnique({
        where: { id: req.params.id },
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Check access
      if (!template.isPublic && template.createdById !== req.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Check project access
      const projectMember = await prisma.projectMember.findFirst({
        where: {
          projectId: req.body.projectId,
          userId: req.userId!,
        },
      });

      if (!projectMember) {
        return res.status(403).json({ error: 'Access denied to project' });
      }

      // Create task from template
      const task = await prisma.task.create({
        data: {
          title: template.name,
          description: template.description,
          issueType: template.issueType,
          priority: template.priority,
          storyPoints: template.storyPoints,
          timeEstimate: template.timeEstimate,
          projectId: req.body.projectId,
          boardId: req.body.boardId || null,
          columnId: req.body.columnId || null,
          createdById: req.userId!,
          isInBacklog: !req.body.boardId && !req.body.columnId,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Create labels if any
      if (template.labels && template.labels.length > 0) {
        await Promise.all(
          template.labels.map((labelName) =>
            prisma.taskLabel.create({
              data: {
                taskId: task.id,
                name: labelName,
                color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
              },
            })
          )
        );
      }

      // Create checklist items if any
      if (template.checklist && template.checklist.length > 0) {
        await Promise.all(
          template.checklist.map((itemText, index) =>
            prisma.checklistItem.create({
              data: {
                taskId: task.id,
                text: itemText,
                isChecked: false,
                order: index,
              },
            })
          )
        );
      }

      // Increment usage count
      await prisma.taskTemplate.update({
        where: { id: template.id },
        data: { usageCount: { increment: 1 } },
      });

      // Fetch full task with all relations
      const fullTask = await prisma.task.findUnique({
        where: { id: task.id },
        include: {
          assignments: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          labels: true,
          checklist: {
            orderBy: { order: 'asc' },
          },
        },
      });

      res.status(201).json({ task: fullTask });
    } catch (error) {
      console.error('Create task from template error:', error);
      res.status(500).json({ error: 'Failed to create task from template' });
    }
  }
);

export default router;


