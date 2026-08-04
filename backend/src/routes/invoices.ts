import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Get invoices for a project
router.get('/project/:projectId', authenticate, async (req: AuthRequest, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { projectId: req.params.projectId },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ invoices });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

// Generate invoice number
async function generateInvoiceNumber(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  const prefix = project?.name.substring(0, 3).toUpperCase() || 'INV';
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: {
      projectId,
      invoiceNumber: {
        startsWith: `${prefix}-${year}-`,
      },
    },
  });

  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function groupEntriesIntoItems(
  projectId: string,
  entries: any[],
  hourlyRateOverride?: number | null
) {
  const userGroups: Record<string, any> = {};

  for (const entry of entries) {
    const userId = entry.userId;
    if (!userGroups[userId]) {
      let rate = hourlyRateOverride;
      if (rate == null || Number.isNaN(rate) || rate < 0) {
        const dbRate = await prisma.hourlyRate.findFirst({
          where: {
            userId,
            projectId,
            effectiveFrom: { lte: entry.date },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: entry.date } }],
          },
          orderBy: { effectiveFrom: 'desc' },
        });
        rate = dbRate?.rate ?? 50;
      }

      userGroups[userId] = {
        user: entry.user,
        rate,
        hours: 0,
      };
    }
    userGroups[userId].hours += entry.hours;
  }

  return Object.values(userGroups).map((group: any, index) => ({
    description: `Development work by ${group.user.firstName} ${group.user.lastName}`,
    quantity: Math.round(group.hours * 100) / 100,
    unitPrice: group.rate,
    taxRate: 0,
    order: index,
  }));
}

async function buildInvoiceFromEntries({
  projectId,
  entries,
  dueDate,
  currency,
  taxRate,
  notes,
  clientName,
  clientEmail,
  clientAddress,
  createdById,
  hourlyRate,
}: {
  projectId: string;
  entries: any[];
  dueDate: string;
  currency: string;
  taxRate: number | string;
  notes?: string;
  clientName?: string;
  clientEmail?: string;
  clientAddress?: string;
  createdById: string;
  hourlyRate?: number | null;
}) {
  const rate =
    hourlyRate != null && !Number.isNaN(Number(hourlyRate))
      ? parseFloat(String(hourlyRate))
      : null;
  const items = await groupEntriesIntoItems(projectId, entries, rate);
  const invoiceNumber = await generateInvoiceNumber(projectId);

  return prisma.invoice.create({
    data: {
      projectId,
      createdById,
      invoiceNumber,
      dueDate: new Date(dueDate),
      currency,
      taxRate: parseFloat(String(taxRate)),
      notes: notes || null,
      clientName: clientName || null,
      clientEmail: clientEmail || null,
      clientAddress: clientAddress || null,
      items: {
        create: items,
      },
    },
    include: {
      items: true,
    },
  });
}

// Create invoice
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN'),
  [
    body('projectId').notEmpty().withMessage('Project ID is required'),
    body('dueDate').isISO8601().withMessage('Invalid due date'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.description').notEmpty().withMessage('Item description is required'),
    body('items.*.quantity').isFloat({ min: 0 }).withMessage('Quantity must be positive'),
    body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be positive'),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        projectId,
        dueDate,
        currency = 'USD',
        taxRate = 0,
        notes,
        clientName,
        clientEmail,
        clientAddress,
        items,
      } = req.body;

      const invoiceNumber = await generateInvoiceNumber(projectId);

      const invoice = await prisma.invoice.create({
        data: {
          projectId,
          createdById: req.userId!,
          invoiceNumber,
          dueDate: new Date(dueDate),
          currency,
          taxRate: parseFloat(taxRate),
          notes,
          clientName,
          clientEmail,
          clientAddress,
          items: {
            create: items.map((item: any, index: number) => ({
              description: item.description,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              taxRate: parseFloat(item.taxRate || 0),
              order: index,
            })),
          },
        },
        include: {
          items: true,
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.status(201).json({ invoice });
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(500).json({ error: 'Failed to create invoice' });
    }
  }
);

      // Create invoice from time entries
router.post(
  '/from-time-entries',
  authenticate,
  authorize('SUPER_ADMIN'),
  [
    body('projectId').notEmpty().withMessage('Project ID is required'),
    body('timeEntryIds').isArray({ min: 1 }).withMessage('At least one time entry is required'),
    body('dueDate').isISO8601().withMessage('Invalid due date'),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { projectId, timeEntryIds, dueDate, currency = 'USD', taxRate = 0, notes, clientName, clientEmail, clientAddress } =
        req.body;

      const entries = await prisma.timeEntry.findMany({
        where: {
          id: { in: timeEntryIds },
          projectId,
          hours: { gt: 0 },
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
          task: {
            select: { id: true, title: true, sprintId: true },
          },
        },
      });

      if (entries.length === 0) {
        return res.status(400).json({ error: 'No time entries found' });
      }

      const invoice = await buildInvoiceFromEntries({
        projectId,
        entries,
        dueDate,
        currency,
        taxRate,
        notes,
        clientName,
        clientEmail,
        clientAddress,
        createdById: req.userId!,
      });

      res.status(201).json({ invoice });
    } catch (error) {
      console.error('Create invoice from time entries error:', error);
      res.status(500).json({ error: 'Failed to create invoice' });
    }
  }
);

