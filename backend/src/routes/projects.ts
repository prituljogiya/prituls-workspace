import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, authorizePermission } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { githubRepoDisplay, parseGithubRepo } from '../utils/github';
import { getEffectiveRole, roleHasPermission } from '../permissions/matrix';

const router = express.Router();

async function assertProjectAccess(projectId: string, userId: string, userRole?: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      githubRepo: true,
      members: {
        where: { userId },
        select: { id: true },
      },
    },
  });
  if (!project) return null;
  if (userRole !== 'SUPER_ADMIN' && project.members.length === 0) return null;
  return project;
}

// Get all projects for user (super admin sees all)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const where =
      req.user?.role === 'SUPER_ADMIN'
        ? { isArchived: false }
        : {
            members: {
              some: {
                userId: req.userId!,
              },
            },
            isArchived: false,
          };

    const projects = await prisma.project.findMany({
      where,
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            companyName: true,
            bankName: true,
            accountName: true,
            accountNumber: true,
            ifscCode: true,
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

// GitHub link info for project
router.get('/:id/github', authenticate, async (req: AuthRequest, res) => {
  try {
    const project = await assertProjectAccess(req.params.id, req.userId!, req.user?.role);
    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const parsed = parseGithubRepo(project.githubRepo);
    res.json({
      githubRepo: project.githubRepo || null,
      parsed: parsed
        ? {
            owner: parsed.owner,
            repo: parsed.repo,
            fullName: githubRepoDisplay(parsed.owner, parsed.repo),
            htmlUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
          }
        : null,
      configured: Boolean(parsed),
      hasToken: Boolean(process.env.GITHUB_TOKEN),
    });
  } catch (error) {
    console.error('Get project GitHub config error:', error);
    res.status(500).json({ error: 'Failed to get GitHub config' });
  }
});

// List pull requests from the linked GitHub repo
router.get('/:id/github/pulls', authenticate, async (req: AuthRequest, res) => {
  try {
    const project = await assertProjectAccess(req.params.id, req.userId!, req.user?.role);
    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const parsed = parseGithubRepo(project.githubRepo);
    if (!parsed) {
      return res.status(400).json({
        error: 'No GitHub repository linked to this project',
        code: 'GITHUB_REPO_NOT_LINKED',
      });
    }

    const state = (req.query.state as string) || 'open';
    const perPage = Math.min(parseInt(String(req.query.per_page || '30'), 10) || 30, 100);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'pms-portal',
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls?state=${encodeURIComponent(state)}&per_page=${perPage}&sort=updated&direction=desc`;
    const response = await fetch(url, { headers });

    if (response.status === 404) {
      return res.status(404).json({
        error: 'GitHub repository not found (or private without GITHUB_TOKEN)',
        code: 'GITHUB_REPO_NOT_FOUND',
        repo: githubRepoDisplay(parsed.owner, parsed.repo),
      });
    }

    if (response.status === 401 || response.status === 403) {
      const body = await response.text();
      return res.status(502).json({
        error: 'GitHub authentication failed. Set a valid GITHUB_TOKEN in the backend .env',
        code: 'GITHUB_AUTH_FAILED',
        details: body.slice(0, 300),
      });
    }

    if (!response.ok) {
      const body = await response.text();
      return res.status(502).json({
        error: `GitHub API error (${response.status})`,
        code: 'GITHUB_API_ERROR',
        details: body.slice(0, 300),
      });
    }

    const data = (await response.json()) as any[];
    const pulls = data.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      draft: Boolean(pr.draft),
      htmlUrl: pr.html_url,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      mergedAt: pr.merged_at,
      closedAt: pr.closed_at,
      user: pr.user
        ? {
            login: pr.user.login,
            avatarUrl: pr.user.avatar_url,
            htmlUrl: pr.user.html_url,
          }
        : null,
      head: pr.head?.ref || null,
      base: pr.base?.ref || null,
      labels: (pr.labels || []).map((l: any) => ({
        name: l.name,
        color: l.color,
      })),
    }));

    res.json({
      repo: {
        owner: parsed.owner,
        repo: parsed.repo,
        fullName: githubRepoDisplay(parsed.owner, parsed.repo),
        htmlUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
      },
      state,
      pulls,
      count: pulls.length,
    });
  } catch (error) {
    console.error('List GitHub PRs error:', error);
    res.status(500).json({ error: 'Failed to fetch GitHub pull requests' });
  }
});

// Project activity timeline
router.get('/:id/timeline', authenticate, async (req: AuthRequest, res) => {
  try {
    const project = await assertProjectAccess(req.params.id, req.userId!, req.user?.role);
    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const role = await getEffectiveRole(req.userId!, req.user?.role, req.params.id);
    if (!(await roleHasPermission(role, 'timeline.view'))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const take = Math.min(parseInt(String(req.query.limit || '80'), 10) || 80, 200);
    const activities = await prisma.taskActivity.findMany({
      where: { task: { projectId: req.params.id } },
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
            status: true,
            issueType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    res.json({
      activities: activities.map((item) => ({
        id: item.id,
        action: item.action,
        oldValue: item.oldValue,
        newValue: item.newValue,
        createdAt: item.createdAt,
        user: item.user,
        task: item.task,
      })),
    });
  } catch (error) {
    console.error('Get project timeline error:', error);
    res.status(500).json({ error: 'Failed to load timeline' });
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

    const myRole = await getEffectiveRole(req.userId!, req.user?.role, project.id);
    res.json({ project, myRole });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// Create project
router.post(
  '/',
  authenticate,
  authorizePermission('projects.create'),
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
  authorizePermission('projects.manage', (req) => req.params.id),
  async (req: AuthRequest, res) => {
    try {
      const { name, description, color, githubRepo, invoicesEnabled } = req.body;

      const data: Record<string, any> = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (color !== undefined) data.color = color;
      if (req.user?.role === 'SUPER_ADMIN' && typeof invoicesEnabled === 'boolean') {
        data.invoicesEnabled = invoicesEnabled;
      }
      if (githubRepo !== undefined) {
        const trimmed = typeof githubRepo === 'string' ? githubRepo.trim() : '';
        if (trimmed && !parseGithubRepo(trimmed)) {
          return res.status(400).json({
            error: 'Invalid GitHub repo. Use owner/repo or a github.com URL',
          });
        }
        data.githubRepo = trimmed || null;
      }

      const project = await prisma.project.update({
        where: { id: req.params.id },
        data,
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
  authorizePermission('projects.manage', (req) => req.params.id),
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
  authorizePermission('members.manage', (req) => req.params.id),
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
  authorizePermission('members.manage', (req) => req.params.id),
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

// Update project member role
router.patch(
  '/:id/members/:memberId',
  authenticate,
  authorizePermission('members.manage', (req) => req.params.id),
  [body('role').notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const existing = await prisma.projectMember.findUnique({
        where: { id: req.params.memberId },
      });
      if (!existing || existing.projectId !== req.params.id) {
        return res.status(404).json({ error: 'Member not found' });
      }

      const member = await prisma.projectMember.update({
        where: { id: req.params.memberId },
        data: { role: req.body.role },
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
      console.error('Update member role error:', error);
      res.status(500).json({ error: 'Failed to update member role' });
    }
  }
);

export default router;

