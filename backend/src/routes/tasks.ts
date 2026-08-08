import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

// Configure multer for file uploads (use /tmp on Vercel — only writable path)
const uploadDir = process.env.VERCEL
  ? path.join('/tmp', 'pms-uploads')
  : path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  },
});

// Get tasks for project
router.get('/project/:projectId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { status, issueType, assigneeId, sprintId, isInBacklog } = req.query;

    const where: any = {
      projectId: req.params.projectId,
    };

    if (status) where.status = status;
    if (issueType) where.issueType = issueType;
    if (assigneeId) {
      where.assignments = {
        some: {
          userId: assigneeId as string,
        },
      };
    }
    if (sprintId !== undefined) {
      if (sprintId === 'null' || sprintId === null) {
        where.sprintId = null;
      } else {
        where.sprintId = sprintId as string;
      }
    }
    if (isInBacklog !== undefined) where.isInBacklog = isInBacklog === 'true';

    const tasks = await prisma.task.findMany({
      where,
      include: {
        column: {
          select: {
            id: true,
            name: true,
            color: true,
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
        checklist: {
          orderBy: { order: 'asc' },
        },
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    res.json({ tasks });
  } catch (error: any) {
    console.error('Get tasks error:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ 
      error: 'Failed to get tasks',
      message: error.message || 'Unknown error',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
});

// Get task by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        column: true,
        board: true,
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
                email: true,
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
        attachments: {
          orderBy: { uploadedAt: 'desc' },
        },
        comments: {
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
          orderBy: { createdAt: 'asc' },
        },
        activities: {
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
          orderBy: { createdAt: 'desc' },
        },
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// Create task
router.post(
  '/',
  authenticate,
  [body('title').trim().notEmpty(), body('projectId').notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        description,
        issueType,
        projectId,
        columnId,
        boardId,
        priority,
        storyPoints,
        timeEstimate,
        dueDate,
        isInBacklog,
        sprintId,
      } = req.body;

      // Get max order
      const maxOrder = await prisma.task.findFirst({
        where: {
          projectId,
          ...(columnId ? { columnId } : {}),
        },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const task = await prisma.task.create({
        data: {
          title,
          description,
          issueType: issueType || 'TASK',
          projectId,
          columnId,
          boardId,
          createdById: req.userId!,
          priority: priority || 0,
          storyPoints,
          timeEstimate,
          dueDate: dueDate ? new Date(dueDate) : null,
          isInBacklog: isInBacklog ?? false,
          sprintId,
          order: (maxOrder?.order ?? -1) + 1,
        },
        include: {
          column: true,
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

      // Create activity log
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          userId: req.userId!,
          action: 'created',
          newValue: title,
        },
      });

      res.status(201).json({ task });
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }
);

// Update task
router.patch(
  '/:id',
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      const {
        title,
        description,
        issueType,
        status,
        priority,
        storyPoints,
        timeEstimate,
        dueDate,
        columnId,
        sprintId,
        isInBacklog,
      } = req.body;

      const oldTask = await prisma.task.findUnique({
        where: { id: req.params.id },
      });

      if (!oldTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = await prisma.task.update({
        where: { id: req.params.id },
        data: {
          title,
          description,
          issueType,
          status,
          priority,
          storyPoints,
          timeEstimate,
          dueDate: dueDate ? new Date(dueDate) : null,
          columnId,
          sprintId,
          isInBacklog,
        },
        include: {
          column: true,
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

      // Create activity log for changes
      const activities = [];
      if (title && title !== oldTask.title) {
        activities.push({
          taskId: task.id,
          userId: req.userId!,
          action: 'updated',
          oldValue: `title: ${oldTask.title}`,
          newValue: `title: ${title}`,
        });
      }
      if (status && status !== oldTask.status) {
        activities.push({
          taskId: task.id,
          userId: req.userId!,
          action: 'status_changed',
          oldValue: oldTask.status,
          newValue: status,
        });
      }
      if (columnId && columnId !== oldTask.columnId) {
        activities.push({
          taskId: task.id,
          userId: req.userId!,
          action: 'moved',
          oldValue: oldTask.columnId || 'null',
          newValue: columnId,
        });
      }

      if (activities.length > 0) {
        await prisma.taskActivity.createMany({
          data: activities,
        });
      }

      res.json({ task });
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  }
);

// Delete task
router.delete(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      await prisma.task.delete({
        where: { id: req.params.id },
      });

      res.json({ message: 'Task deleted' });
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  }
);

// Assign task to user
router.post(
  '/:id/assign',
  authenticate,
  [body('userId').notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.body;

      const assignment = await prisma.taskAssignment.create({
        data: {
          taskId: req.params.id,
          userId,
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

      // Create activity log
      await prisma.taskActivity.create({
        data: {
          taskId: req.params.id,
          userId: req.userId!,
          action: 'assigned',
          newValue: userId,
        },
      });

      res.status(201).json({ assignment });
    } catch (error) {
      console.error('Assign task error:', error);
      res.status(500).json({ error: 'Failed to assign task' });
    }
  }
);

// Unassign task
router.delete(
  '/:id/assign/:userId',
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      await prisma.taskAssignment.deleteMany({
        where: {
          taskId: req.params.id,
          userId: req.params.userId,
        },
      });

      // Create activity log
      await prisma.taskActivity.create({
        data: {
          taskId: req.params.id,
          userId: req.userId!,
          action: 'unassigned',
          oldValue: req.params.userId,
        },
      });

      res.json({ message: 'Task unassigned' });
    } catch (error) {
      console.error('Unassign task error:', error);
      res.status(500).json({ error: 'Failed to unassign task' });
    }
  }
);

// Add label
router.post(
  '/:id/labels',
  authenticate,
  [body('name').trim().notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, color } = req.body;

      const label = await prisma.taskLabel.create({
        data: {
          taskId: req.params.id,
          name,
          color: color || '#64748b',
        },
      });

      res.status(201).json({ label });
    } catch (error) {
      console.error('Add label error:', error);
      res.status(500).json({ error: 'Failed to add label' });
    }
  }
);

// Remove label
router.delete('/:id/labels/:labelId', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.taskLabel.delete({
      where: { id: req.params.labelId },
    });

    res.json({ message: 'Label removed' });
  } catch (error) {
    console.error('Remove label error:', error);
    res.status(500).json({ error: 'Failed to remove label' });
  }
});

// Add checklist item
router.post(
  '/:id/checklist',
  authenticate,
  [body('text').trim().notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { text } = req.body;

      const maxOrder = await prisma.checklistItem.findFirst({
        where: { taskId: req.params.id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const item = await prisma.checklistItem.create({
        data: {
          taskId: req.params.id,
          text,
          order: (maxOrder?.order ?? -1) + 1,
        },
      });

      res.status(201).json({ item });
    } catch (error) {
      console.error('Add checklist item error:', error);
      res.status(500).json({ error: 'Failed to add checklist item' });
    }
  }
);

// Update checklist item
router.patch('/checklist/:itemId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { text, isChecked } = req.body;

    const item = await prisma.checklistItem.update({
      where: { id: req.params.itemId },
      data: {
        text,
        isChecked,
      },
    });

    res.json({ item });
  } catch (error) {
    console.error('Update checklist item error:', error);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

// Delete checklist item
router.delete('/checklist/:itemId', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.checklistItem.delete({
      where: { id: req.params.itemId },
    });

    res.json({ message: 'Checklist item deleted' });
  } catch (error) {
    console.error('Delete checklist item error:', error);
    res.status(500).json({ error: 'Failed to delete checklist item' });
  }
});

// Add comment
router.post(
  '/:id/comments',
  authenticate,
  [body('content').trim().notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { content, mentionedUserIds = [] } = req.body;

      // Extract mentions from content (@username pattern)
      const mentionPattern = /@(\w+)/g;
      const mentionedUsernames: string[] = [];
      let match;
      while ((match = mentionPattern.exec(content)) !== null) {
        mentionedUsernames.push(match[1]);
      }

      // Find users by username/email
      const mentionedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { email: { in: mentionedUsernames } },
            { firstName: { in: mentionedUsernames } },
            { lastName: { in: mentionedUsernames } },
          ],
        },
        select: { id: true },
      });

      const allMentionedIds = [
        ...mentionedUserIds,
        ...mentionedUsers.map(u => u.id),
      ];

      const comment = await prisma.taskComment.create({
        data: {
          taskId: req.params.id,
          userId: req.userId!,
          content,
          mentions: {
            create: allMentionedIds.map((userId: string) => ({
              userId,
            })),
          },
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
          mentions: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          attachments: true,
        },
      });

      // Create activity log
      await prisma.taskActivity.create({
        data: {
          taskId: req.params.id,
          userId: req.userId!,
          action: 'commented',
          newValue: content.substring(0, 100),
        },
      });

      res.status(201).json({ comment });
    } catch (error) {
      console.error('Add comment error:', error);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  }
);

// Update comment
router.patch('/comments/:commentId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { content } = req.body;

    const comment = await prisma.taskComment.update({
      where: { id: req.params.commentId },
      data: { content },
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

    res.json({ comment });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// Delete comment
router.delete('/comments/:commentId', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.taskComment.delete({
      where: { id: req.params.commentId },
    });

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Add reaction to comment
router.post('/comments/:commentId/reactions', authenticate, [
  body('emoji').notEmpty().withMessage('Emoji is required'),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { emoji } = req.body;

    const reaction = await prisma.commentReaction.create({
      data: {
        commentId: req.params.commentId,
        userId: req.userId!,
        emoji,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.status(201).json({ reaction });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Reaction already exists' });
    }
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Remove reaction from comment
router.delete('/comments/:commentId/reactions/:emoji', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.commentReaction.deleteMany({
      where: {
        commentId: req.params.commentId,
        userId: req.userId!,
        emoji: req.params.emoji,
      },
    });

    res.json({ message: 'Reaction removed' });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// Upload file to comment
router.post(
  '/comments/:commentId/attachments',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const attachment = await prisma.commentAttachment.create({
        data: {
          commentId: req.params.commentId,
          fileName: req.file.originalname,
          filePath: req.file.filename,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        },
      });

      res.status(201).json({ attachment });
    } catch (error) {
      console.error('Upload comment attachment error:', error);
      res.status(500).json({ error: 'Failed to upload attachment' });
    }
  }
);

// Upload attachment
router.post(
  '/:id/attachments',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const attachment = await prisma.attachment.create({
        data: {
          taskId: req.params.id,
          fileName: req.file.originalname,
          filePath: req.file.filename,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          uploadedBy: req.userId!,
        },
      });

      // Create activity log
      await prisma.taskActivity.create({
        data: {
          taskId: req.params.id,
          userId: req.userId!,
          action: 'attachment_added',
          newValue: req.file.originalname,
        },
      });

      res.status(201).json({ attachment });
    } catch (error) {
      console.error('Upload attachment error:', error);
      res.status(500).json({ error: 'Failed to upload attachment' });
    }
  }
);

// Delete attachment
router.delete('/attachments/:attachmentId', authenticate, async (req: AuthRequest, res) => {
  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.attachmentId },
    });

    if (attachment) {
      const filePath = path.join(uploadDir, attachment.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await prisma.attachment.delete({
        where: { id: req.params.attachmentId },
      });
    }

    res.json({ message: 'Attachment deleted' });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// Move task (drag & drop)
router.patch(
  '/:id/move',
  authenticate,
  [body('columnId').notEmpty(), body('order').isInt()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { columnId, order, boardId } = req.body;

      const oldTask = await prisma.task.findUnique({
        where: { id: req.params.id },
      });

      const task = await prisma.task.update({
        where: { id: req.params.id },
        data: {
          columnId,
          boardId,
          order,
          isInBacklog: false,
        },
      });

      // Create activity log
      if (oldTask && oldTask.columnId !== columnId) {
        await prisma.taskActivity.create({
          data: {
            taskId: task.id,
            userId: req.userId!,
            action: 'moved',
            oldValue: oldTask.columnId || 'null',
            newValue: columnId,
          },
        });
      }

      res.json({ task });
    } catch (error) {
      console.error('Move task error:', error);
      res.status(500).json({ error: 'Failed to move task' });
    }
  }
);

// Reorder tasks
router.patch(
  '/reorder',
  authenticate,
  [body('taskOrders').isArray()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { taskOrders } = req.body; // [{ taskId, order, columnId? }]

      await Promise.all(
        taskOrders.map(
          ({
            taskId,
            order,
            columnId,
          }: {
            taskId: string;
            order: number;
            columnId?: string;
          }) =>
            prisma.task.update({
              where: { id: taskId },
              data: {
                order,
                ...(columnId ? { columnId } : {}),
              },
            })
        )
      );

      res.json({ message: 'Tasks reordered' });
    } catch (error) {
      console.error('Reorder tasks error:', error);
      res.status(500).json({ error: 'Failed to reorder tasks' });
    }
  }
);

// Get subtasks for a task
router.get('/:id/subtasks', authenticate, async (req: AuthRequest, res) => {
  try {
    const subtasks = await prisma.subtask.findMany({
      where: { taskId: req.params.id },
      orderBy: { order: 'asc' },
    });

    res.json({ subtasks });
  } catch (error) {
    console.error('Get subtasks error:', error);
    res.status(500).json({ error: 'Failed to get subtasks' });
  }
});

// Create subtask
router.post(
  '/:id/subtasks',
  authenticate,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').optional().isString(),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description } = req.body;

      // Get max order
      const maxOrder = await prisma.subtask.findFirst({
        where: { taskId: req.params.id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const subtask = await prisma.subtask.create({
        data: {
          taskId: req.params.id,
          title,
          description,
          order: (maxOrder?.order || -1) + 1,
        },
      });

      res.status(201).json({ subtask });
    } catch (error) {
      console.error('Create subtask error:', error);
      res.status(500).json({ error: 'Failed to create subtask' });
    }
  }
);

// Update subtask
router.patch(
  '/subtasks/:subtaskId',
  authenticate,
  [
    body('title').optional().notEmpty(),
    body('description').optional().isString(),
    body('isCompleted').optional().isBoolean(),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updateData: any = {};
      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.isCompleted !== undefined) updateData.isCompleted = req.body.isCompleted;

      const subtask = await prisma.subtask.update({
        where: { id: req.params.subtaskId },
        data: updateData,
      });

      res.json({ subtask });
    } catch (error) {
      console.error('Update subtask error:', error);
      res.status(500).json({ error: 'Failed to update subtask' });
    }
  }
);

// Delete subtask
router.delete('/subtasks/:subtaskId', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.subtask.delete({
      where: { id: req.params.subtaskId },
    });

    res.json({ message: 'Subtask deleted' });
  } catch (error) {
    console.error('Delete subtask error:', error);
    res.status(500).json({ error: 'Failed to delete subtask' });
  }
});

export default router;

