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

    // Get projects: SUPER_ADMIN sees all, others only memberships
    const projects = await prisma.project.findMany({
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
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Include all project tasks (board + backlog) for report charts
    const allTasks = await prisma.task.findMany({
      where: {
        project: isSuperAdmin ? { isArchived: false } : memberFilter,
      },
      select: {
        id: true,
        status: true,
        issueType: true,
        projectId: true,
        storyPoints: true,
      },
    });

    // Get assigned tasks (for SUPER_ADMIN show recent tasks across all projects)
    const assignedTasks = await prisma.task.findMany({
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
    });

    // Calculate stats
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.status === 'DONE').length;
    const pendingTasks = totalTasks - completedTasks;
    const inProgressTasks = allTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const blockedTasks = allTasks.filter((t) => t.status === 'BLOCKED').length;

    // Tasks by status
    const tasksByStatus = {
      TODO: allTasks.filter((t) => t.status === 'TODO').length,
      IN_PROGRESS: inProgressTasks,
      IN_REVIEW: allTasks.filter((t) => t.status === 'IN_REVIEW').length,
      DONE: completedTasks,
      BLOCKED: blockedTasks,
    };

    // Tasks by issue type
    const tasksByType = {
      TASK: allTasks.filter((t) => t.issueType === 'TASK').length,
      BUG: allTasks.filter((t) => t.issueType === 'BUG').length,
      STORY: allTasks.filter((t) => t.issueType === 'STORY').length,
      EPIC: allTasks.filter((t) => t.issueType === 'EPIC').length,
    };

    // Upcoming due dates (next 7 days)
    const upcomingDueDate = new Date();
    upcomingDueDate.setDate(upcomingDueDate.getDate() + 7);

    const tasksDueSoon = await prisma.task.findMany({
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
    });

    const projectReports = projects.map((project) => {
      const projectTasks = allTasks.filter((t) => t.projectId === project.id);
      return {
        projectId: project.id,
        name: project.name,
        totalTasks: projectTasks.length,
        completedTasks: projectTasks.filter((t) => t.status === 'DONE').length,
        inProgressTasks: projectTasks.filter((t) => t.status === 'IN_PROGRESS').length,
      };
    });

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

