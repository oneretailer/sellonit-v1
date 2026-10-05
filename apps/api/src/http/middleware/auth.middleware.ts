import type { NextFunction, Request, Response } from 'express';
import { AuthError } from '../../modules/auth/auth.js';
import { accessTokenCookieName, verifyAccessToken } from '../../modules/auth/auth.service.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const cookieToken = req.cookies?.[accessTokenCookieName];
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
    req.userId = verifyAccessToken(token);
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
