import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

// Global search across tasks, projects, and comments
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { q, type, projectId } = req.query;
    const searchQuery = (q as string)?.trim();

    if (!searchQuery || searchQuery.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const userId = req.userId!;
    const results: any = {
      tasks: [],
      projects: [],
      comments: [],
    };

    // Build search conditions
    const searchRegex = { $regex: searchQuery, $options: 'i' };

    // Search Tasks
    if (!type || type === 'tasks' || type === 'all') {
      const taskWhere: any = {
        $or: [
          { title: searchRegex },
          { description: searchRegex },
        ],
      };

      // Only show tasks from projects user has access to
      const userProjects = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      const projectIds = userProjects.map(p => p.projectId);

      if (projectId) {
        taskWhere.projectId = projectId as string;
      } else {
        taskWhere.projectId = { $in: projectIds };
      }

      const tasks = await prisma.task.findMany({
        where: taskWhere,
        include: {
          project: {
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
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          labels: true,
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
          sprint: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        take: 20,
        orderBy: { updatedAt: 'desc' },
      });

      results.tasks = tasks;
    }

    // Search Projects
    if (!type || type === 'projects' || type === 'all') {
      const projectWhere: any = {
        $or: [
          { name: searchRegex },
          { description: searchRegex },
        ],
        members: {
          some: {
            userId,
          },
        },
      };

      const projects = await prisma.project.findMany({
        where: projectWhere,
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              tasks: true,
              members: true,
            },
          },
        },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      });

      results.projects = projects;
    }

    // Search Comments
    if (!type || type === 'comments' || type === 'all') {
      const userProjects = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      const projectIds = userProjects.map(p => p.projectId);

      const commentWhere: any = {
        content: searchRegex,
        task: {
          projectId: projectId ? projectId as string : { $in: projectIds },
        },
      };

      const comments = await prisma.taskComment.findMany({
        where: commentWhere,
        include: {
          task: {
            select: {
              id: true,
              title: true,
              projectId: true,
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        take: 15,
        orderBy: { createdAt: 'desc' },
      });

      results.comments = comments;
    }

    res.json({
      query: searchQuery,
      results,
      counts: {
        tasks: results.tasks.length,
        projects: results.projects.length,
        comments: results.comments.length,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

export default router;


