import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { Resend } from 'resend';
import twilio from 'twilio';
import { prisma } from '../../infrastructure/db.js';
import { AuthError, type LoginInput, type RegisterInput } from './auth.js';
import { emailVerificationTemplate } from './templates/email-verification.template.js';

const accessTokenLifetime = 30 * 24 * 60 * 60;
export const accessTokenCookieName = 'sellonit_access_token';
// Keep login timing consistent when the submitted email does not exist.
const dummyPasswordHash = '$2b$12$nQyAVFYP61EJpA51Hcf1oObfpXwQdkF.xCtlkHCfo6yZ4HVMdsEp2';
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
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !auth || !from || sid.includes('000000') || auth.includes('placeholder')) {
    throw new AuthError(
      'SMS_NOT_CONFIGURED',
      'Phone verification is unavailable because Twilio is not configured correctly',
      503,
    );
  }
  try {
    await twilio(sid, auth).messages.create({
      to,
      from,
      body: `Your Sellonit verification code is ${code}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Twilio error';
    const normalizedMessage = message.toLowerCase();
    if (
      normalizedMessage.includes('verified recipient') ||
      normalizedMessage.includes('trial phone number') ||
      normalizedMessage.includes('trial accounts can only send sms messages to verified numbers')
    ) {
      throw new AuthError(
        'TWILIO_TRIAL_RECIPIENT_NOT_VERIFIED',
        'Twilio trial accounts can only send SMS to verified recipient numbers. Verify the destination number in the Twilio Console or upgrade the account.',
        403,
      );
    }
    throw new AuthError('SMS_DELIVERY_FAILED', `Unable to send verification SMS: ${message}`, 502);
  }
}

export async function register(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  if (await prisma.user.findUnique({ where: { email } }))
    throw new AuthError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists', 409);
  const user = await prisma.user.create({
    data: {
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
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
  return {
    user,
    ...(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
      ? { emailVerificationToken: emailToken }
      : {}),
  };
}

export async function updatePhone(userId: string, value: string) {
  const phone = normalizeNigerianPhone(value);
  if (!phone) throw new AuthError('INVALID_PHONE', 'Enter a valid Nigerian phone number', 400);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { phone, phoneVerifiedAt: null },
    select: publicUserSelect,
  });
  return user;
}

export async function sendPhoneVerification(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, phone: true, phoneVerifiedAt: true },
  });
  if (!user) throw new AuthError('USER_NOT_FOUND', 'No account was found for this email', 404);
  if (!user.phone)
    throw new AuthError('PHONE_NOT_SET', 'No phone number is associated with this account', 400);
  if (user.phoneVerifiedAt)
    throw new AuthError('PHONE_ALREADY_VERIFIED', 'This phone number is already verified', 409);

  const phoneToken = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.verificationToken.updateMany({
    where: { userId: user.id, type: 'PHONE', consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      type: 'PHONE',
      tokenHash: hash(phoneToken),
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  await sendSms(user.phone, phoneToken);
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
  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? dummyPasswordHash,
  );
  if (!user || !passwordMatches)
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

export async function verifyEmailAndCreateSession(value: string) {
  const record = await prisma.verificationToken.findFirst({
    where: {
      type: 'EMAIL',
      tokenHash: hash(value),
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        select: publicUserSelect,
      },
    },
  });

  if (!record)
    throw new AuthError(
      'INVALID_VERIFICATION_TOKEN',
      'Verification token is invalid or expired',
      400,
    );
  if (record.user.status !== 'ACTIVE')
    throw new AuthError('ACCOUNT_UNAVAILABLE', 'This account is not active', 403);

  const accessToken = token();
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.verificationToken.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1)
      throw new AuthError(
        'INVALID_VERIFICATION_TOKEN',
        'Verification token is invalid or expired',
        400,
      );

    await transaction.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: now },
    });
    await transaction.session.create({
      data: {
        userId: record.userId,
        tokenHash: hash(accessToken),
        expiresAt: new Date(Date.now() + accessTokenLifetime * 1000),
      },
    });
  });

  return {
    user: { ...record.user, emailVerifiedAt: now },
    accessToken,
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
