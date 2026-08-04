import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';

const PORT = process.env.PORT || 5001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Local / traditional Node hosting — Socket.io + listen
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join:project', (projectId: string) => {
    socket.join(`project:${projectId}`);
  });

  socket.on('leave:project', (projectId: string) => {
    socket.leave(`project:${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.set('io', io);

if (!process.env.VERCEL) {
  httpServer
    .listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    })
    .on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        process.exit(1);
      }
      console.error('❌ Server error:', err);
      process.exit(1);
    });
}

export { io };
export default app;
