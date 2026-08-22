import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  meta?: Record<string, unknown> | null;
};

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link || null,
      meta:
        input.meta == null
          ? undefined
          : (input.meta as Prisma.InputJsonValue),
    },
  });
}

/** Notify portal user matching clientEmail (case-insensitive). */
export async function notifyInvoiceClient(opts: {
  clientEmail?: string | null;
  invoiceId: string;
  invoiceNumber: string;
  projectId: string;
  projectName?: string;
  billingMonth?: string | null;
  io?: { to: (room: string) => { emit: (event: string, payload: unknown) => void } } | null;
}) {
  const email = opts.clientEmail?.trim().toLowerCase();
  if (!email) {
    return { notified: false, reason: 'no_client_email' as const };
  }

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      isActive: true,
    },
    select: { id: true, email: true },
  });

  if (!user) {
    return { notified: false, reason: 'no_matching_user' as const };
  }

  const projectLabel = opts.projectName || 'your project';
  const link = `/projects/${opts.projectId}/invoices`;
  let monthLabel: string | null = null;
  if (opts.billingMonth && /^\d{4}-\d{2}$/.test(opts.billingMonth)) {
    const [y, m] = opts.billingMonth.split('-').map(Number);
    monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  const message = monthLabel
    ? `Invoice ${opts.invoiceNumber} for ${monthLabel} was generated for ${projectLabel}.`
    : `Invoice ${opts.invoiceNumber} was generated for ${projectLabel}.`;

  const notification = await createNotification({
    userId: user.id,
    type: 'INVOICE_GENERATED',
    title: 'New invoice available',
    message,
    link,
    meta: {
      invoiceId: opts.invoiceId,
      invoiceNumber: opts.invoiceNumber,
      projectId: opts.projectId,
      billingMonth: opts.billingMonth || null,
    },
  });

  try {
    opts.io?.to(`user:${user.id}`).emit('notification:new', notification);
  } catch {
    /* socket optional */
  }

  return { notified: true as const, userId: user.id, notification };
}
