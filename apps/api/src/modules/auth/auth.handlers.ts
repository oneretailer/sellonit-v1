import type { Request, Response } from 'express';
import { AuthError, type LoginInput, type RegisterInput, type UpdatePhoneInput } from './auth.js';
import {
  accessTokenCookieName,
  getUser,
  login,
  register,
  updatePhone,
  sendPhoneVerification,
  verifyEmailAndCreateSession,
  verifyToken,
} from './auth.service.js';

type ApiErrorResponse = {
  error: { code: string; message: string; requestId: string };
};

type ApiUserResponse = { data: Awaited<ReturnType<typeof getUser>> };

function requestId(req: Request): string {
  return req.header('x-request-id') ?? crypto.randomUUID();
}

function sendError(req: Request, res: Response, error: unknown): void {
  const authError =
    error instanceof AuthError
      ? error
      : new AuthError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  const body: ApiErrorResponse = {
    error: { code: authError.code, message: authError.message, requestId: requestId(req) },
  };
  res.status(authError.statusCode).json(body);
}

function stringField(value: unknown): value is string {
  return typeof value === 'string';
}

function emailField(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function registerInput(body: unknown): RegisterInput | null {
  if (!body || typeof body !== 'object') return null;
  const input = body as Record<string, unknown>;
  if (
    !stringField(input.email) ||
    !stringField(input.password) ||
    !stringField(input.firstName) ||
    !stringField(input.lastName)
  )
    return null;
  if (!emailField(input.email)) return null;
  if (input.password.length < 8 || input.password.length > 128) return null;
  if (input.firstName.trim().length < 1 || input.firstName.trim().length > 80) return null;
  if (input.lastName.trim().length < 1 || input.lastName.trim().length > 80) return null;
  return {
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
  };
}

function updatePhoneInput(body: unknown): UpdatePhoneInput | null {
  if (!body || typeof body !== 'object') return null;
  const input = body as Record<string, unknown>;
  if (!stringField(input.phone) || input.phone.length > 30) return null;
  return { phone: input.phone };
}

function loginInput(body: unknown): LoginInput | null {
  if (!body || typeof body !== 'object') return null;
  const input = body as Record<string, unknown>;
  if (
    !stringField(input.email) ||
    !stringField(input.password) ||
    !emailField(input.email) ||
    input.password.length === 0
  )
    return null;
  return { email: input.email, password: input.password };
}

function bodyField(req: Request, key: string): unknown {
  if (!req.body || typeof req.body !== 'object') return undefined;
  return (req.body as Record<string, unknown>)[key];
}

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const input = registerInput(req.body);
  if (!input) {
    sendError(req, res, new AuthError('VALIDATION_ERROR', 'Invalid registration details', 400));
    return;
  }
  try {
    const result = await register(input);
    res.status(201).json({
      data: result.user,
      ...(result.emailVerificationToken
        ? { emailVerificationToken: result.emailVerificationToken }
        : {}),
    });
  } catch (error) {
    sendError(req, res, error);
  }
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const input = loginInput(req.body);
  if (!input) {
    sendError(req, res, new AuthError('VALIDATION_ERROR', 'Email and password are required', 400));
    return;
  }
  try {
    const { user, accessToken, expiresIn } = await login(input);
    res.cookie(accessTokenCookieName, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: expiresIn * 1000,
      path: '/',
    });
    res.status(200).json({ user, expiresIn });
  } catch (error) {
    sendError(req, res, error);
  }
}

export async function meHandler(
  req: Request,
  res: Response<ApiUserResponse | ApiErrorResponse>,
): Promise<void> {
  if (!req.userId) {
    sendError(req, res, new AuthError('UNAUTHORIZED', 'Authentication required', 401));
    return;
  }

  try {
    res.status(200).json({ data: await getUser(req.userId) });
  } catch (error) {
    sendError(req, res, error);
  }
}

export async function updatePhoneHandler(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    sendError(req, res, new AuthError('UNAUTHORIZED', 'Authentication required', 401));
    return;
  }
  const input = updatePhoneInput(req.body);
  if (!input) {
    sendError(req, res, new AuthError('VALIDATION_ERROR', 'A valid phone number is required', 400));
    return;
  }
  try {
    res.status(200).json({ data: await updatePhone(req.userId, input.phone) });
  } catch (error) {
    sendError(req, res, error);
  }
}

export async function verifyEmailAndLoginHandler(req: Request, res: Response): Promise<void> {
  try {
    const requestToken = req.params.token ?? req.query.token ?? bodyField(req, 'token');
    if (!stringField(requestToken)) {
      throw new AuthError('VALIDATION_ERROR', 'Token is required', 400);
    }

    const { user, accessToken, expiresIn } = await verifyEmailAndCreateSession(requestToken);
    res.cookie(accessTokenCookieName, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: expiresIn * 1000,
      path: '/',
    });
    res.status(200).json({ user, expiresIn });
  } catch (error) {
    sendError(req, res, error);
  }
}

export async function verifyEmailHandler(req: Request, res: Response): Promise<void> {
  try {
    const requestToken = req.params.token ?? req.query.token ?? bodyField(req, 'token');
    if (!stringField(requestToken)) {
      throw new AuthError('VALIDATION_ERROR', 'Token is required', 400);
    }
    await verifyToken('EMAIL', requestToken);
    res.json({ data: { verified: true } });
  } catch (error) {
    sendError(req, res, error);
  }
}

export async function verifyPhoneHandler(req: Request, res: Response): Promise<void> {
  try {
    const requestToken = bodyField(req, 'token');
    if (!stringField(requestToken)) {
      throw new AuthError('VALIDATION_ERROR', 'Token is required', 400);
    }
    await verifyToken('PHONE', requestToken);
    res.json({ data: { verified: true } });
  } catch (error) {
    sendError(req, res, error);
  }
}

export async function sendPhoneVerificationHandler(req: Request, res: Response): Promise<void> {
  try {
    const email = bodyField(req, 'email');
    if (!stringField(email) || !emailField(email)) {
      throw new AuthError('VALIDATION_ERROR', 'A valid email is required', 400);
    }
    await sendPhoneVerification(email);
    res.json({ data: { sent: true } });
  } catch (error) {
    sendError(req, res, error);
  }
}
