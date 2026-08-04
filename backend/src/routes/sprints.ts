import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

async function placeTasksOnProjectBoard(projectId: string, taskIds: string[]) {
  if (taskIds.length === 0) return { placed: 0, boardId: null as string | null };

  const board = await prisma.board.findFirst({
    where: { projectId, isActive: true },
    include: {
      columns: { orderBy: { order: 'asc' } },
    },
    orderBy: { order: 'asc' },
  });

  if (!board || board.columns.length === 0) {
    return { placed: 0, boardId: null as string | null };
  }

  const todoColumn =
    board.columns.find((c) => /^(to\s*do|todo)$/i.test(c.name.trim())) || board.columns[0];

  const result = await prisma.task.updateMany({
    where: {
      id: { in: taskIds },
      OR: [{ boardId: null }, { columnId: null }],
    },
    data: {
      boardId: board.id,
      columnId: todoColumn.id,
      isInBacklog: false,
    },
  });

  return { placed: result.count, boardId: board.id };
}

function sprintStats(tasks: { status: string; storyPoints: number | null }[]) {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
  const storyPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const donePoints = tasks
    .filter((t) => t.status === 'DONE')
    .reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  return { totalTasks, doneTasks, incompleteTasks: totalTasks - doneTasks, storyPoints, donePoints };
}

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
        tasks: {
          select: {
            id: true,
            status: true,
            storyPoints: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }, { createdAt: 'desc' }],
    });

    const ordered = [...sprints].sort((a, b) => {
      const rank: Record<string, number> = { ACTIVE: 0, PLANNED: 1, COMPLETED: 2, CANCELLED: 3 };
      return (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    });

    res.json({
      sprints: ordered.map(({ tasks, ...sprint }) => ({
        ...sprint,
        stats: sprintStats(tasks),
      })),
    });
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
            board: {
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

    const nextSprints = await prisma.sprint.findMany({
      where: {
        projectId: sprint.projectId,
        status: 'PLANNED',
        id: { not: sprint.id },
      },
      select: { id: true, name: true, startDate: true, endDate: true },
      orderBy: { startDate: 'asc' },
    });

    res.json({
      sprint: {
        ...sprint,
        stats: sprintStats(sprint.tasks),
      },
      nextSprints,
    });
  } catch (error) {
    console.error('Get sprint error:', error);
    res.status(500).json({ error: 'Failed to get sprint' });
  }
});

