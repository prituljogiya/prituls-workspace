import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import PDFDocument from 'pdfkit';
import { notifyInvoiceClient } from '../utils/notifications';
import { getEffectiveRole } from '../permissions/matrix';
import { getProjectInvoiceSchedule, isInvoiceModuleVisible, notifyInvoiceViewers } from '../utils/invoiceAccess';
import { formatBillingMonth, normalizeBillingMonth } from '../utils/billingMonth';

const router = express.Router();

type InvoiceAccessResult =
  | { project: { id: string; invoicesEnabled: boolean } }
  | { error: string; status: 403 | 404; visibleFrom?: string | null };

async function assertInvoiceModuleAccess(
  projectId: string,
  userId?: string,
  userRole?: string,
  opts?: { allowManagersWhenDisabled?: boolean }
): Promise<InvoiceAccessResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      invoicesEnabled: true,
    },
  });
  if (!project) {
    return { error: 'Project not found', status: 404 as const };
  }
  const role = userId ? await getEffectiveRole(userId, userRole, projectId) : userRole;
  const schedule = await getProjectInvoiceSchedule(projectId);
  if (role === 'SUPER_ADMIN') {
    return { project };
  }
  if (
    opts?.allowManagersWhenDisabled &&
    role &&
    ['WORKSPACE_OWNER', 'PROJECT_MANAGER'].includes(role)
  ) {
    return { project };
  }
  if (
    !isInvoiceModuleVisible({
      role,
      invoicesEnabled: project.invoicesEnabled,
      visibleFrom: schedule.visibleFrom,
    })
  ) {
    if (!project.invoicesEnabled) {
      return { error: 'Invoices module is disabled for this project', status: 403 as const };
    }
    return {
      error: 'Invoices are scheduled and not visible yet',
      status: 403 as const,
      visibleFrom: schedule.visibleFrom,
    };
  }
  return { project };
}

const INVOICE_MANAGERS = ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'] as const;
const PAYMENT_ROLES = [
  'SUPER_ADMIN',
  'WORKSPACE_OWNER',
  'PROJECT_MANAGER',
  'TEAM_MEMBER',
  'VIEWER',
] as const;

const BANK_FIELDS = [
  'companyName',
  'companyAddress',
  'bankName',
  'accountName',
  'accountNumber',
  'ifscCode',
  'iban',
  'swiftBic',
  'upiId',
  'branchName',
] as const;

type BankField = (typeof BANK_FIELDS)[number];

function pickBankDetails(source: Record<string, any> | null | undefined): Partial<Record<BankField, string | null>> {
  if (!source) return {};
  const result: Partial<Record<BankField, string | null>> = {};
  for (const field of BANK_FIELDS) {
    if (source[field] !== undefined) {
      result[field] = source[field] === '' ? null : source[field];
    }
  }
  return result;
}

function mergeBankDetails(
  workspace: Record<string, any> | null | undefined,
  override: Record<string, any> | null | undefined
): Partial<Record<BankField, string | null>> {
  const fromWorkspace = pickBankDetails(workspace);
  const fromOverride = pickBankDetails(override);
  return { ...fromWorkspace, ...fromOverride };
}

function hasAnyBankDetails(details: Partial<Record<BankField, string | null | undefined>>): boolean {
  return BANK_FIELDS.some((field) => Boolean(details[field]));
}

