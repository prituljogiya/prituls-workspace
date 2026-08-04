import express from 'express';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

// Get team productivity chart
router.get('/productivity/:projectId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where: any = {
      projectId: req.params.projectId,
    };

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const tasks = await prisma.task.findMany({
      where,
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
        activities: {
          where: {
            action: 'status_changed',
            newValue: 'DONE',
          },
        },
      },
    });

    // Group by user
    const userProductivity: Record<string, any> = {};

    tasks.forEach((task) => {
      task.assignments.forEach((assignment) => {
        const userId = assignment.user.id;
        if (!userProductivity[userId]) {
          userProductivity[userId] = {
            user: assignment.user,
            totalTasks: 0,
            completedTasks: 0,
            storyPoints: 0,
            completedStoryPoints: 0,
          };
        }

        userProductivity[userId].totalTasks++;
        if (task.status === 'DONE') {
          userProductivity[userId].completedTasks++;
        }
        if (task.storyPoints) {
          userProductivity[userId].storyPoints += task.storyPoints;
          if (task.status === 'DONE') {
            userProductivity[userId].completedStoryPoints += task.storyPoints;
          }
        }
      });
    });

    const productivity = Object.values(userProductivity);

    res.json({ productivity });
  } catch (error) {
    console.error('Get productivity error:', error);
    res.status(500).json({ error: 'Failed to get productivity data' });
  }
});

// Get task status chart
router.get('/status/:projectId', authenticate, async (req: AuthRequest, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        projectId: req.params.projectId,
      },
    });

    const statusCounts = {
      TODO: tasks.filter((t) => t.status === 'TODO').length,
      IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      IN_REVIEW: tasks.filter((t) => t.status === 'IN_REVIEW').length,
      DONE: tasks.filter((t) => t.status === 'DONE').length,
      BLOCKED: tasks.filter((t) => t.status === 'BLOCKED').length,
    };

    const typeCounts = {
      TASK: tasks.filter((t) => t.issueType === 'TASK').length,
      BUG: tasks.filter((t) => t.issueType === 'BUG').length,
      STORY: tasks.filter((t) => t.issueType === 'STORY').length,
      EPIC: tasks.filter((t) => t.issueType === 'EPIC').length,
    };

    res.json({
      statusCounts,
      typeCounts,
      total: tasks.length,
    });
  } catch (error) {
    console.error('Get status chart error:', error);
    res.status(500).json({ error: 'Failed to get status data' });
  }
});

// Get sprint velocity
router.get('/velocity/:projectId', authenticate, async (req: AuthRequest, res) => {
  try {
    const sprints = await prisma.sprint.findMany({
      where: {
        projectId: req.params.projectId,
        status: { in: ['COMPLETED', 'ACTIVE'] },
      },
      include: {
        tasks: true,
      },
      orderBy: { endDate: 'desc' },
      take: 10,
    });

    const velocity = sprints.map((sprint) => {
      const totalPoints = sprint.tasks.reduce(
        (sum, task) => sum + (task.storyPoints || 0),
        0
      );
      const completedPoints = sprint.tasks
        .filter((task) => task.status === 'DONE')
        .reduce((sum, task) => sum + (task.storyPoints || 0), 0);

      return {
        sprintId: sprint.id,
        sprintName: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        totalStoryPoints: totalPoints,
        completedStoryPoints: completedPoints,
        totalTasks: sprint.tasks.length,
        completedTasks: sprint.tasks.filter((t) => t.status === 'DONE').length,
      };
    });

    const averageVelocity =
      velocity.length > 0
        ? velocity.reduce((sum, v) => sum + v.completedStoryPoints, 0) / velocity.length
        : 0;

    res.json({
      velocity,
      averageVelocity: Math.round(averageVelocity * 100) / 100,
    });
  } catch (error) {
    console.error('Get velocity error:', error);
    res.status(500).json({ error: 'Failed to get velocity data' });
  }
});

export default router;

