import crypto from 'crypto';

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function isInviteExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

export function formatInviteExpiryDate(expiresAt: string): string {
  const date = new Date(expiresAt);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