// Generate invoice by date range (timeline) or sprint — Super Admin only
router.post(
  '/generate',
  authenticate,
  authorize('SUPER_ADMIN'),
  [
    body('projectId').notEmpty().withMessage('Project ID is required'),
    body('mode').isIn(['timeline', 'sprint']).withMessage('mode must be timeline or sprint'),
    body('dueDate').isISO8601().withMessage('Invalid due date'),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        projectId,
        mode,
        startDate,
        endDate,
        sprintId,
        dueDate,
        currency = 'USD',
        taxRate = 0,
        hourlyRate,
        notes,
        clientName,
        clientEmail,
        clientAddress,
        preview = false,
      } = req.body;

      const where: any = {
        projectId,
        hours: { gt: 0 },
      };

      let periodLabel = '';

      if (mode === 'timeline') {
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'startDate and endDate are required for timeline mode' });
        }
        if (new Date(endDate) < new Date(startDate)) {
          return res.status(400).json({ error: 'End date must be on or after start date' });
        }
        where.date = {
          gte: new Date(startDate),
          lte: new Date(endDate),
        };
        periodLabel = `${new Date(startDate).toLocaleDateString()} – ${new Date(endDate).toLocaleDateString()}`;
      } else {
        if (!sprintId) {
          return res.status(400).json({ error: 'sprintId is required for sprint mode' });
        }
        const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
        if (!sprint || sprint.projectId !== projectId) {
          return res.status(404).json({ error: 'Sprint not found' });
        }
        where.task = { sprintId };
        periodLabel = `Sprint: ${sprint.name}`;
      }

      const entries = await prisma.timeEntry.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
          task: {
            select: { id: true, title: true, sprintId: true },
          },
        },
        orderBy: { date: 'asc' },
      });

      if (entries.length === 0) {
        return res.status(400).json({
          error:
            mode === 'sprint'
              ? 'No time logged on tasks in this sprint'
              : 'No time entries found in this date range',
        });
      }

      const rateOverride =
        hourlyRate != null && hourlyRate !== '' ? parseFloat(String(hourlyRate)) : null;

      const previewItems = await groupEntriesIntoItems(projectId, entries, rateOverride);

      if (preview) {
        const subtotal = previewItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        return res.json({
          preview: true,
          periodLabel,
          entryCount: entries.length,
          totalHours: entries.reduce((s, e) => s + e.hours, 0),
          hourlyRate: rateOverride,
          currency,
          items: previewItems,
          subtotal,
          tax: subtotal * (parseFloat(taxRate) / 100),
          total: subtotal * (1 + parseFloat(taxRate) / 100),
          entries: entries.map((e) => ({
            id: e.id,
            hours: e.hours,
            date: e.date,
            description: e.description,
            user: e.user,
            task: e.task,
          })),
        });
      }

      const invoice = await buildInvoiceFromEntries({
        projectId,
        entries,
        dueDate,
        currency,
        taxRate,
        notes: notes || periodLabel,
        clientName,
        clientEmail,
        clientAddress,
        createdById: req.userId!,
        hourlyRate: rateOverride,
      });

      res.status(201).json({ invoice, periodLabel });
    } catch (error) {
      console.error('Generate invoice error:', error);
      res.status(500).json({ error: 'Failed to generate invoice' });
    }
  }
);

