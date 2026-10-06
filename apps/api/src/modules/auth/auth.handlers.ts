import type { Request, Response } from 'express';
import { AuthError, type LoginInput, type RegisterInput } from './auth.js';
import { accessTokenCookieName, getUser, login, register } from './auth.service.js';

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
  if (input.phone !== undefined && (!stringField(input.phone) || input.phone.length > 30))
    return null;
  return {
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
  };
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

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const input = registerInput(req.body);
  if (!input) {
    sendError(req, res, new AuthError('VALIDATION_ERROR', 'Invalid registration details', 400));
    return;
  }
  try {
    res.status(201).json({ data: await register(input) });
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
