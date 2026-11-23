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
    addressLine2: '',
    area: '',
    city: 'Lagos',
    state: 'Lagos',
    country: 'NG',
    dispatchRecipientName: '',
    dispatchPhone: '',
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

  it('validates optional dispatch contact name and phone when provided', () => {
    const errors = validateSupplierProfile(
      validValues({
        dispatchRecipientName: 'X',
        dispatchPhone: '999',
      }),
      'save',
    );
    expect(errors.dispatchRecipientName).toBe(
      'Dispatch contact name must be at least 2 characters.',
    );
    expect(errors.dispatchPhone).toBe('Enter a valid Nigerian phone number for dispatch.');
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

  it('normalizes phone/country and preserves addressLine2, area, dispatch overrides, and existing coordinates', () => {
    const payload = toSupplierProfilePayload(
      validValues({
        contactPhone: '+234 803 123 4567',
        addressLine2: 'Warehouse 4',
        area: 'Apapa',
        country: 'ng',
        dispatchRecipientName: 'Chidi Warehouse Lead',
        dispatchPhone: '0809 000 1111',
      }),
      { latitude: 6.4488, longitude: 3.359 },
    );
    expect(payload).toEqual({
      legalName: 'Lagos Prime Wholesale Ltd',
      contactPhone: '08031234567',
      description: 'Wholesale supplier of packaged foods and beverages across Lagos.',
      retailerAccess: 'APPROVAL_REQUIRED',
      originLocation: {
        latitude: 6.4488,
        longitude: 3.359,
        recipientName: 'Chidi Warehouse Lead',
        phone: '08090001111',
        addressLine1: '14 Wharf Road, Apapa',
        addressLine2: 'Warehouse 4',
        area: 'Apapa',
        city: 'Lagos',
        state: 'Lagos',
        country: 'NG',
      },
    });
  });

  it('clones and preserves unedited existingOrigin fields and defaults recipientName to legalName only when empty', () => {
    const existingOrigin = {
      recipientName: 'Existing Dispatch Lead',
      phone: '08055554444',
      addressLine1: '10 Broad Street',
      addressLine2: 'Suite 2B',
      area: 'Marina',
      city: 'Lagos',
      state: 'Lagos',
      country: 'NG',
      latitude: 6.4541,
      longitude: 3.3947,
      landmarkCode: 'LM-99',
    };

    const preserved = toSupplierProfilePayload(
      validValues({
        legalName: 'Renamed Legal Entity Ltd',
        addressLine2: undefined,
        area: undefined,
        dispatchRecipientName: undefined,
        dispatchPhone: undefined,
      }),
      existingOrigin,
    );

    // Must not mutate the source object and must preserve unedited fields + custom keys.
    expect(existingOrigin.addressLine1).toBe('10 Broad Street');
    expect(preserved.originLocation).toEqual({
      recipientName: 'Existing Dispatch Lead',
      phone: '08055554444',
      addressLine1: '14 Wharf Road, Apapa',
      addressLine2: 'Suite 2B',
      area: 'Marina',
      city: 'Lagos',
      state: 'Lagos',
      country: 'NG',
      latitude: 6.4541,
      longitude: 3.3947,
      landmarkCode: 'LM-99',
    });

    // Defaults recipientName to legalName only when neither form nor existingOrigin has one.
    const defaulted = toSupplierProfilePayload(
      validValues({
        legalName: 'Fresh Supplier Ltd',
        dispatchRecipientName: '',
        dispatchPhone: '',
      }),
      null,
    );
    expect(defaulted.originLocation?.recipientName).toBe('Fresh Supplier Ltd');
    expect(defaulted.originLocation?.phone).toBe('08031234567');
  });
});
