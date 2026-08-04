import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, authorize, allowHoursAccess } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

// Auth required for all time-tracking routes; hours endpoints add allowHoursAccess
router.use(authenticate);

const MANAGER_ROLES = ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'] as const;

function isManagerRole(role?: string) {
  return !!role && (MANAGER_ROLES as readonly string[]).includes(role);
}

// Get time entries for a task
router.get('/task/:taskId', allowHoursAccess, async (req: AuthRequest, res) => {
  try {
    const entries = await prisma.timeEntry.findMany({
      where: { taskId: req.params.taskId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json({ entries });
  } catch (error) {
    console.error('Get time entries error:', error);
    res.status(500).json({ error: 'Failed to get time entries' });
  }
});

// Get time entries for a project
router.get('/project/:projectId', allowHoursAccess, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    const where: any = { projectId: req.params.projectId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    if (userId) where.userId = userId as string;

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            issueType: true,
            status: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Calculate totals
    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

    res.json({
      entries,
      summary: {
        totalHours,
        totalEntries: entries.length,
      },
    });
  } catch (error) {
    console.error('Get project time entries error:', error);
    res.status(500).json({ error: 'Failed to get time entries' });
  }
});

// Get user's time entries
router.get('/user/me', allowHoursAccess, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, projectId } = req.query;

    const where: any = { userId: req.userId! };

    if (projectId) where.projectId = projectId as string;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json({ entries });
  } catch (error) {
    console.error('Get user time entries error:', error);
    res.status(500).json({ error: 'Failed to get time entries' });
  }
});

