import type { Request, Response } from 'express';
type HealthStatus = 'ok' | 'unavailable';
type ApiStatus = 'service unavailable' | 'api is ready';

interface HealthResponse {
  status: HealthStatus | ApiStatus;
}

export const liveCheck = async (
  _req: Request,
  res: Response,
): Promise<Response<HealthResponse>> => {
  try {
    // Example:
    // await database.query('SELECT 1');
    // await redis.ping();

    return res.status(200).json({ status: 'ok' });
  } catch {
    return res.status(503).json({ status: 'unavailable' });
  }
};

export const readinessCheck = async (
  _req: Request,
  res: Response,
): Promise<Response<HealthResponse>> => {
  try {
    //check if api dependencies are ready
    return res.status(200).json({ status: 'api is ready' });
  } catch {
    return res.status(503).json({ status: 'service unavailable' });
  }
};