// Create sprint
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'),
  [body('name').trim().notEmpty(), body('projectId').notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, projectId, startDate, endDate, goal } = req.body;

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({ error: 'End date must be on or after start date' });
      }

      const sprint = await prisma.sprint.create({
        data: {
          name,
          projectId,
          createdById: req.userId!,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          goal: goal || null,
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

// Update sprint (planning fields only — status via start/complete/cancel)
router.patch(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const existing = await prisma.sprint.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        return res.status(404).json({ error: 'Sprint not found' });
      }

      if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
        return res.status(400).json({ error: 'Cannot edit a completed or cancelled sprint' });
      }

      const { name, startDate, endDate, goal } = req.body;
      const nextStart = startDate !== undefined ? (startDate ? new Date(startDate) : null) : existing.startDate;
      const nextEnd = endDate !== undefined ? (endDate ? new Date(endDate) : null) : existing.endDate;

      if (nextStart && nextEnd && nextEnd < nextStart) {
        return res.status(400).json({ error: 'End date must be on or after start date' });
      }

      const sprint = await prisma.sprint.update({
        where: { id: req.params.id },
        data: {
          name: name !== undefined ? name : undefined,
          startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
          endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
          goal: goal !== undefined ? goal : undefined,
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

// Start sprint: PLANNED → ACTIVE, one active per project, place tasks on board
router.patch(
  '/:id/start',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const existing = await prisma.sprint.findUnique({
        where: { id: req.params.id },
        include: { tasks: { select: { id: true } } },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Sprint not found' });
      }

      if (existing.status !== 'PLANNED') {
        return res.status(400).json({ error: 'Only planned sprints can be started' });
      }

      if (!existing.startDate || !existing.endDate) {
        return res.status(400).json({ error: 'Set start and end dates before starting the sprint' });
      }

      const activeOther = await prisma.sprint.findFirst({
        where: {
          projectId: existing.projectId,
          status: 'ACTIVE',
          id: { not: existing.id },
        },
      });

      if (activeOther) {
        return res.status(400).json({
          error: `Another sprint is already active ("${activeOther.name}"). Complete it before starting a new one.`,
          activeSprintId: activeOther.id,
        });
      }

      const placeOnBoard = req.body?.placeOnBoard !== false;

      const sprint = await prisma.sprint.update({
        where: { id: req.params.id },
        data: {
          status: 'ACTIVE',
          // Preserve planned dates; fill startDate only if somehow missing
          startDate: existing.startDate || new Date(),
        },
        include: {
          tasks: true,
        },
      });

      let boardResult = { placed: 0, boardId: null as string | null };
      if (placeOnBoard) {
        boardResult = await placeTasksOnProjectBoard(
          existing.projectId,
          existing.tasks.map((t) => t.id)
        );
      }

      res.json({
        sprint,
        board: boardResult,
      });
    } catch (error) {
      console.error('Start sprint error:', error);
      res.status(500).json({ error: 'Failed to start sprint' });
    }
  }
);

// Complete sprint: ACTIVE → COMPLETED + incomplete work handling
router.patch(
  '/:id/complete',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const existing = await prisma.sprint.findUnique({
        where: { id: req.params.id },
        include: {
          tasks: {
            select: { id: true, status: true, title: true },
          },
        },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Sprint not found' });
      }

      if (existing.status !== 'ACTIVE') {
        return res.status(400).json({ error: 'Only active sprints can be completed' });
      }

      const incompleteAction = (req.body?.incompleteAction as string) || 'backlog';
      const nextSprintId = req.body?.nextSprintId as string | undefined;
      const incomplete = existing.tasks.filter((t) => t.status !== 'DONE');
      const incompleteIds = incomplete.map((t) => t.id);

      if (incompleteIds.length > 0) {
        if (incompleteAction === 'next_sprint') {
          if (!nextSprintId) {
            return res.status(400).json({ error: 'Select a planned sprint for incomplete tasks' });
          }
          const nextSprint = await prisma.sprint.findUnique({ where: { id: nextSprintId } });
          if (!nextSprint || nextSprint.projectId !== existing.projectId) {
            return res.status(400).json({ error: 'Invalid next sprint' });
          }
          if (nextSprint.status !== 'PLANNED') {
            return res.status(400).json({ error: 'Incomplete tasks can only move to a planned sprint' });
          }

          await prisma.task.updateMany({
            where: { id: { in: incompleteIds } },
            data: {
              sprintId: nextSprintId,
              isInBacklog: false,
            },
          });

          for (const taskId of incompleteIds) {
            await prisma.taskActivity.create({
              data: {
                taskId,
                userId: req.userId!,
                action: 'moved_to_next_sprint',
                oldValue: existing.id,
                newValue: nextSprintId,
              },
            });
          }
        } else if (incompleteAction === 'backlog') {
          await prisma.task.updateMany({
            where: { id: { in: incompleteIds } },
            data: {
              sprintId: null,
              isInBacklog: true,
              boardId: null,
              columnId: null,
            },
          });

          for (const taskId of incompleteIds) {
            await prisma.taskActivity.create({
              data: {
                taskId,
                userId: req.userId!,
                action: 'returned_to_backlog',
                oldValue: existing.id,
              },
            });
          }
        }
        // 'keep' leaves incomplete tasks on the completed sprint
      }

      const sprint = await prisma.sprint.update({
        where: { id: req.params.id },
        data: {
          status: 'COMPLETED',
          // Preserve planned end date
          endDate: existing.endDate || new Date(),
        },
        include: {
          tasks: true,
        },
      });

      res.json({
        sprint,
        completed: {
          doneTasks: existing.tasks.filter((t) => t.status === 'DONE').length,
          incompleteMoved: incompleteAction === 'keep' ? 0 : incompleteIds.length,
          incompleteAction,
          nextSprintId: incompleteAction === 'next_sprint' ? nextSprintId : null,
        },
      });
    } catch (error) {
      console.error('Complete sprint error:', error);
      res.status(500).json({ error: 'Failed to complete sprint' });
    }
  }
);

// Backward-compatible end → complete with backlog move
router.patch(
  '/:id/end',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    req.body = { ...(req.body || {}), incompleteAction: req.body?.incompleteAction || 'backlog' };
    // Reuse complete handler by forwarding — call same logic inline
    try {
      const existing = await prisma.sprint.findUnique({
        where: { id: req.params.id },
        include: { tasks: { select: { id: true, status: true, title: true } } },
      });
      if (!existing) return res.status(404).json({ error: 'Sprint not found' });
      if (existing.status !== 'ACTIVE') {
        return res.status(400).json({ error: 'Only active sprints can be completed' });
      }

      const incompleteAction = (req.body?.incompleteAction as string) || 'backlog';
      const incompleteIds = existing.tasks.filter((t) => t.status !== 'DONE').map((t) => t.id);

      if (incompleteIds.length > 0 && incompleteAction === 'backlog') {
        await prisma.task.updateMany({
          where: { id: { in: incompleteIds } },
          data: { sprintId: null, isInBacklog: true, boardId: null, columnId: null },
        });
      }

      const sprint = await prisma.sprint.update({
        where: { id: req.params.id },
        data: { status: 'COMPLETED', endDate: existing.endDate || new Date() },
        include: { tasks: true },
      });

      res.json({ sprint });
    } catch (error) {
      console.error('End sprint error:', error);
      res.status(500).json({ error: 'Failed to end sprint' });
    }
  }
);

// Cancel planned sprint
router.patch(
  '/:id/cancel',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const existing = await prisma.sprint.findUnique({
        where: { id: req.params.id },
        include: { tasks: { select: { id: true } } },
      });
      if (!existing) return res.status(404).json({ error: 'Sprint not found' });
      if (existing.status !== 'PLANNED') {
        return res.status(400).json({ error: 'Only planned sprints can be cancelled' });
      }

      const taskIds = existing.tasks.map((t) => t.id);
      if (taskIds.length > 0) {
        await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { sprintId: null, isInBacklog: true },
        });
      }

      const sprint = await prisma.sprint.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED' },
      });

      res.json({ sprint });
    } catch (error) {
      console.error('Cancel sprint error:', error);
      res.status(500).json({ error: 'Failed to cancel sprint' });
    }
  }
);

