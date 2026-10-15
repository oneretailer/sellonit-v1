import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api-client';
import { normaliseEmail, resolveEmailStep } from './emailCheck';

describe('normaliseEmail', () => {
  it('trims and lowercases, like the API', () => {
    expect(normaliseEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });
});

describe('resolveEmailStep', () => {
  it('continues without calling the check while the check is disabled', async () => {
    const check = vi.fn();
    const result = await resolveEmailStep(' Ada@Example.com ', { enabled: false, check });
    expect(result).toEqual({ kind: 'continue', email: 'ada@example.com' });
    expect(check).not.toHaveBeenCalled();
  });

  it('sends the normalised email to the check when enabled', async () => {
    const check = vi.fn().mockResolvedValue({ exists: false });
    await resolveEmailStep(' Ada@Example.com ', { enabled: true, check });
    expect(check).toHaveBeenCalledWith('ada@example.com');
  });

  it('returns exists when the account is already registered', async () => {
    const check = vi.fn().mockResolvedValue({ exists: true });
    expect(await resolveEmailStep('ada@example.com', { enabled: true, check })).toEqual({
      kind: 'exists',
      email: 'ada@example.com',
    });
  });

  it('continues when the email is free', async () => {
    const check = vi.fn().mockResolvedValue({ exists: false });
    expect(await resolveEmailStep('ada@example.com', { enabled: true, check })).toEqual({
      kind: 'continue',
      email: 'ada@example.com',
    });
  });

  it('never continues silently when the check fails (network)', async () => {
    const check = vi.fn().mockRejectedValue(new NetworkError());
    const result = await resolveEmailStep('ada@example.com', { enabled: true, check });
    expect(result.kind).toBe('error');
    expect(result).toMatchObject({ message: expect.stringContaining("couldn't check this email") });
  });

  it('shows a rate-limit message on 429', async () => {
    const check = vi.fn().mockRejectedValue(new ApiError(429, 'RATE_LIMITED', 'slow down'));
    const result = await resolveEmailStep('ada@example.com', { enabled: true, check });
    expect(result).toMatchObject({ kind: 'error', message: expect.stringContaining('Too many') });
  });

  it('never shows a raw error message from an unexpected failure', async () => {
    const check = vi.fn().mockRejectedValue(new Error('Backend endpoint not available yet'));
    const result = await resolveEmailStep('ada@example.com', { enabled: true, check });
    expect(result).toMatchObject({ kind: 'error' });
    expect(JSON.stringify(result)).not.toContain('Backend endpoint');
  });

  it('uses the built-in adapter, which is not available yet, when enabled without a check', async () => {
    const result = await resolveEmailStep('ada@example.com', { enabled: true });
    expect(result.kind).toBe('error');
  });
});
