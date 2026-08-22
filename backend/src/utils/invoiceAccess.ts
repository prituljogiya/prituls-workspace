import { prisma } from './prisma';

const SCHEDULE_KEY = 'invoice_schedules';

export type InvoiceSchedule = {
  visibleFrom: string | null;
  notifyDay: number | null;
  lastNotifiedMonth: string | null;
};

type ScheduleMap = Record<string, InvoiceSchedule>;

type SocketIo = {
  to: (room: string) => { emit: (event: string, payload: unknown) => void };
} | null;

function emptySchedule(): InvoiceSchedule {
  return { visibleFrom: null, notifyDay: null, lastNotifiedMonth: null };
}

export async function getInvoiceSchedules(): Promise<ScheduleMap> {
  const row = await prisma.appSetting.findUnique({ where: { key: SCHEDULE_KEY } });
  if (!row) return {};
  try {
    return JSON.parse(row.value) as ScheduleMap;
  } catch {
    return {};
  }
}

export async function getProjectInvoiceSchedule(projectId: string): Promise<InvoiceSchedule> {
  const all = await getInvoiceSchedules();
  return all[projectId] || emptySchedule();
}

export async function saveProjectInvoiceSchedule(projectId: string, patch: Partial<InvoiceSchedule>) {
  const all = await getInvoiceSchedules();
  all[projectId] = { ...emptySchedule(), ...all[projectId], ...patch };
  await prisma.appSetting.upsert({
    where: { key: SCHEDULE_KEY },
    create: { key: SCHEDULE_KEY, value: JSON.stringify(all) },
    update: { value: JSON.stringify(all) },
  });
  return all[projectId];
}

export function isInvoiceModuleVisible(opts: {
  role?: string | null;
  invoicesEnabled: boolean;
  visibleFrom: Date | string | null | undefined;
  now?: Date;
}): boolean {
  if (opts.role === 'SUPER_ADMIN' || opts.role === 'WORKSPACE_OWNER' || opts.role === 'PROJECT_MANAGER') {
    return true;
  }
  if (!opts.invoicesEnabled) return false;
  if (!opts.visibleFrom) return true;
  const from = new Date(opts.visibleFrom);
  if (Number.isNaN(from.getTime())) return true;
  return (opts.now || new Date()) >= from;
}

export async function notifyInvoiceViewers(opts: {
  projectId: string;
  projectName?: string;
  title: string;
  message: string;
  type?: string;
  extraUserIds?: string[];
  skipUserIds?: string[];
  io?: SocketIo;
}) {
  const members = await prisma.projectMember.findMany({
    where: { projectId: opts.projectId, role: 'VIEWER' },
    select: { userId: true },
  });
  const skip = new Set(opts.skipUserIds || []);
  const userIds = [...new Set([...members.map((m) => m.userId), ...(opts.extraUserIds || [])])].filter(
    (id) => !skip.has(id)
  );
  if (userIds.length === 0) return;

  const type = opts.type || 'INVOICE_GENERATED';
  const link = `/projects/${opts.projectId}/invoices`;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      title: opts.title,
      message: opts.message,
      link,
    })),
  });

  userIds.forEach((userId) => {
    try {
      opts.io?.to(`user:${userId}`).emit('notification:new', {
        type,
        title: opts.title,
        message: opts.message,
        link,
      });
    } catch {
      /* socket optional */
    }
  });
}

export async function maybeNotifyInvoiceSchedule(
  project: {
    id: string;
    name: string;
    invoicesEnabled: boolean;
  },
  io?: SocketIo
) {
  if (!project.invoicesEnabled) return;
  const schedule = await getProjectInvoiceSchedule(project.id);
  const now = new Date();
  if (!isInvoiceModuleVisible({ invoicesEnabled: true, visibleFrom: schedule.visibleFrom, now })) return;

  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  if (schedule.lastNotifiedMonth === monthKey) return;

  let shouldNotify = false;
  if (schedule.visibleFrom) {
    const from = new Date(schedule.visibleFrom);
    if (!Number.isNaN(from.getTime()) && now >= from && now.getTime() - from.getTime() < 24 * 60 * 60 * 1000) {
      shouldNotify = true;
    }
  }
  if (schedule.notifyDay) {
    const day = Math.min(28, Math.max(1, schedule.notifyDay));
    if (now.getUTCDate() >= day) shouldNotify = true;
  }
  if (!shouldNotify) return;

  await notifyInvoiceViewers({
    projectId: project.id,
    projectName: project.name,
    title: 'Invoices are ready',
    message: `You can view invoices for ${project.name}.`,
    type: 'INVOICE_AVAILABLE',
    io,
  });
  await saveProjectInvoiceSchedule(project.id, { lastNotifiedMonth: monthKey });
}

export async function notifyIfInvoiceModuleOpened(opts: {
  projectId: string;
  projectName: string;
  invoicesEnabled: boolean;
  visibleFrom: string | null;
  io?: SocketIo;
}) {
  if (
    !isInvoiceModuleVisible({
      invoicesEnabled: opts.invoicesEnabled,
      visibleFrom: opts.visibleFrom,
      role: 'VIEWER',
    })
  ) {
    return;
  }
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const schedule = await getProjectInvoiceSchedule(opts.projectId);
  if (schedule.lastNotifiedMonth === monthKey) return;

  await notifyInvoiceViewers({
    projectId: opts.projectId,
    projectName: opts.projectName,
    title: 'Invoices are ready',
    message: `You can view invoices for ${opts.projectName}.`,
    type: 'INVOICE_AVAILABLE',
    io: opts.io,
  });
  await saveProjectInvoiceSchedule(opts.projectId, { lastNotifiedMonth: monthKey });
}