// Get invoices for a project
router.get('/project/:projectId', authenticate, async (req: AuthRequest, res) => {
  try {
    const access = await assertInvoiceModuleAccess(req.params.projectId, req.userId, req.user?.role, {
      allowManagersWhenDisabled: true,
    });
    if ('error' in access) {
      return res.status(access.status).json({ error: access.error });
    }

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
        paidBy: {
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

// List all invoices (super admin / workspace owners)
router.get('/', authenticate, authorize('SUPER_ADMIN', 'WORKSPACE_OWNER'), async (req: AuthRequest, res) => {
  try {
    let invoices;

    if (req.user?.role === 'SUPER_ADMIN') {
      invoices = await prisma.invoice.findMany({
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
          paidBy: {
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
    } else {
      // Workspace owners: invoices for projects in their workspaces
      const memberships = await prisma.workspaceMember.findMany({
        where: { userId: req.userId! },
        select: { workspaceId: true },
      });
      const workspaceIds = memberships.map((m) => m.workspaceId);

      invoices = await prisma.invoice.findMany({
        where: {
          project: {
            workspaceId: { in: workspaceIds },
          },
        },
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
          paidBy: {
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
    }

    res.json({ invoices });
  } catch (error) {
    console.error('List invoices error:', error);
    res.status(500).json({ error: 'Failed to list invoices' });
  }
});

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
                companyName: true,
                companyAddress: true,
                bankName: true,
                accountName: true,
                accountNumber: true,
                ifscCode: true,
                iban: true,
                swiftBic: true,
                upiId: true,
                branchName: true,
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

// Generate invoice number
async function generateInvoiceNumber(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  const prefix = 'PW';
  const projectCode =
    (project?.name || 'INV')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 3)
      .toUpperCase() || 'INV';
  const year = new Date().getFullYear();
  const series = `${prefix}-${projectCode}-${year}-`;

  const existing = await prisma.invoice.findMany({
    where: {
      invoiceNumber: { startsWith: series },
    },
    select: { invoiceNumber: true },
  });

  let maxSeq = 0;
  for (const row of existing) {
    const tail = row.invoiceNumber.slice(series.length);
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
  }

  // Also cover collisions across renamed project codes by checking candidates globally
  for (let attempt = 1; attempt <= 50; attempt++) {
    const candidate = `${series}${String(maxSeq + attempt).padStart(4, '0')}`;
    const clash = await prisma.invoice.findUnique({
      where: { invoiceNumber: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }

  // Extremely unlikely fallback
  return `${series}${String(Date.now()).slice(-8)}`;
}

async function getProjectWorkspaceBankDetails(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      workspace: {
        select: {
          id: true,
          name: true,
          companyName: true,
          companyAddress: true,
          bankName: true,
          accountName: true,
          accountNumber: true,
          ifscCode: true,
          iban: true,
          swiftBic: true,
          upiId: true,
          branchName: true,
        },
      },
    },
  });

  return project?.workspace || null;
}

// Create invoice (manual) — super admin, workspace owner, project manager
router.post(
  '/',
  authenticate,
  authorize(...INVOICE_MANAGERS),
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
        saveBankDetailsToWorkspace = false,
        billingMonth,
      } = req.body;

      const workspace = await getProjectWorkspaceBankDetails(projectId);
      if (!workspace) {
        return res.status(404).json({ error: 'Project workspace not found' });
      }

      const bankDetails = mergeBankDetails(workspace, req.body);
      const invoiceNumber = await generateInvoiceNumber(projectId);
      const billingMonthValue = normalizeBillingMonth(billingMonth);

      if (saveBankDetailsToWorkspace && req.user?.role && ['SUPER_ADMIN', 'WORKSPACE_OWNER'].includes(req.user.role)) {
        const workspaceUpdate = pickBankDetails(req.body);
        if (Object.keys(workspaceUpdate).length > 0) {
          await prisma.workspace.update({
            where: { id: workspace.id },
            data: workspaceUpdate,
          });
        }
      }

      const invoice = await prisma.invoice.create({
        data: {
          projectId,
          createdById: req.userId!,
          invoiceNumber,
          dueDate: new Date(dueDate),
          billingMonth: billingMonthValue,
          currency,
          taxRate: parseFloat(taxRate),
          notes,
          clientName,
          clientEmail,
          clientAddress,
          ...bankDetails,
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

      // Unlock project invoices module so sidebar / clients can see it
      await prisma.project.update({
        where: { id: projectId },
        data: { invoicesEnabled: true },
      });

      const notifyResult = await notifyInvoiceClient({
        clientEmail: invoice.clientEmail,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        projectId: invoice.projectId,
        projectName: invoice.project?.name,
        billingMonth: invoice.billingMonth,
        io: req.app.get('io'),
      });
      await notifyInvoiceViewers({
        projectId: invoice.projectId,
        projectName: invoice.project?.name,
        title: 'New invoice available',
        message: `Invoice ${invoice.invoiceNumber} was generated for ${invoice.project?.name || 'your project'}.`,
        type: 'INVOICE_GENERATED',
        skipUserIds: notifyResult.userId ? [notifyResult.userId] : [],
        io: req.app.get('io'),
      });

      res.status(201).json({ invoice, notification: notifyResult });
    } catch (error: any) {
      console.error('Create invoice error:', error);
      if (error?.code === 'P2002') {
        return res.status(409).json({
          error: 'Invoice number conflict — please try again',
        });
      }
      res.status(500).json({ error: 'Failed to create invoice' });
    }
  }
);

// Create invoice from time entries
router.post(
  '/from-time-entries',
  authenticate,
  authorize(...INVOICE_MANAGERS),
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

      const {
        projectId,
        timeEntryIds,
        dueDate,
        currency = 'USD',
        taxRate = 0,
        clientName,
        clientEmail,
        clientAddress,
        notes,
        billingMonth,
      } = req.body;

      const workspace = await getProjectWorkspaceBankDetails(projectId);
      if (!workspace) {
        return res.status(404).json({ error: 'Project workspace not found' });
      }

      const bankDetails = mergeBankDetails(workspace, req.body);

      // Get time entries with user rates
      const entries = await prisma.timeEntry.findMany({
        where: {
          id: { in: timeEntryIds },
          projectId,
          isBillable: true,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      if (entries.length === 0) {
        return res.status(400).json({ error: 'No billable time entries found' });
      }

      // Group by user and calculate rates
      const items: any[] = [];
      const userGroups: Record<string, any> = {};

      for (const entry of entries) {
        const userId = entry.userId;
        if (!userGroups[userId]) {
          // Get hourly rate for user
          const rate = await prisma.hourlyRate.findFirst({
            where: {
              userId,
              projectId: projectId,
              effectiveFrom: { lte: entry.date },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: entry.date } },
              ],
            },
            orderBy: { effectiveFrom: 'desc' },
          });

          const defaultRate = rate?.rate || 50; // Default $50/hour

          userGroups[userId] = {
            user: entry.user,
            rate: defaultRate,
            hours: 0,
            entries: [],
          };
        }

        userGroups[userId].hours += entry.hours;
        userGroups[userId].entries.push(entry);
      }

      // Create invoice items
      Object.values(userGroups).forEach((group: any, index) => {
        items.push({
          description: `Development work by ${group.user.firstName} ${group.user.lastName}`,
          quantity: group.hours,
          unitPrice: group.rate,
          taxRate: 0,
          order: index,
        });
      });

      const invoiceNumber = await generateInvoiceNumber(projectId);
      const billingMonthValue = normalizeBillingMonth(billingMonth);

      const invoice = await prisma.invoice.create({
        data: {
          projectId,
          createdById: req.userId!,
          invoiceNumber,
          dueDate: new Date(dueDate),
          billingMonth: billingMonthValue,
          currency,
          taxRate: parseFloat(taxRate),
          clientName,
          clientEmail,
          clientAddress,
          notes,
          ...bankDetails,
          items: {
            create: items,
          },
        },
        include: {
          items: true,
          project: {
            select: { id: true, name: true },
          },
        },
      });

      await prisma.project.update({
        where: { id: projectId },
        data: { invoicesEnabled: true },
      });

      const notifyResult = await notifyInvoiceClient({
        clientEmail: invoice.clientEmail,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        projectId: invoice.projectId,
        projectName: invoice.project?.name,
        billingMonth: invoice.billingMonth,
        io: req.app.get('io'),
      });
      await notifyInvoiceViewers({
        projectId: invoice.projectId,
        projectName: invoice.project?.name,
        title: 'New invoice available',
        message: `Invoice ${invoice.invoiceNumber} was generated for ${invoice.project?.name || 'your project'}.`,
        type: 'INVOICE_GENERATED',
        skipUserIds: notifyResult.userId ? [notifyResult.userId] : [],
        io: req.app.get('io'),
      });

      res.status(201).json({ invoice, notification: notifyResult });
    } catch (error: any) {
      console.error('Create invoice from time entries error:', error);
      if (error?.code === 'P2002') {
        return res.status(409).json({
          error: 'Invoice number conflict — please try again',
        });
      }
      res.status(500).json({ error: 'Failed to create invoice' });
    }
  }
);

// Update invoice (managers: full edit; also used for bank fields)
router.patch(
  '/:id',
  authenticate,
  authorize(...INVOICE_MANAGERS),
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

      const updateData: any = {
        ...pickBankDetails(req.body),
      };
      if (req.body.status) updateData.status = req.body.status;
      if (req.body.dueDate) updateData.dueDate = new Date(req.body.dueDate);
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.clientName !== undefined) updateData.clientName = req.body.clientName;
      if (req.body.clientEmail !== undefined) updateData.clientEmail = req.body.clientEmail;
      if (req.body.clientAddress !== undefined) updateData.clientAddress = req.body.clientAddress;
      if (req.body.billingMonth !== undefined) {
        updateData.billingMonth = normalizeBillingMonth(req.body.billingMonth);
      }

      // Managers can also set payment/transaction fields
      if (req.body.paymentMethod !== undefined) updateData.paymentMethod = req.body.paymentMethod || null;
      if (req.body.transactionId !== undefined) updateData.transactionId = req.body.transactionId || null;
      if (req.body.transactionAmount !== undefined) {
        updateData.transactionAmount =
          req.body.transactionAmount === '' || req.body.transactionAmount === null
            ? null
            : parseFloat(req.body.transactionAmount);
      }
      if (req.body.transactionDate !== undefined) {
        updateData.transactionDate = req.body.transactionDate
          ? new Date(req.body.transactionDate)
          : null;
      }
      if (req.body.transactionNotes !== undefined) {
        updateData.transactionNotes = req.body.transactionNotes || null;
      }
      if (req.body.status === 'PAID' && !invoice.paidAt) {
        updateData.paidAt = new Date();
        updateData.paidById = req.userId!;
      }
      if (req.body.status && req.body.status !== 'PAID') {
        updateData.paidAt = null;
        updateData.paidById = null;
      }

      const updated = await prisma.invoice.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          items: {
            orderBy: { order: 'asc' },
          },
          paidBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
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

// Mark invoice paid / update transaction details (viewers + members + managers)
router.post(
  '/:id/payment',
  authenticate,
  authorize(...PAYMENT_ROLES),
  [
    body('status').optional().isIn(['SENT', 'PAID', 'OVERDUE']),
    body('paymentMethod').optional().isString(),
    body('transactionId').optional().isString(),
    body('transactionAmount').optional().isFloat({ min: 0 }),
    body('transactionDate').optional().isISO8601(),
    body('transactionNotes').optional().isString(),
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

      const role = req.user?.role;
      const isManager = role && INVOICE_MANAGERS.includes(role as any);
      // Viewers / members can only submit payment details or mark PAID (not cancel/draft edits)
      const nextStatus = req.body.status || 'PAID';
      if (!isManager && !['PAID', 'SENT', 'OVERDUE'].includes(nextStatus)) {
        return res.status(403).json({ error: 'Viewers can only update payment-related statuses' });
      }

      const updateData: any = {
        status: nextStatus,
        paymentMethod: req.body.paymentMethod !== undefined ? req.body.paymentMethod || null : invoice.paymentMethod,
        transactionId: req.body.transactionId !== undefined ? req.body.transactionId || null : invoice.transactionId,
        transactionNotes:
          req.body.transactionNotes !== undefined
            ? req.body.transactionNotes || null
            : invoice.transactionNotes,
      };

      if (req.body.transactionAmount !== undefined) {
        updateData.transactionAmount =
          req.body.transactionAmount === '' || req.body.transactionAmount === null
            ? null
            : parseFloat(req.body.transactionAmount);
      }
      if (req.body.transactionDate !== undefined) {
        updateData.transactionDate = req.body.transactionDate
          ? new Date(req.body.transactionDate)
          : null;
      }

      if (nextStatus === 'PAID') {
        updateData.paidAt = new Date();
        updateData.paidById = req.userId!;
      }

      const updated = await prisma.invoice.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          items: { orderBy: { order: 'asc' } },
          project: {
            select: {
              id: true,
              name: true,
              workspace: { select: { id: true, name: true } },
            },
          },
          paidBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      res.json({ invoice: updated });
    } catch (error) {
      console.error('Record invoice payment error:', error);
      res.status(500).json({ error: 'Failed to record payment' });
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
                companyName: true,
                companyAddress: true,
                bankName: true,
                accountName: true,
                accountNumber: true,
                ifscCode: true,
                iban: true,
                swiftBic: true,
                upiId: true,
                branchName: true,
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

    const access = await assertInvoiceModuleAccess(invoice.projectId, req.userId, req.user?.role);
    if ('error' in access) {
      return res.status(access.status).json({ error: access.error });
    }

    const companyName =
      invoice.companyName || invoice.project.workspace.companyName || invoice.project.workspace.name;
    const companyAddress = invoice.companyAddress || invoice.project.workspace.companyAddress;
    const bankDetails = {
      bankName: invoice.bankName || invoice.project.workspace.bankName,
      accountName: invoice.accountName || invoice.project.workspace.accountName,
      accountNumber: invoice.accountNumber || invoice.project.workspace.accountNumber,
      ifscCode: invoice.ifscCode || invoice.project.workspace.ifscCode,
      iban: invoice.iban || invoice.project.workspace.iban,
      swiftBic: invoice.swiftBic || invoice.project.workspace.swiftBic,
      upiId: invoice.upiId || invoice.project.workspace.upiId,
      branchName: invoice.branchName || invoice.project.workspace.branchName,
    };

    const BRAND = "Pritul's workspace";
    const ACCENT = '#0ea5e9';
    const INK = '#0f172a';
    const MUTED = '#64748b';

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);

    doc.pipe(res);

    // Brand banner
    doc.rect(0, 0, doc.page.width, 56).fill(ACCENT);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16);
    doc.text(BRAND, 50, 20, { continued: false });
    doc.font('Helvetica').fontSize(9).fillColor('#e0f2fe');
    doc.text('Professional project invoices', 50, 38);

    doc.fillColor(INK);
    let y = 76;

    // Company + Invoice meta
    doc.font('Helvetica-Bold').fontSize(14).text(companyName, 50, y, { width: 280 });
    y += 18;
    if (companyAddress) {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(companyAddress, 50, y, { width: 280 });
      doc.fillColor(INK);
      y += doc.heightOfString(companyAddress, { width: 280 }) + 6;
    }

    doc.font('Helvetica-Bold').fontSize(22).fillColor(ACCENT).text('INVOICE', 320, 76, {
      width: 230,
      align: 'right',
    });
    doc.fillColor(INK).font('Helvetica').fontSize(10);
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 320, 104, { width: 230, align: 'right' });
    doc.text(`Date: ${new Date(invoice.issueDate).toLocaleDateString()}`, 320, 118, {
      width: 230,
      align: 'right',
    });
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 320, 132, {
      width: 230,
      align: 'right',
    });
    const billMonthLabel = formatBillingMonth(invoice.billingMonth);
    let metaY = 146;
    if (billMonthLabel) {
      doc.text(`Billing Month: ${billMonthLabel}`, 320, metaY, { width: 230, align: 'right' });
      metaY += 14;
    }
    doc.text(`Project: ${invoice.project.name}`, 320, metaY, { width: 230, align: 'right' });
    doc.text(`Issued via ${BRAND}`, 320, metaY + 14, { width: 230, align: 'right' });

    y = Math.max(y, 180);
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    y += 16;

    // Client info
    if (invoice.clientName) {
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('BILL TO', 50, y);
      y += 14;
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(invoice.clientName, 50, y);
      y += 14;
      doc.font('Helvetica').fontSize(10);
      if (invoice.clientEmail) {
        doc.text(invoice.clientEmail, 50, y);
        y += 13;
      }
      if (invoice.clientAddress) {
        doc.fillColor(MUTED).text(invoice.clientAddress, 50, y, { width: 280 });
        doc.fillColor(INK);
        y += doc.heightOfString(invoice.clientAddress, { width: 280 }) + 8;
      }
      y += 8;
    }

    // Items table
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('Items', 50, y);
    y += 16;

    // Table header bar
    doc.rect(50, y, 495, 22).fill('#f1f5f9');
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9);
    doc.text('Description', 58, y + 6, { width: 250 });
    doc.text('Qty', 320, y + 6, { width: 40 });
    doc.text('Price', 370, y + 6, { width: 70 });
    doc.text('Total', 450, y + 6, { width: 85 });
    y += 28;

    doc.font('Helvetica').fontSize(10);
    let subtotal = 0;
    invoice.items.forEach((item, idx) => {
      const total = item.quantity * item.unitPrice;
      subtotal += total;
      if (idx % 2 === 1) {
        doc.rect(50, y - 4, 495, 26).fill('#f8fafc');
      }
      doc.fillColor(INK);
      doc.text(item.description, 58, y, { width: 250 });
      doc.text(String(item.quantity), 320, y, { width: 40 });
      doc.text(`${invoice.currency} ${item.unitPrice.toFixed(2)}`, 370, y, { width: 70 });
      doc.text(`${invoice.currency} ${total.toFixed(2)}`, 450, y, { width: 85 });
      y += 26;
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
    });

    y += 8;
    doc.moveTo(320, y).lineTo(545, y).strokeColor('#cbd5e1').stroke();
    y += 12;
    const tax = subtotal * (invoice.taxRate / 100);
    const total = subtotal + tax;

    doc.fillColor(INK).font('Helvetica').fontSize(10);
    doc.text('Subtotal:', 370, y);
    doc.text(`${invoice.currency} ${subtotal.toFixed(2)}`, 450, y);
    y += 16;

    if (invoice.taxRate > 0) {
      doc.text(`Tax (${invoice.taxRate}%):`, 370, y);
      doc.text(`${invoice.currency} ${tax.toFixed(2)}`, 450, y);
      y += 16;
    }

    doc.rect(360, y - 2, 185, 24).fill(ACCENT);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11);
    doc.text('Total:', 370, y + 5);
    doc.text(`${invoice.currency} ${total.toFixed(2)}`, 450, y + 5);
    y += 36;

    // Bank / payment details
    if (hasAnyBankDetails(bankDetails)) {
      if (y > 620) {
        doc.addPage();
        y = 50;
      }
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text('Bank / Payment Details', 50, y);
      y += 16;
      doc.font('Helvetica').fontSize(10);

      const bankLines: Array<[string, string | null | undefined]> = [
        ['Bank Name', bankDetails.bankName],
        ['Account Name', bankDetails.accountName],
        ['Account Number', bankDetails.accountNumber],
        ['IFSC Code', bankDetails.ifscCode],
        ['Branch', bankDetails.branchName],
        ['IBAN', bankDetails.iban],
        ['SWIFT / BIC', bankDetails.swiftBic],
        ['UPI ID', bankDetails.upiId],
      ];

      for (const [label, value] of bankLines) {
        if (value) {
          doc.fillColor(MUTED).text(`${label}:`, 50, y, { continued: true });
          doc.fillColor(INK).text(` ${value}`);
          y += 14;
        }
      }
    }

    // Notes
    if (invoice.notes) {
      y += 18;
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text('Notes', 50, y);
      doc.font('Helvetica').fillColor(MUTED).text(invoice.notes, 50, y + 14, { width: 495 });
    }

    // Footer brand
    const footerY = doc.page.height - 40;
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `${BRAND}  ·  Unique invoice  ·  ${invoice.invoiceNumber}`,
        50,
        footerY,
        { width: 495, align: 'center' }
      );

    doc.end();
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Delete invoice
router.delete(
  '/:id',
  authenticate,
  authorize(...INVOICE_MANAGERS),
  async (req: AuthRequest, res) => {
    try {
      await prisma.invoice.delete({
        where: { id: req.params.id },
      });

      res.json({ message: 'Invoice deleted' });
    } catch (error) {
      console.error('Delete invoice error:', error);
      res.status(500).json({ error: 'Failed to delete invoice' });
    }
  }
);

export default router;