// Create time entry (manual)
router.post(
  '/',
  allowHoursAccess,
  [
    body('taskId').notEmpty().withMessage('Task ID is required'),
    body('hours').isFloat({ min: 0 }).withMessage('Hours must be a positive number'),
    body('date').optional().isISO8601().withMessage('Invalid date format'),
    body('description').optional().isString(),
    body('isBillable').optional().isBoolean(),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { taskId, hours, date, description, isBillable = true } = req.body;

      // Get task to get projectId
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { projectId: true },
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const entry = await prisma.timeEntry.create({
        data: {
          taskId,
          userId: req.userId!,
          projectId: task.projectId,
          hours: parseFloat(hours),
          date: date ? new Date(date) : new Date(),
          description,
          isBillable,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      res.status(201).json({ entry });
    } catch (error) {
      console.error('Create time entry error:', error);
      res.status(500).json({ error: 'Failed to create time entry' });
    }
  }
);

// Start timer
router.post(
  '/timer/start',
  allowHoursAccess,
  [body('taskId').notEmpty().withMessage('Task ID is required')],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { taskId } = req.body;

      // Check if there's an active timer for this user
      const activeTimer = await prisma.timeEntry.findFirst({
        where: {
          userId: req.userId!,
          startTime: { not: null },
          endTime: null,
        },
      });

      if (activeTimer) {
        return res.status(400).json({
          error: 'You already have an active timer. Please stop it first.',
          activeTimer,
        });
      }

      // Get task to get projectId
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { projectId: true, status: true },
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.status === 'DONE') {
        return res.status(400).json({
          error: 'Cannot start a timer on a completed task. Add time manually instead.',
        });
      }

      const entry = await prisma.timeEntry.create({
        data: {
          taskId,
          userId: req.userId!,
          projectId: task.projectId,
          hours: 0,
          startTime: new Date(),
          isBillable: true,
        },
        include: {
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      res.status(201).json({ entry });
    } catch (error) {
      console.error('Start timer error:', error);
      res.status(500).json({ error: 'Failed to start timer' });
    }
  }
);

// Stop timer
router.post(
  '/timer/stop',
  allowHoursAccess,
  [body('entryId').notEmpty().withMessage('Entry ID is required')],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { entryId, description } = req.body;

      const entry = await prisma.timeEntry.findUnique({
        where: { id: entryId },
      });

      if (!entry) {
        return res.status(404).json({ error: 'Time entry not found' });
      }

      if (entry.userId !== req.userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (!entry.startTime || entry.endTime) {
        return res.status(400).json({ error: 'Timer is not active' });
      }

      const endTime = new Date();
      const hours = (endTime.getTime() - entry.startTime.getTime()) / (1000 * 60 * 60);

      const updated = await prisma.timeEntry.update({
        where: { id: entryId },
        data: {
          endTime,
          hours,
          description,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      res.json({ entry: updated });
    } catch (error) {
      console.error('Stop timer error:', error);
      res.status(500).json({ error: 'Failed to stop timer' });
    }
  }
);

// Get active timer for user
router.get('/timer/active', allowHoursAccess, async (req: AuthRequest, res) => {
  try {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        userId: req.userId!,
        startTime: { not: null },
        endTime: null,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    res.json({ entry });
  } catch (error) {
    console.error('Get active timer error:', error);
    res.status(500).json({ error: 'Failed to get active timer' });
  }
});

// Update time entry
router.patch(
  '/:id',
  allowHoursAccess,
  [
    body('hours').optional().isFloat({ min: 0 }),
    body('date').optional().isISO8601(),
    body('description').optional().isString(),
    body('isBillable').optional().isBoolean(),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const entry = await prisma.timeEntry.findUnique({
        where: { id: req.params.id },
      });

      if (!entry) {
        return res.status(404).json({ error: 'Time entry not found' });
      }

      // Only allow user to update their own entries, or admins/managers
      if (entry.userId !== req.userId) {
        // Check if user has permission (admin/manager)
        const user = await prisma.user.findUnique({
          where: { id: req.userId! },
          select: { role: true },
        });

        if (!user || !['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'].includes(user.role)) {
          return res.status(403).json({ error: 'Not authorized' });
        }
      }

      const updateData: any = {};
      if (req.body.hours !== undefined) updateData.hours = parseFloat(req.body.hours);
      if (req.body.date) updateData.date = new Date(req.body.date);
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.isBillable !== undefined) updateData.isBillable = req.body.isBillable;

      const updated = await prisma.timeEntry.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      res.json({ entry: updated });
    } catch (error) {
      console.error('Update time entry error:', error);
      res.status(500).json({ error: 'Failed to update time entry' });
    }
  }
);

// —— Time deletion requests (team member → managers) ——

router.get(
  '/deletion-requests/project/:projectId',
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const { status } = req.query;
      const requests = await prisma.timeDeletionRequest.findMany({
        where: {
          timeEntry: { projectId: req.params.projectId },
          ...(status ? { status: status as any } : { status: 'PENDING' }),
        },
        include: {
          requestedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          reviewedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          timeEntry: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
              task: { select: { id: true, title: true, status: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ requests });
    } catch (error) {
      console.error('List deletion requests error:', error);
      res.status(500).json({ error: 'Failed to list deletion requests' });
    }
  }
);

router.post(
  '/:id/request-delete',
  allowHoursAccess,
  [body('reason').optional().isString()],
  async (req: AuthRequest, res) => {
    try {
      const entry = await prisma.timeEntry.findUnique({
        where: { id: req.params.id },
      });
      if (!entry) {
        return res.status(404).json({ error: 'Time entry not found' });
      }

      if (entry.userId !== req.userId && req.user?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({
          error: 'You can only request deletion of your own time entries',
        });
      }

      const existing = await prisma.timeDeletionRequest.findFirst({
        where: { timeEntryId: entry.id, status: 'PENDING' },
      });
      if (existing) {
        return res.status(400).json({
          error: 'A deletion request is already pending for this entry',
          request: existing,
        });
      }

      const request = await prisma.timeDeletionRequest.create({
        data: {
          timeEntryId: entry.id,
          requestedById: req.userId!,
          reason: typeof req.body.reason === 'string' ? req.body.reason.trim() : null,
        },
        include: {
          timeEntry: {
            include: { task: { select: { id: true, title: true } } },
          },
        },
      });

      res.status(201).json({
        request,
        message: 'Deletion request sent to admin for approval',
      });
    } catch (error) {
      console.error('Request delete error:', error);
      res.status(500).json({ error: 'Failed to create deletion request' });
    }
  }
);

router.post(
  '/deletion-requests/:requestId/approve',
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const request = await prisma.timeDeletionRequest.findUnique({
        where: { id: req.params.requestId },
      });
      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }
      if (request.status !== 'PENDING') {
        return res.status(400).json({
          error: `Request is already ${request.status.toLowerCase()}`,
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.timeDeletionRequest.update({
          where: { id: request.id },
          data: {
            status: 'APPROVED',
            reviewedById: req.userId!,
            reviewNote: typeof req.body.note === 'string' ? req.body.note : null,
          },
        });
        try {
          await tx.timeEntry.delete({ where: { id: request.timeEntryId } });
        } catch {
          // Entry may already be gone
        }
      });

      res.json({ message: 'Deletion approved — time entry removed' });
    } catch (error) {
      console.error('Approve deletion error:', error);
      res.status(500).json({ error: 'Failed to approve deletion' });
    }
  }
);

router.post(
  '/deletion-requests/:requestId/reject',
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const request = await prisma.timeDeletionRequest.findUnique({
        where: { id: req.params.requestId },
      });
      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }
      if (request.status !== 'PENDING') {
        return res.status(400).json({
          error: `Request is already ${request.status.toLowerCase()}`,
        });
      }

      const updated = await prisma.timeDeletionRequest.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          reviewedById: req.userId!,
          reviewNote: typeof req.body.note === 'string' ? req.body.note : null,
        },
      });

      res.json({ request: updated, message: 'Deletion request rejected' });
    } catch (error) {
      console.error('Reject deletion error:', error);
      res.status(500).json({ error: 'Failed to reject deletion' });
    }
  }
);

