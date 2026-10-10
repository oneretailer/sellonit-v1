import type { NextFunction, Request, Response } from 'express';
import { AuthError } from '../../modules/auth/auth.js';
import { accessTokenCookieName, getSessionUserId } from '../../modules/auth/auth.service.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

function cookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator === -1 || cookie.slice(0, separator).trim() !== name) continue;

    const value = cookie.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cookieToken = cookieValue(req.header('cookie'), accessTokenCookieName);
  const authorization = req.header('authorization');
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  const token = cookieToken ?? match?.[1];

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.header('x-request-id') ?? crypto.randomUUID(),
      },
    });
    return;
  }

  try {
    req.userId = await getSessionUserId(token);
    next();
  } catch (error) {
    const authError =
      error instanceof AuthError
        ? error
        : new AuthError('UNAUTHORIZED', 'Authentication required', 401);
    res.status(authError.statusCode).json({
      error: {
        code: authError.code,
        message: authError.message,
        requestId: req.header('x-request-id') ?? crypto.randomUUID(),
      },
    });
  }
}
