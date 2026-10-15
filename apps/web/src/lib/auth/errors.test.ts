import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api-client';
import { emailLinkErrorMessage, phoneCodeErrorMessage, registerErrorMessage } from './errors';

describe('registerErrorMessage', () => {
  it('maps duplicate email, invalid phone and validation failures', () => {
    expect(registerErrorMessage(new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'x'))).toBe(
      'An account with this email already exists. You can log in instead.',
    );
    expect(registerErrorMessage(new ApiError(400, 'INVALID_PHONE', 'x'))).toBe(
      'Enter a valid Nigerian phone number.',
    );
    expect(registerErrorMessage(new ApiError(400, 'VALIDATION_ERROR', 'x'))).toBe(
      'Please check the details you entered and try again.',
    );
  });

  it('explains that the account may exist when the server fails after saving', () => {
    expect(registerErrorMessage(new ApiError(500, 'INTERNAL_ERROR', 'x'))).toContain(
      'may already exist',
    );
  });

  it('shows a network message when the API cannot be reached', () => {
    expect(registerErrorMessage(new NetworkError())).toContain('could not reach Sellonit');
  });
});

describe('phoneCodeErrorMessage', () => {
  it('treats a wrong or expired code the same way, because the API does not say which', () => {
    expect(phoneCodeErrorMessage(new ApiError(400, 'INVALID_VERIFICATION_TOKEN', 'x'))).toBe(
      'That code is incorrect or has expired. Check the text message and try again.',
    );
  });

  it('asks for six digits on a validation failure', () => {
    expect(phoneCodeErrorMessage(new ApiError(400, 'VALIDATION_ERROR', 'x'))).toBe(
      'Enter the 6-digit code from the text message.',
    );
  });
});

describe('emailLinkErrorMessage', () => {
  it('reports an expired or used link', () => {
    expect(emailLinkErrorMessage(new ApiError(400, 'INVALID_VERIFICATION_TOKEN', 'x'))).toBe(
      'This verification link is invalid or has expired. Request a new one by registering again.',
    );
  });
});