// Hard delete — managers only (TEAM_MEMBER must request)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const entry = await prisma.timeEntry.findUnique({
      where: { id: req.params.id },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    if (!isManagerRole(req.user?.role)) {
      return res.status(403).json({
        error:
          'Team members cannot delete time entries directly. Submit a deletion request for admin approval.',
        code: 'REQUEST_DELETE_REQUIRED',
      });
    }

    await prisma.timeEntry.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Time entry deleted' });
  } catch (error) {
    console.error('Delete time entry error:', error);
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

// Get time tracking dashboard data
router.get('/dashboard', allowHoursAccess, async (req: AuthRequest, res) => {
  try {
    const { projectId, startDate, endDate } = req.query;

    const where: any = {};
    if (projectId) where.projectId = projectId as string;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Group by user
    const byUser: Record<string, any> = {};
    entries.forEach(entry => {
      const userId = entry.userId;
      if (!byUser[userId]) {
        byUser[userId] = {
          user: entry.user,
          totalHours: 0,
          billableHours: 0,
          entries: [],
        };
      }
      byUser[userId].totalHours += entry.hours;
      if (entry.isBillable) {
        byUser[userId].billableHours += entry.hours;
      }
      byUser[userId].entries.push(entry);
    });

    // Group by project
    const byProject: Record<string, any> = {};
    entries.forEach(entry => {
      const projectId = entry.task.project.id;
      if (!byProject[projectId]) {
        byProject[projectId] = {
          project: entry.task.project,
          totalHours: 0,
          billableHours: 0,
          entries: [],
        };
      }
      byProject[projectId].totalHours += entry.hours;
      if (entry.isBillable) {
        byProject[projectId].billableHours += entry.hours;
      }
      byProject[projectId].entries.push(entry);
    });

    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
    const billableHours = entries.filter(e => e.isBillable).reduce((sum, e) => sum + e.hours, 0);

    res.json({
      summary: {
        totalHours,
        billableHours,
        nonBillableHours: totalHours - billableHours,
        totalEntries: entries.length,
      },
      byUser: Object.values(byUser),
      byProject: Object.values(byProject),
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

export default router;