// Delete sprint (planned/cancelled only)
router.delete(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const existing = await prisma.sprint.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { tasks: true } } },
      });
      if (!existing) return res.status(404).json({ error: 'Sprint not found' });
      if (!['PLANNED', 'CANCELLED'].includes(existing.status)) {
        return res.status(400).json({ error: 'Only planned or cancelled sprints can be deleted' });
      }

      if (existing._count.tasks > 0) {
        await prisma.task.updateMany({
          where: { sprintId: existing.id },
          data: { sprintId: null, isInBacklog: true },
        });
      }

      await prisma.sprint.delete({ where: { id: existing.id } });
      res.json({ success: true });
    } catch (error) {
      console.error('Delete sprint error:', error);
      res.status(500).json({ error: 'Failed to delete sprint' });
    }
  }
);

// Move task to sprint
router.patch(
  '/:id/tasks/:taskId',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'),
  async (req: AuthRequest, res) => {
    try {
      const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id } });
      if (!sprint) return res.status(404).json({ error: 'Sprint not found' });
      if (sprint.status === 'COMPLETED' || sprint.status === 'CANCELLED') {
        return res.status(400).json({ error: 'Cannot add tasks to a completed or cancelled sprint' });
      }

      const existingTask = await prisma.task.findUnique({ where: { id: req.params.taskId } });
      if (!existingTask) return res.status(404).json({ error: 'Task not found' });
      if (existingTask.projectId !== sprint.projectId) {
        return res.status(400).json({ error: 'Task belongs to a different project' });
      }

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

      // If sprint is already active, ensure the task lands on the board
      if (sprint.status === 'ACTIVE') {
        await placeTasksOnProjectBoard(sprint.projectId, [task.id]);
      }

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

// Remove task from sprint → backlog
router.delete(
  '/:id/tasks/:taskId',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER', 'TEAM_MEMBER'),
  async (req: AuthRequest, res) => {
    try {
      const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id } });
      if (!sprint) return res.status(404).json({ error: 'Sprint not found' });
      if (sprint.status === 'COMPLETED' || sprint.status === 'CANCELLED') {
        return res.status(400).json({ error: 'Cannot change tasks on a completed or cancelled sprint' });
      }

      const existingTask = await prisma.task.findUnique({ where: { id: req.params.taskId } });
      if (!existingTask || existingTask.sprintId !== sprint.id) {
        return res.status(400).json({ error: 'Task is not in this sprint' });
      }

      const task = await prisma.task.update({
        where: { id: req.params.taskId },
        data: {
          sprintId: null,
          isInBacklog: true,
          boardId: null,
          columnId: null,
        },
      });

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
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (totalDays <= 0) {
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
            const doneActivity = task.activities.find((a) => new Date(a.createdAt) <= d);
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
