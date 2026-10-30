import type { Request, Response } from 'express';
import {
  AuthError,
  type BusinessType,
  type LoginInput,
  type RegisterInput,
  type UpdatePhoneInput,
} from './auth.js';
import {
  accessTokenCookieName,
  getUser,
  login,
  register,
  updatePhone,
  sendPhoneVerification,
  verifyEmailAndCreateSession,
  verifyToken,
  setBusinessIntent,
  requestPasswordReset,
  verifyPasswordResetCode,
  resetPassword,
} from './auth.service.js';

type ApiErrorResponse = {
  error: { code: string; message: string; requestId: string };
};

type ApiUserResponse = { data: Awaited<ReturnType<typeof getUser>> };

function requestId(req: Request): string {
  return req.header('x-request-id') ?? crypto.randomUUID();
}

function sendError(req: Request, res: Response, error: unknown): void {
  const id = requestId(req);
  const authError = toAuthError(error);
  if (!(error instanceof AuthError)) {
    const details = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[auth] requestId=${id} code=${authError.code} cause=${details}`);
  }
  const body: ApiErrorResponse = {
    error: { code: authError.code, message: authError.message, requestId: id },
  };
  res.status(authError.statusCode).json(body);
}

function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  const candidate = error as { code?: unknown; message?: unknown };
  const message = typeof candidate?.message === 'string' ? candidate.message : '';
  // This usually means the PASSWORD_RESET enum migration was not deployed.
  if (
    candidate?.code === 'P2023' ||
    message.includes('PASSWORD_RESET') ||
    message.includes('VerificationType')
  ) {
    return new AuthError(
      'DATABASE_MIGRATION_REQUIRED',
      'Password reset is temporarily unavailable because the database is not up to date',
      503,
    );
  }
  if (message.startsWith('Resend email delivery failed:')) {
    return new AuthError(
      'EMAIL_DELIVERY_FAILED',
      'We could not send the password reset email. Check the email provider configuration.',
      502,
    );
  }
  return new AuthError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
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

function businessTypeField(value: unknown): value is BusinessType {
  return value === 'RETAILER' || value === 'ENTREPRENEUR' || value === 'ENTERPRISE';
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

export async function setBusinessIntentHandler(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    sendError(req, res, new AuthError('UNAUTHORIZED', 'Authentication required', 401));
    return;
  }

  const businessType = bodyField(req, 'businessType');
  if (!businessTypeField(businessType)) {
    sendError(
      req,
      res,
      new AuthError(
        'VALIDATION_ERROR',
        'Business type must be RETAILER, ENTREPRENEUR, or ENTERPRISE',
        400,
      ),
    );
    return;
  }

  try {
    res.status(200).json({ data: await setBusinessIntent(req.userId, businessType) });
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

export async function forgotPasswordHandler(req: Request, res: Response): Promise<void> {
  try {
    const email = bodyField(req, 'email');
    if (!stringField(email) || !emailField(email))
      throw new AuthError('VALIDATION_ERROR', 'A valid email is required', 400);
    await requestPasswordReset(email);
    res.status(202).json({ data: { sent: true } });
  } catch (error) {
    sendError(req, res, error);
  }
}

export async function verifyPasswordResetCodeHandler(req: Request, res: Response): Promise<void> {
  try {
    const email = bodyField(req, 'identifier') ?? bodyField(req, 'email');
    const code = bodyField(req, 'code');
    if (!stringField(email) || !emailField(email) || !stringField(code) || !/^\d{6}$/.test(code))
      throw new AuthError('INVALID_CODE', 'The verification code is invalid or expired', 400);
    await verifyPasswordResetCode(email, code);
    res.json({ data: { verified: true } });
  } catch (error) {
    sendError(req, res, error);
  }
}

export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  try {
    const email = bodyField(req, 'email');
    const code = bodyField(req, 'code');
    const password = bodyField(req, 'password');
    if (
      !stringField(email) ||
      !emailField(email) ||
      !stringField(code) ||
      !/^\d{6}$/.test(code) ||
      !stringField(password) ||
      password.length < 8 ||
      password.length > 128
    ) {
      throw new AuthError(
        'VALIDATION_ERROR',
        'Enter a valid email, 6-digit OTP, and password between 8 and 128 characters',
        400,
      );
    }
    await resetPassword(email, code, password);
    res.status(200).json({ data: { message: 'Password reset successfully' } });
  } catch (error) {
    sendError(req, res, error);
  }
}
