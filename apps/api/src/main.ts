// API entry point. Starts an empty Express server; no routes are defined yet.
import express from 'express';
import HealthCheckRouter from './http/routes/health.routes.js';

const host = process.env.API_HOST ?? '0.0.0.0';
const port = Number(process.env.API_PORT ?? 4000);

const app = express();

app.use('/api/v1/health', HealthCheckRouter);

app.listen(port, host, () => {
  process.stdout.write(`API listening on http://${host}:${port}\n`);
});