// Get invoice by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
        project: {
          select: {
            id: true,
            name: true,
            workspace: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ invoice });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to get invoice' });
  }
});

// Update invoice
router.patch(
  '/:id',
  authenticate,
  [
    body('status').optional().isIn(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']),
    body('dueDate').optional().isISO8601(),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.id },
      });

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const updateData: any = {};
      if (req.body.status) updateData.status = req.body.status;
      if (req.body.dueDate) updateData.dueDate = new Date(req.body.dueDate);
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.clientName !== undefined) updateData.clientName = req.body.clientName;
      if (req.body.clientEmail !== undefined) updateData.clientEmail = req.body.clientEmail;
      if (req.body.clientAddress !== undefined) updateData.clientAddress = req.body.clientAddress;

      const updated = await prisma.invoice.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          items: {
            orderBy: { order: 'asc' },
          },
        },
      });

      res.json({ invoice: updated });
    } catch (error) {
      console.error('Update invoice error:', error);
      res.status(500).json({ error: 'Failed to update invoice' });
    }
  }
);

// Generate PDF
router.get('/:id/pdf', authenticate, async (req: AuthRequest, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
        project: {
          select: {
            name: true,
            workspace: {
              select: {
                name: true,
              },
            },
          },
        },
        creator: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`
    );

    doc.pipe(res);

    // Header
    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice #: ${invoice.invoiceNumber}`, { align: 'right' });
    doc.text(`Date: ${new Date(invoice.issueDate).toLocaleDateString()}`, { align: 'right' });
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, { align: 'right' });
    doc.moveDown();

    // Client info
    if (invoice.clientName) {
      doc.fontSize(14).text('Bill To:', { continued: false });
      doc.fontSize(10).text(invoice.clientName);
      if (invoice.clientEmail) doc.text(invoice.clientEmail);
      if (invoice.clientAddress) doc.text(invoice.clientAddress);
      doc.moveDown();
    }

    // Items table
    doc.fontSize(12).text('Items:', { underline: true });
    doc.moveDown(0.5);

    let yPos = doc.y;
    const tableTop = yPos;
    const itemHeight = 30;

    // Table header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Description', 50, yPos);
    doc.text('Qty', 350, yPos);
    doc.text('Price', 400, yPos);
    doc.text('Total', 450, yPos);
    yPos += itemHeight;

    // Table rows
    doc.font('Helvetica');
    let subtotal = 0;
    invoice.items.forEach(item => {
      const total = item.quantity * item.unitPrice;
      subtotal += total;

      doc.text(item.description, 50, yPos, { width: 280 });
      doc.text(item.quantity.toString(), 350, yPos);
      doc.text(`${invoice.currency} ${item.unitPrice.toFixed(2)}`, 400, yPos);
      doc.text(`${invoice.currency} ${total.toFixed(2)}`, 450, yPos);
      yPos += itemHeight;
    });

    // Totals
    yPos += 10;
    const tax = subtotal * (invoice.taxRate / 100);
    const total = subtotal + tax;

    doc.font('Helvetica-Bold');
    doc.text('Subtotal:', 350, yPos);
    doc.text(`${invoice.currency} ${subtotal.toFixed(2)}`, 450, yPos);
    yPos += 20;

    if (invoice.taxRate > 0) {
      doc.text(`Tax (${invoice.taxRate}%):`, 350, yPos);
      doc.text(`${invoice.currency} ${tax.toFixed(2)}`, 450, yPos);
      yPos += 20;
    }

    doc.fontSize(14);
    doc.text('Total:', 350, yPos);
    doc.text(`${invoice.currency} ${total.toFixed(2)}`, 450, yPos);

    // Notes
    if (invoice.notes) {
      yPos += 40;
      doc.fontSize(10).font('Helvetica');
      doc.text('Notes:', 50, yPos);
      doc.text(invoice.notes, 50, yPos + 15, { width: 500 });
    }

    doc.end();
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Delete invoice
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER']), async (req: AuthRequest, res) => {
  try {
    await prisma.invoice.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

export default router;

