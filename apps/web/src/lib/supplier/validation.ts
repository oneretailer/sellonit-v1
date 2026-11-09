import { normalizePhone } from '@/lib/auth/identifier';
import type {
  RetailerAccessMode,
  SupplierProfileStatus,
  UpsertSupplierProfilePayload,
} from './supplierProfileApi';

export const MAX_LEGAL_NAME_LENGTH = 200;
export const MIN_LEGAL_NAME_LENGTH = 2;
export const MAX_CONTACT_PHONE_LENGTH = 30;
export const MIN_DESCRIPTION_SUBMIT_LENGTH = 10;
export const MAX_DESCRIPTION_LENGTH = 3000;
export const MIN_ADDRESS_LINE1_LENGTH = 3;
export const MAX_ADDRESS_LINE1_LENGTH = 250;
export const MAX_CITY_LENGTH = 120;
export const MAX_STATE_LENGTH = 120;

const VALID_RETAILER_ACCESS: readonly RetailerAccessMode[] = [
  'OPEN',
  'APPROVAL_REQUIRED',
  'PRIVATE',
];

export type SupplierProfileFormValues = {
  legalName: string;
  contactPhone: string;
  description: string;
  retailerAccess: RetailerAccessMode;
  addressLine1: string;
  city: string;
  state: string;
  country: string;
};

export type SupplierProfileFieldKey = keyof SupplierProfileFormValues;

export type SupplierProfileErrors = Partial<Record<SupplierProfileFieldKey, string>>;

export type SupplierProfileValidationMode = 'save' | 'submit';

/**
 * Matches backend `SupplierStatusTransition` (`DRAFT -> PENDING_REVIEW` is the
 * only supplier-initiated transition; `REJECTED`, `APPROVED`, `PENDING_REVIEW`,
 * and `SUSPENDED` return `409 INVALID_STATE_TRANSITION` on `/submit`).
 */
export function canSubmitSupplierProfileStatus(status: SupplierProfileStatus): boolean {
  return status === 'DRAFT';
}

/**
 * Profile details are editable while preparing a `DRAFT` or maintaining an
 * `APPROVED` account, and locked while under review, rejected, or suspended.
 */
export function canEditSupplierProfileStatus(status: SupplierProfileStatus): boolean {
  return status === 'DRAFT' || status === 'APPROVED';
}

export function validateSupplierProfile(
  values: SupplierProfileFormValues,
  mode: SupplierProfileValidationMode,
): SupplierProfileErrors {
  const errors: SupplierProfileErrors = {};

  const legalName = values.legalName.trim();
  if (legalName.length < MIN_LEGAL_NAME_LENGTH) {
    errors.legalName = 'Enter your legal business name (at least 2 characters).';
  } else if (legalName.length > MAX_LEGAL_NAME_LENGTH) {
    errors.legalName = `Legal business name must be ${MAX_LEGAL_NAME_LENGTH} characters or fewer.`;
  }

  const rawPhone = values.contactPhone.trim();
  const normalizedPhone = rawPhone.length > 0 ? normalizePhone(rawPhone) : null;
  if (mode === 'submit' && rawPhone.length === 0) {
    errors.contactPhone = 'Enter a business contact phone number.';
  } else if (rawPhone.length > 0) {
    if (!normalizedPhone || normalizedPhone.length > MAX_CONTACT_PHONE_LENGTH) {
      errors.contactPhone = 'Enter a valid Nigerian phone number.';
    }
  }

  const description = values.description.trim();
  if (mode === 'submit' && description.length < MIN_DESCRIPTION_SUBMIT_LENGTH) {
    errors.description = `Enter a business description of at least ${MIN_DESCRIPTION_SUBMIT_LENGTH} characters.`;
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Business description must be ${MAX_DESCRIPTION_LENGTH.toLocaleString('en-US')} characters or fewer.`;
  }

  if (!VALID_RETAILER_ACCESS.includes(values.retailerAccess)) {
    errors.retailerAccess = 'Choose how retailers can access your catalogue.';
  }

  const line1 = values.addressLine1.trim();
  const city = values.city.trim();
  const state = values.state.trim();
  const country = values.country.trim().toUpperCase();
  const hasAnyOrigin = line1.length > 0 || city.length > 0 || state.length > 0;

  if (mode === 'submit' || hasAnyOrigin) {
    if (line1.length < MIN_ADDRESS_LINE1_LENGTH) {
      errors.addressLine1 = 'Enter a street address (at least 3 characters).';
    } else if (line1.length > MAX_ADDRESS_LINE1_LENGTH) {
      errors.addressLine1 = `Street address must be ${MAX_ADDRESS_LINE1_LENGTH} characters or fewer.`;
    }

    if (city.length === 0) {
      errors.city = 'Enter a city.';
    } else if (city.length > MAX_CITY_LENGTH) {
      errors.city = `City must be ${MAX_CITY_LENGTH} characters or fewer.`;
    }

    if (state.length === 0) {
      errors.state = 'Enter a state.';
    } else if (state.length > MAX_STATE_LENGTH) {
      errors.state = `State must be ${MAX_STATE_LENGTH} characters or fewer.`;
    }

    if (!/^[A-Z]{2}$/.test(country)) {
      errors.country = 'Enter a 2-letter ISO country code (for example, NG).';
    }
  } else if (country.length > 0 && !/^[A-Z]{2}$/.test(country)) {
    errors.country = 'Enter a 2-letter ISO country code (for example, NG).';
  }

  return errors;
}

export function toSupplierProfilePayload(
  values: SupplierProfileFormValues,
): UpsertSupplierProfilePayload {
  const legalName = values.legalName.trim();
  const rawPhone = values.contactPhone.trim();
  const contactPhone = rawPhone ? (normalizePhone(rawPhone) ?? rawPhone) : '';
  const description = values.description.trim();
  const line1 = values.addressLine1.trim();
  const city = values.city.trim();
  const state = values.state.trim();
  const country = values.country.trim().toUpperCase() || 'NG';
  const hasOrigin = line1.length > 0 && city.length > 0 && state.length > 0;

  return {
    legalName,
    ...(contactPhone ? { contactPhone } : {}),
    description,
    retailerAccess: values.retailerAccess,
    ...(hasOrigin
      ? {
          originLocation: {
            recipientName: legalName,
            ...(contactPhone ? { phone: contactPhone } : {}),
            addressLine1: line1,
            city,
            state,
            country,
          },
        }
      : {}),
  };
}
