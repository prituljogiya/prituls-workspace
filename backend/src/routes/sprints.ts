import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

// Get sprints for project
router.get('/project/:projectId', authenticate, async (req: AuthRequest, res) => {
  try {
    const sprints = await prisma.sprint.findMany({
      where: {
        projectId: req.params.projectId,
      },
      include: {
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ sprints });
  } catch (error) {
    console.error('Get sprints error:', error);
    res.status(500).json({ error: 'Failed to get sprints' });
  }
});

// Get sprint by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const sprint = await prisma.sprint.findUnique({
      where: { id: req.params.id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
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
        tasks: {
          include: {
            assignments: {
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
            column: {
              select: {
                id: true,
                name: true,
              },
            },
            labels: true,
            _count: {
              select: {
                checklist: true,
                comments: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!sprint) {
      return res.status(404).json({ error: 'Sprint not found' });
    }

    res.json({ sprint });
  } catch (error) {
    console.error('Get sprint error:', error);
    res.status(500).json({ error: 'Failed to get sprint' });
  }
});

// Create sprint
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  [body('name').trim().notEmpty(), body('projectId').notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, projectId, startDate, endDate, goal } = req.body;

      const sprint = await prisma.sprint.create({
        data: {
          name,
          projectId,
          createdById: req.userId!,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          goal,
          status: 'PLANNED',
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
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
        },
      });

      res.status(201).json({ sprint });
    } catch (error) {
      console.error('Create sprint error:', error);
      res.status(500).json({ error: 'Failed to create sprint' });
    }
  }
);

// Update sprint
router.patch(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const { name, startDate, endDate, goal, status } = req.body;

      const sprint = await prisma.sprint.update({
        where: { id: req.params.id },
        data: {
          name,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          goal,
          status,
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

      res.json({ sprint });
    } catch (error) {
      console.error('Update sprint error:', error);
      res.status(500).json({ error: 'Failed to update sprint' });
    }
  }
);

// Start sprint
router.patch(
  '/:id/start',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const sprint = await prisma.sprint.update({
        where: { id: req.params.id },
        data: {
          status: 'ACTIVE',
          startDate: new Date(),
        },
        include: {
          tasks: true,
        },
      });

      res.json({ sprint });
    } catch (error) {
      console.error('Start sprint error:', error);
      res.status(500).json({ error: 'Failed to start sprint' });
    }
  }
);

// End sprint
router.patch(
  '/:id/end',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const sprint = await prisma.sprint.update({
        where: { id: req.params.id },
        data: {
          status: 'COMPLETED',
          endDate: new Date(),
        },
        include: {
          tasks: true,
        },
      });

      res.json({ sprint });
    } catch (error) {
      console.error('End sprint error:', error);
      res.status(500).json({ error: 'Failed to end sprint' });
    }
  }
);

// Move task to sprint
router.patch(
  '/:id/tasks/:taskId',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const task = await prisma.task.update({
        where: { id: req.params.taskId },
        data: {
          sprintId: req.params.id,
          isInBacklog: false,
        },
        include: {
          assignments: {
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

      // Create activity log
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          userId: req.userId!,
          action: 'added_to_sprint',
          newValue: req.params.id,
        },
      });

      res.json({ task });
    } catch (error) {
      console.error('Move task to sprint error:', error);
      res.status(500).json({ error: 'Failed to move task to sprint' });
    }
  }
);

// Remove task from sprint
router.delete(
  '/:id/tasks/:taskId',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const task = await prisma.task.update({
        where: { id: req.params.taskId },
        data: {
          sprintId: null,
          isInBacklog: true,
        },
      });

      // Create activity log
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          userId: req.userId!,
          action: 'removed_from_sprint',
          oldValue: req.params.id,
        },
      });

      res.json({ task });
    } catch (error) {
      console.error('Remove task from sprint error:', error);
      res.status(500).json({ error: 'Failed to remove task from sprint' });
    }
  }
);

// Get burndown chart data
router.get('/:id/burndown', authenticate, async (req: AuthRequest, res) => {
  try {
    const sprint = await prisma.sprint.findUnique({
      where: { id: req.params.id },
      include: {
        tasks: {
          include: {
            activities: {
              where: {
                action: 'status_changed',
                newValue: 'DONE',
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!sprint || !sprint.startDate || !sprint.endDate) {
      return res.status(400).json({ error: 'Sprint dates not set' });
    }

    const totalStoryPoints = sprint.tasks.reduce(
      (sum, task) => sum + (task.storyPoints || 0),
      0
    );

    const days = [];
    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const today = new Date();
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Ensure we have at least one day
    if (totalDays <= 0) {
      // If start and end are the same day, create one data point
      const completedPoints = sprint.tasks
        .filter((task) => task.status === 'DONE')
        .reduce((sum, task) => sum + (task.storyPoints || 0), 0);
      
      days.push({
        date: startDate.toISOString().split('T')[0],
        completed: completedPoints,
        remaining: Math.max(0, totalStoryPoints - completedPoints),
        ideal: totalStoryPoints,
      });
    } else {
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const completedPoints = sprint.tasks
          .filter((task) => {
            const doneActivity = task.activities.find(
              (a) => new Date(a.createdAt) <= d
            );
            return doneActivity || (task.status === 'DONE' && new Date(task.updatedAt) <= d);
          })
          .reduce((sum, task) => sum + (task.storyPoints || 0), 0);

        const remainingPoints = totalStoryPoints - completedPoints;
        const daysElapsed = Math.ceil((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const idealRemaining = Math.max(0, totalStoryPoints * (1 - daysElapsed / totalDays));

        days.push({
          date: d.toISOString().split('T')[0],
          completed: completedPoints,
          remaining: Math.max(0, remainingPoints),
          ideal: idealRemaining,
        });
      }
    }

    res.json({
      sprint: {
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: sprint.status,
      },
      totalStoryPoints,
      burndown: days,
    });
  } catch (error) {
    console.error('Get burndown error:', error);
    res.status(500).json({ error: 'Failed to get burndown data' });
  }
});

export default router;

