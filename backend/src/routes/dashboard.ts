import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

// Get dashboard data
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const memberFilter = {
      members: {
        some: {
          userId: req.userId!,
        },
      },
    };

    const upcomingDueDate = new Date();
    upcomingDueDate.setDate(upcomingDueDate.getDate() + 7);

    // Parallel queries — use aggregates for stats instead of loading every task
    const taskScope = isSuperAdmin
      ? { project: { isArchived: false } }
      : { project: { ...memberFilter, isArchived: false } };

    const [projects, statusGroups, typeGroups, projectStatusGroups, assignedTasks, tasksDueSoon] =
      await Promise.all([
        prisma.project.findMany({
          where: isSuperAdmin
            ? { isArchived: false }
            : { ...memberFilter, isArchived: false },
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            _count: {
              select: {
                tasks: true,
                boards: true,
              },
            },
            boards: {
              where: { isActive: true },
              select: { id: true, name: true, order: true },
              orderBy: { order: 'asc' },
              take: 8,
            },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.task.groupBy({
          by: ['status'],
          where: taskScope,
          _count: { _all: true },
        }),
        prisma.task.groupBy({
          by: ['issueType'],
          where: taskScope,
          _count: { _all: true },
        }),
        prisma.task.groupBy({
          by: ['projectId', 'status'],
          where: taskScope,
          _count: { _all: true },
        }),
        prisma.task.findMany({
          where: isSuperAdmin
            ? { isInBacklog: false }
            : {
                assignments: {
                  some: {
                    userId: req.userId!,
                  },
                },
                project: memberFilter,
                isInBacklog: false,
              },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            column: {
              select: {
                id: true,
                name: true,
              },
            },
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
            labels: true,
            _count: {
              select: {
                comments: true,
                checklist: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        }),
        prisma.task.findMany({
          where: {
            ...(isSuperAdmin
              ? {}
              : {
                  assignments: {
                    some: {
                      userId: req.userId!,
                    },
                  },
                }),
            dueDate: {
              lte: upcomingDueDate,
              gte: new Date(),
            },
            status: {
              not: 'DONE',
            },
          },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            column: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { dueDate: 'asc' },
          take: 10,
        }),
      ]);

    const countByStatus = Object.fromEntries(
      statusGroups.map((g) => [g.status, g._count._all])
    ) as Record<string, number>;
    const countByType = Object.fromEntries(
      typeGroups.map((g) => [g.issueType, g._count._all])
    ) as Record<string, number>;

    const totalTasks = statusGroups.reduce((sum, g) => sum + g._count._all, 0);
    const completedTasks = countByStatus.DONE || 0;
    const inProgressTasks = countByStatus.IN_PROGRESS || 0;
    const blockedTasks = countByStatus.BLOCKED || 0;
    const pendingTasks = totalTasks - completedTasks;

    const tasksByStatus = {
      TODO: countByStatus.TODO || 0,
      IN_PROGRESS: inProgressTasks,
      IN_REVIEW: countByStatus.IN_REVIEW || 0,
      DONE: completedTasks,
      BLOCKED: blockedTasks,
    };

    const tasksByType = {
      TASK: countByType.TASK || 0,
      BUG: countByType.BUG || 0,
      STORY: countByType.STORY || 0,
      EPIC: countByType.EPIC || 0,
    };

    const projectReports = projects.map((project) => {
      const rows = projectStatusGroups.filter((g) => g.projectId === project.id);
      const total = rows.reduce((sum, g) => sum + g._count._all, 0);
      return {
        projectId: project.id,
        name: project.name,
        totalTasks: total,
        completedTasks: rows.find((g) => g.status === 'DONE')?._count._all || 0,
        inProgressTasks: rows.find((g) => g.status === 'IN_PROGRESS')?._count._all || 0,
      };
    });

    res.setHeader('Cache-Control', 'private, no-store');
    res.json({
      projects,
      stats: {
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        blockedTasks,
        tasksByStatus,
        tasksByType,
      },
      charts: {
        byStatus: [
          { name: 'To Do', value: tasksByStatus.TODO },
          { name: 'In Progress', value: tasksByStatus.IN_PROGRESS },
          { name: 'In Review', value: tasksByStatus.IN_REVIEW },
          { name: 'Done', value: tasksByStatus.DONE },
          { name: 'Blocked', value: tasksByStatus.BLOCKED },
        ],
        byType: [
          { name: 'Task', value: tasksByType.TASK },
          { name: 'Bug', value: tasksByType.BUG },
          { name: 'Story', value: tasksByType.STORY },
          { name: 'Epic', value: tasksByType.EPIC },
        ],
        byProject: projectReports,
      },
      assignedTasks,
      tasksDueSoon,
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

export default router;
