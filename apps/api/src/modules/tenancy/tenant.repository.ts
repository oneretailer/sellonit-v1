import { prisma } from '../../infrastructure/db.js';
import { AuthError } from '../auth/auth.js';

export async function requireBusinessMembership(userId: string, businessId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId, businessId } },
    include: { business: true },
  });
  if (!membership) throw new AuthError('FORBIDDEN', 'You do not have access to this business', 403);
  return membership;
}

export async function requireOwnedBusiness(userId: string, businessId: string) {
  const membership = await requireBusinessMembership(userId, businessId);
  if (!['OWNER', 'MANAGER'].includes(membership.role)) {
    throw new AuthError('FORBIDDEN', 'Business owner access is required', 403);
  }
  return membership;
}
