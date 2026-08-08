import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
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
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
});

const PORT = process.env.PORT || 5001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler (must be before error handler)
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Global error handler (must be last)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Unhandled error:', err);
  console.error('Error path:', req.method, req.path);
  console.error('Error message:', err.message);
  console.error('Stack:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    path: req.path,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join:project', (projectId: string) => {
    socket.join(`project:${projectId}`);
  });

  socket.on('leave:project', (projectId: string) => {
    socket.leave(`project:${projectId}`);
  });

  socket.on('join:user', (userId: string) => {
    socket.join(`user:${userId}`);
  });

  socket.on('leave:user', (userId: string) => {
    socket.leave(`user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please free the port or change PORT in .env`);
    console.log(`💡 To kill process on port ${PORT}, run: lsof -ti:${PORT} | xargs kill -9`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

export { io };

