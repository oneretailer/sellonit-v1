import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { Resend } from 'resend';
import twilio from 'twilio';
import { prisma } from '../../infrastructure/db.js';
import { AuthError, type LoginInput, type RegisterInput } from './auth.js';
import { emailVerificationTemplate } from './templates/email-verification.template.js';

const accessTokenLifetime = 30 * 24 * 60 * 60;
export const accessTokenCookieName = 'sellonit_access_token';
const publicUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  status: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('hex');
const normalizeEmail = (value: string) => value.trim().toLowerCase();

export function normalizeNigerianPhone(value: string): string | null {
  const phone = value.replace(/[^\d+]/g, '');
  if (/^\+234\d{10}$/.test(phone)) return phone;
  if (/^234\d{10}$/.test(phone)) return `+${phone}`;
  if (/^0\d{10}$/.test(phone)) return `+234${phone.slice(1)}`;
  return null;
}

async function sendEmail(to: string, firstName: string, verificationToken: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.includes('placeholder')) return;
  const template = emailVerificationTemplate({
    firstName,
    verificationUrl: `${process.env.VERIFICATION_BASE_URL}/verify-email?token=${encodeURIComponent(verificationToken)}`,
  });
  const { error } = await new Resend(key).emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? '',
    to: [to],
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
  if (error) throw new Error(`Resend email delivery failed: ${error.message}`);
}

async function sendSms(to: string, code: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !auth || sid.includes('000000') || auth.includes('placeholder')) return;
  await twilio(sid, auth).messages.create({
    to,
    from: process.env.TWILIO_FROM_NUMBER ?? '',
    body: `Your Sellonit verification code is ${code}`,
  });
}

export async function register(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  if (await prisma.user.findUnique({ where: { email } }))
    throw new AuthError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists', 409);
  const phone = input.phone ? normalizeNigerianPhone(input.phone) : null;
  if (input.phone && !phone)
    throw new AuthError('INVALID_PHONE', 'Enter a valid Nigerian phone number', 400);
  const user = await prisma.user.create({
    data: {
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone,
      passwordHash: await bcrypt.hash(input.password, 12),
    },
    select: publicUserSelect,
  });
  const emailToken = token();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      type: 'EMAIL',
      tokenHash: hash(emailToken),
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  await sendEmail(user.email, user.firstName, emailToken);
  if (phone) {
    const phoneToken = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: 'PHONE',
        tokenHash: hash(phoneToken),
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    await sendSms(phone, phoneToken);
  }
  return {
    user,
    ...(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
      ? { emailVerificationToken: emailToken }
      : {}),
  };
}

async function createSession(userId: string): Promise<string> {
  const accessToken = token();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hash(accessToken),
      expiresAt: new Date(Date.now() + accessTokenLifetime * 1000),
    },
  });
  return accessToken;
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(input.email) },
    select: { ...publicUserSelect, passwordHash: true },
  });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash)))
    throw new AuthError('INVALID_CREDENTIALS', 'Email or password is incorrect', 401);
  if (user.status !== 'ACTIVE')
    throw new AuthError('ACCOUNT_UNAVAILABLE', 'This account is not active', 403);
  if (!user.emailVerifiedAt)
    throw new AuthError('EMAIL_NOT_VERIFIED', 'Verify your email before logging in', 403);
  const { passwordHash: _, ...publicUser } = user;
  return {
    user: publicUser,
    accessToken: await createSession(user.id),
    expiresIn: accessTokenLifetime,
  };
}

export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw new AuthError('USER_NOT_FOUND', 'User not found', 404);
  return user;
}

export async function getSessionUserId(accessToken: string): Promise<string> {
  const session = await prisma.session.findUnique({ where: { tokenHash: hash(accessToken) } });
  if (!session || session.revokedAt || session.expiresAt <= new Date())
    throw new AuthError('UNAUTHORIZED', 'Authentication required', 401);
  return session.userId;
}

export async function verifyToken(type: 'EMAIL' | 'PHONE', value: string): Promise<void> {
  const record = await prisma.verificationToken.findFirst({
    where: { type, tokenHash: hash(value), consumedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!record)
    throw new AuthError(
      'INVALID_VERIFICATION_TOKEN',
      'Verification token is invalid or expired',
      400,
    );
  await prisma.$transaction([
    prisma.verificationToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({
      where: { id: record.userId },
      data: type === 'EMAIL' ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() },
    }),
  ]);
}
