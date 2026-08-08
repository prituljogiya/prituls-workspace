import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import workspaceRoutes from './routes/workspaces';
import projectRoutes from './routes/projects';
import boardRoutes from './routes/boards';
import taskRoutes from './routes/tasks';
import sprintRoutes from './routes/sprints';
import dashboardRoutes from './routes/dashboard';
import reportRoutes from './routes/reports';
import timeTrackingRoutes from './routes/timeTracking';
import invoiceRoutes from './routes/invoices';
import aiRoutes from './routes/ai';
import searchRoutes from './routes/search';
import taskTemplateRoutes from './routes/taskTemplates';
import documentRoutes from './routes/documents';
import notificationRoutes from './routes/notifications';
import settingsRoutes from './routes/settings';
import contractRoutes from './routes/contracts';

dotenv.config();

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/time-tracking', timeTrackingRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/task-templates', taskTemplateRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/contracts', contractRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    path: req.path,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
