import { describe, expect, it } from 'vitest';
import {
  canEditSupplierProfileStatus,
  canSubmitSupplierProfileStatus,
  toSupplierProfilePayload,
  validateSupplierProfile,
  type SupplierProfileFormValues,
} from './validation';

function validValues(
  overrides: Partial<SupplierProfileFormValues> = {},
): SupplierProfileFormValues {
  return {
    legalName: 'Lagos Prime Wholesale Ltd',
    contactPhone: '08031234567',
    description: 'Wholesale supplier of packaged foods and beverages across Lagos.',
    retailerAccess: 'APPROVAL_REQUIRED',
    addressLine1: '14 Wharf Road, Apapa',
    city: 'Lagos',
    state: 'Lagos',
    country: 'NG',
    ...overrides,
  };
}

describe('supplier profile strict validation & state guards', () => {
  it('only permits DRAFT profiles to submit for review (matching DB SupplierStatusTransition)', () => {
    expect(canSubmitSupplierProfileStatus('DRAFT')).toBe(true);
    expect(canSubmitSupplierProfileStatus('PENDING_REVIEW')).toBe(false);
    expect(canSubmitSupplierProfileStatus('APPROVED')).toBe(false);
    expect(canSubmitSupplierProfileStatus('REJECTED')).toBe(false);
    expect(canSubmitSupplierProfileStatus('SUSPENDED')).toBe(false);

    expect(canEditSupplierProfileStatus('DRAFT')).toBe(true);
    expect(canEditSupplierProfileStatus('APPROVED')).toBe(true);
    expect(canEditSupplierProfileStatus('PENDING_REVIEW')).toBe(false);
    expect(canEditSupplierProfileStatus('REJECTED')).toBe(false);
    expect(canEditSupplierProfileStatus('SUSPENDED')).toBe(false);
  });

  it('allows saving a minimal draft without origin/phone/description, while still enforcing legalName and phone format', () => {
    expect(
      validateSupplierProfile(
        validValues({
          contactPhone: '',
          description: '',
          addressLine1: '',
          city: '',
          state: '',
        }),
        'save',
      ),
    ).toEqual({});

    expect(
      validateSupplierProfile(
        validValues({
          legalName: 'A',
          contactPhone: '12345',
        }),
        'save',
      ),
    ).toEqual({
      legalName: 'Enter your legal business name (at least 2 characters).',
      contactPhone: 'Enter a valid Nigerian phone number.',
    });
  });

  it('rejects partial origin addresses even on save so invalid Address objects are never sent', () => {
    const errors = validateSupplierProfile(
      validValues({
        addressLine1: '',
        city: 'Lagos',
        state: '',
        country: 'NGA',
      }),
      'save',
    );
    expect(errors.addressLine1).toBe('Enter a street address (at least 3 characters).');
    expect(errors.state).toBe('Enter a state.');
    expect(errors.country).toBe('Enter a 2-letter ISO country code (for example, NG).');
  });

  it('strictly requires phone, description (>=10 chars), and complete dispatch address on submit', () => {
    const errors = validateSupplierProfile(
      validValues({
        contactPhone: '',
        description: 'Too short',
        addressLine1: '',
        city: '',
        state: '',
        country: '',
      }),
      'submit',
    );
    expect(errors).toEqual({
      contactPhone: 'Enter a business contact phone number.',
      description: 'Enter a business description of at least 10 characters.',
      addressLine1: 'Enter a street address (at least 3 characters).',
      city: 'Enter a city.',
      state: 'Enter a state.',
      country: 'Enter a 2-letter ISO country code (for example, NG).',
    });
  });

  it('normalizes Nigerian phone numbers and uppercase ISO country codes in payload', () => {
    const payload = toSupplierProfilePayload(
      validValues({ contactPhone: '+234 803 123 4567', country: 'ng' }),
    );
    expect(payload).toEqual({
      legalName: 'Lagos Prime Wholesale Ltd',
      contactPhone: '08031234567',
      description: 'Wholesale supplier of packaged foods and beverages across Lagos.',
      retailerAccess: 'APPROVAL_REQUIRED',
      originLocation: {
        recipientName: 'Lagos Prime Wholesale Ltd',
        phone: '08031234567',
        addressLine1: '14 Wharf Road, Apapa',
        city: 'Lagos',
        state: 'Lagos',
        country: 'NG',
      },
    });
  });
});
