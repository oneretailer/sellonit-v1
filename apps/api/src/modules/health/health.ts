import type { Request, Response } from 'express';

type HealthStatus = 'ok' | 'unavailable';
type ApiStatus = 'service unavailable' | 'api is ready';

interface HealthResponse {
  status: HealthStatus | ApiStatus;
}

export const liveCheck = (
  _req: Request,
  res: Response<HealthResponse>,
): Response<HealthResponse> => {
  return res.status(200).json({ status: 'ok' });
};

export const readinessCheck = (
  _req: Request,
  res: Response<HealthResponse>,
): Response<HealthResponse> => {
  // TODO: check dependencies (db, redis) once they exist.
  // Make this async again when you add awaited calls.
  return res.status(200).json({ status: 'api is ready' });
};
