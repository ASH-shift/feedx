import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import postsRoutes from './routes/posts';
import feedRoutes from './routes/feed';
import usersRoutes from './routes/users';

const app: Application = express();

// ======================= Middleware =======================

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[API Gateway] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ======================= Health Check =======================

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ======================= Routes =======================

app.use('/auth', authRoutes);
app.use('/posts', postsRoutes);
app.use('/feed', feedRoutes);
app.use('/users', usersRoutes);

// ======================= 404 Handler =======================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
});

// ======================= Global Error Handler =======================

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Gateway] Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ======================= Server Startup =======================

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API Gateway] HTTP server listening on port ${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('[API Gateway] Shutting down...');
  server.close((err) => {
    if (err) {
      console.error('[API Gateway] Error closing server:', err);
      process.exit(1);
    }
    console.log('[API Gateway] Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
