import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import HealthCheckRouter from './http/routes/health.routes.js';
import AuthRouter from './http/routes/auth.routes.js';
import { requireAuth } from './http/middleware/auth.middleware.js';
import { meHandler } from './modules/auth/auth.handlers.js';
import BusinessRouter from './http/routes/business.routes.js';

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

app.use('/api/v1/health', HealthCheckRouter);
app.use('/api/v1/auth', AuthRouter);
app.get('/api/v1/me', requireAuth, meHandler);
app.use('/api/v1/businesses', BusinessRouter);

const host = process.env.API_HOST ?? '0.0.0.0';
const port = Number(process.env.API_PORT);

app.listen(port, host, () => {
  process.stdout.write(`API listening on http://${host}:${port}\n`);
});
