import { normalizePhone } from '@/lib/auth/identifier';
import type {
  RetailerAccessMode,
  SupplierOriginAddress,
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
export const MAX_ADDRESS_LINE2_LENGTH = 250;
export const MAX_AREA_LENGTH = 120;
export const MAX_CITY_LENGTH = 120;
export const MAX_STATE_LENGTH = 120;
export const MAX_RECIPIENT_NAME_LENGTH = 120;

export const NIGERIA_STATES: readonly string[] = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'FCT - Abuja',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
];

export const SUPPORTED_COUNTRIES: readonly { code: string; name: string }[] = [
  { code: 'NG', name: 'Nigeria (NG)' },
  { code: 'GH', name: 'Ghana (GH)' },
  { code: 'KE', name: 'Kenya (KE)' },
  { code: 'ZA', name: 'South Africa (ZA)' },
  { code: 'GB', name: 'United Kingdom (GB)' },
  { code: 'US', name: 'United States (US)' },
];

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
  addressLine2?: string;
  area?: string;
  city: string;
  state: string;
  country: string;
  dispatchRecipientName?: string;
  dispatchPhone?: string;
};

export type SupplierProfileFieldKey = keyof SupplierProfileFormValues;

export type SupplierProfileErrors = Partial<Record<SupplierProfileFieldKey, string>>;

export type SupplierProfileValidationMode = 'save' | 'submit';

export const SUPPLIER_PROFILE_FIELD_ORDER: readonly SupplierProfileFieldKey[] = [
  'legalName',
  'contactPhone',
  'description',
  'retailerAccess',
  'addressLine1',
  'addressLine2',
  'area',
  'city',
  'state',
  'country',
  'dispatchRecipientName',
  'dispatchPhone',
];

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
  const line2 = (values.addressLine2 ?? '').trim();
  const area = (values.area ?? '').trim();
  const city = values.city.trim();
  const state = values.state.trim();
  const country = values.country.trim().toUpperCase();
  const dispatchRecipient = (values.dispatchRecipientName ?? '').trim();
  const dispatchPhoneRaw = (values.dispatchPhone ?? '').trim();

  if (line2.length > MAX_ADDRESS_LINE2_LENGTH) {
    errors.addressLine2 = `Suite or landmark must be ${MAX_ADDRESS_LINE2_LENGTH} characters or fewer.`;
  }
  if (area.length > MAX_AREA_LENGTH) {
    errors.area = `Area / LGA must be ${MAX_AREA_LENGTH} characters or fewer.`;
  }
  if (dispatchRecipient.length > 0 && dispatchRecipient.length < MIN_LEGAL_NAME_LENGTH) {
    errors.dispatchRecipientName = 'Dispatch contact name must be at least 2 characters.';
  } else if (dispatchRecipient.length > MAX_RECIPIENT_NAME_LENGTH) {
    errors.dispatchRecipientName = `Dispatch contact name must be ${MAX_RECIPIENT_NAME_LENGTH} characters or fewer.`;
  }
  if (dispatchPhoneRaw.length > 0) {
    const normalizedDispatchPhone = normalizePhone(dispatchPhoneRaw);
    if (!normalizedDispatchPhone || normalizedDispatchPhone.length > MAX_CONTACT_PHONE_LENGTH) {
      errors.dispatchPhone = 'Enter a valid Nigerian phone number for dispatch.';
    }
  }

  const hasAnyOrigin =
    line1.length > 0 ||
    line2.length > 0 ||
    area.length > 0 ||
    city.length > 0 ||
    state.length > 0 ||
    dispatchRecipient.length > 0 ||
    dispatchPhoneRaw.length > 0;

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
  existingOrigin?: SupplierOriginAddress | null,
): UpsertSupplierProfilePayload {
  const legalName = values.legalName.trim();
  const rawPhone = values.contactPhone.trim();
  const contactPhone = rawPhone ? (normalizePhone(rawPhone) ?? rawPhone) : '';
  const description = values.description.trim();
  const line1 = values.addressLine1.trim();
  const line2 = (values.addressLine2 ?? '').trim();
  const area = (values.area ?? '').trim();
  const city = values.city.trim();
  const state = values.state.trim();
  const country = values.country.trim().toUpperCase() || 'NG';
  const dispatchRecipient = (values.dispatchRecipientName ?? '').trim();
  const dispatchPhoneRaw = (values.dispatchPhone ?? '').trim();
  const dispatchPhone = dispatchPhoneRaw
    ? (normalizePhone(dispatchPhoneRaw) ?? dispatchPhoneRaw)
    : contactPhone;
  const hasOrigin = line1.length > 0 && city.length > 0 && state.length > 0;

  // Preserve extra server-stored coordinates if present while updating editable address fields.
  const preservedCoords: SupplierOriginAddress = {};
  if (typeof existingOrigin?.latitude === 'number') {
    preservedCoords.latitude = existingOrigin.latitude;
  }
  if (typeof existingOrigin?.longitude === 'number') {
    preservedCoords.longitude = existingOrigin.longitude;
  }

  return {
    legalName,
    ...(contactPhone ? { contactPhone } : {}),
    description,
    retailerAccess: values.retailerAccess,
    ...(hasOrigin
      ? {
          originLocation: {
            ...preservedCoords,
            recipientName: dispatchRecipient || legalName,
            ...(dispatchPhone ? { phone: dispatchPhone } : {}),
            addressLine1: line1,
            ...(line2 ? { addressLine2: line2 } : {}),
            ...(area ? { area } : {}),
            city,
            state,
            country,
          },
        }
      : {}),
  };
}
