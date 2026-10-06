import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../infrastructure/db.js';
import { AuthError, type LoginInput, type PublicUser, type RegisterInput } from './auth.js';
function requiredJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required. Check the repository root .env file.');
  }
  return secret;
}

const jwtSecret = requiredJwtSecret();
const accessTokenLifetime = 15 * 60;
export const accessTokenCookieName = 'sellonit_access_token';

const publicUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function publicUser(user: PublicUser): PublicUser {
  return user;
}

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, jwtSecret, { expiresIn: accessTokenLifetime });
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function register(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    throw new AuthError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists', 409);

  const passwordHash = await bcrypt.hash(input.password, 12);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        passwordHash,
      },
      select: publicUserSelect,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AuthError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists', 409);
    }
    throw error;
  }

  return publicUser(user);
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(input.email) } });
  const valid = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !valid)
    throw new AuthError('INVALID_CREDENTIALS', 'Email or password is incorrect', 401);
  if (user.status !== 'ACTIVE')
    throw new AuthError('ACCOUNT_UNAVAILABLE', 'This account is not active', 403);

  return {
    user: publicUser({ ...user }),
    accessToken: signAccessToken(user.id),
    expiresIn: accessTokenLifetime,
  };
}

export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw new AuthError('USER_NOT_FOUND', 'User not found', 404);
  return publicUser(user);
}

export function verifyAccessToken(token: string): string {
  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload === 'string' || typeof payload.sub !== 'string')
      throw new Error('Invalid subject');
    return payload.sub;
  } catch {
    throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
  }
}
