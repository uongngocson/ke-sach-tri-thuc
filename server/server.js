import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import apiRoutes from './routes/api.routes.js';
import adminRoutes from './routes/admin.routes.js';
import testerRoutes from './routes/tester.routes.js';
import socketService from './services/socket.service.js';
import { errorHandler } from './middlewares/errorHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 1. Security & Permissive CORS for Local / Network Dev
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false
}));

const corsOptions = {
  origin: true, // Allow all origins (localhost, 127.0.0.1, LAN IP)
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'Accept', 'X-Requested-With', 'user-fingerprint'],
  exposedHeaders: ['Idempotency-Key'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 2. Rate Limiting (High threshold for local testing)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'TOO_MANY_REQUESTS', message: 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.' }
});
app.use('/api/', globalLimiter);

// 3. Static Admin & Public Client Servicing
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// 4. API Routes
app.use('/api/v1', apiRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/tester', testerRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Cáo Sách Backend API', timestamp: new Date().toISOString() });
});

// 5. Centralized Error Handler
app.use(errorHandler);

// 6. Socket.io Realtime Attachment
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS']
  }
});
socketService.init(io);

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Cáo Sách Backend Server running on http://0.0.0.0:${PORT}`);
    console.log(`👑 Admin Portal: http://localhost:${PORT}/admin`);
    console.log(`🔌 Socket.io Realtime Engine Ready`);
  });
}

export { app, server };
