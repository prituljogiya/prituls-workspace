import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, authorizePermission } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

async function projectIdFromBoard(req: AuthRequest) {
  const id = req.params.id;
  if (!id) return undefined;
  const board = await prisma.board.findUnique({
    where: { id },
    select: { projectId: true },
  });
  return board?.projectId;
}

async function projectIdFromColumn(req: AuthRequest) {
  const columnId = req.params.columnId;
  if (!columnId) return undefined;
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    select: { board: { select: { projectId: true } } },
  });
  return column?.board.projectId;
}

// Get boards for project
router.get('/project/:projectId', authenticate, async (req: AuthRequest, res) => {
  try {
    const boards = await prisma.board.findMany({
      where: {
        projectId: req.params.projectId,
        isActive: true,
      },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: { tasks: true },
            },
          },
        },
        _count: {
          select: { columns: true, tasks: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    res.json({ boards });
  } catch (error) {
    console.error('Get boards error:', error);
    res.status(500).json({ error: 'Failed to get boards' });
  }
});

// Get board by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const board = await prisma.board.findUnique({
      where: { id: req.params.id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        columns: {
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              orderBy: { order: 'asc' },
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
                labels: true,
                _count: {
                  select: {
                    checklist: true,
                    comments: true,
                    attachments: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    res.json({ board });
  } catch (error) {
    console.error('Get board error:', error);
    res.status(500).json({ error: 'Failed to get board' });
  }
});

// Create board
router.post(
  '/',
  authenticate,
  authorizePermission('boards.create'),
  [body('name').trim().notEmpty(), body('projectId').notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, projectId } = req.body;

      // Get max order
      const maxOrder = await prisma.board.findFirst({
        where: { projectId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const board = await prisma.board.create({
        data: {
          name,
          description,
          projectId,
          order: (maxOrder?.order ?? -1) + 1,
        },
        include: {
          columns: true,
        },
      });

      res.status(201).json({ board });
    } catch (error) {
      console.error('Create board error:', error);
      res.status(500).json({ error: 'Failed to create board' });
    }
  }
);

// Update board
router.patch(
  '/:id',
  authenticate,
  authorizePermission('boards.manage', projectIdFromBoard),
  async (req: AuthRequest, res) => {
    try {
      const { name, description } = req.body;

      const board = await prisma.board.update({
        where: { id: req.params.id },
        data: {
          name,
          description,
        },
      });

      res.json({ board });
    } catch (error) {
      console.error('Update board error:', error);
      res.status(500).json({ error: 'Failed to update board' });
    }
  }
);

// Delete board
router.delete(
  '/:id',
  authenticate,
  authorizePermission('boards.manage', projectIdFromBoard),
  async (req: AuthRequest, res) => {
    try {
      await prisma.board.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });

      res.json({ message: 'Board deleted' });
    } catch (error) {
      console.error('Delete board error:', error);
      res.status(500).json({ error: 'Failed to delete board' });
    }
  }
);

// Create column
router.post(
  '/:id/columns',
  authenticate,
  authorizePermission('boards.manage', projectIdFromBoard),
  [body('name').trim().notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, color } = req.body;

      // Get max order
      const maxOrder = await prisma.column.findFirst({
        where: { boardId: req.params.id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const column = await prisma.column.create({
        data: {
          name,
          boardId: req.params.id,
          color,
          order: (maxOrder?.order ?? -1) + 1,
        },
      });

      res.status(201).json({ column });
    } catch (error) {
      console.error('Create column error:', error);
      res.status(500).json({ error: 'Failed to create column' });
    }
  }
);

// Update column
router.patch(
  '/columns/:columnId',
  authenticate,
  authorizePermission('boards.manage', projectIdFromColumn),
  async (req: AuthRequest, res) => {
    try {
      const { name, color } = req.body;

      const column = await prisma.column.update({
        where: { id: req.params.columnId },
        data: {
          name,
          color,
        },
      });

      res.json({ column });
    } catch (error) {
      console.error('Update column error:', error);
      res.status(500).json({ error: 'Failed to update column' });
    }
  }
);

// Delete column
router.delete(
  '/columns/:columnId',
  authenticate,
  authorizePermission('boards.manage', projectIdFromColumn),
  async (req: AuthRequest, res) => {
    try {
      await prisma.column.delete({
        where: { id: req.params.columnId },
      });

      res.json({ message: 'Column deleted' });
    } catch (error) {
      console.error('Delete column error:', error);
      res.status(500).json({ error: 'Failed to delete column' });
    }
  }
);

// Reorder columns
router.patch(
  '/:id/columns/reorder',
  authenticate,
  authorizePermission('boards.manage', projectIdFromBoard),
  [body('columnOrders').isArray()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { columnOrders } = req.body; // [{ columnId, order }]

      await Promise.all(
        columnOrders.map(({ columnId, order }: { columnId: string; order: number }) =>
          prisma.column.update({
            where: { id: columnId },
            data: { order },
          })
        )
      );

      res.json({ message: 'Columns reordered' });
    } catch (error) {
      console.error('Reorder columns error:', error);
      res.status(500).json({ error: 'Failed to reorder columns' });
    }
  }
);

export default router;

