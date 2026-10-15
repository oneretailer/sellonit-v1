/**
 * Data collected across the registration steps, in the order the backend needs
 * it. The current step is NOT stored here: the URL (`/auth/register/<step>`) is
 * the single source of truth for it.
 *
 * POST /api/v1/auth/register takes every detail in one request. The steps hold
 * the details in this state, and nothing is sent until the phone step submits.
 */
export type RegisteredAccount = {
  email: string;
  /** National digits, e.g. `8072994315`, or null when the phone step was skipped. */
  phone: string | null;
  /**
   * DEV-ONLY-REMOVE: the email verification token the API returns outside
   * production. Used only by DevEmailVerificationPanel.
   */
  devEmailVerificationToken?: string;
};

export type RegisterFlowState = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  /** Held in memory only. Cleared as soon as the account is created. */
  password: string | null;
  /** National digits, or null when the user skipped the phone number. */
  phone: string | null;
  /** Set once POST /auth/register has succeeded. */
  registered: RegisteredAccount | null;
  /** Set once POST /auth/verify-phone has succeeded. */
  phoneVerified: boolean;
};

export type RegisterFlowAction =
  | { type: 'nameSaved'; firstName: string; lastName: string }
  | { type: 'emailSaved'; email: string }
  | { type: 'passwordSaved'; password: string }
  | { type: 'phoneSaved'; phone: string | null }
  | { type: 'registered'; account: RegisteredAccount }
  | { type: 'phoneVerified' };

export const initialRegisterFlowState: RegisterFlowState = {
  firstName: null,
  lastName: null,
  email: null,
  password: null,
  phone: null,
  registered: null,
  phoneVerified: false,
};

export function registerFlowReducer(
  state: RegisterFlowState,
  action: RegisterFlowAction,
): RegisterFlowState {
  switch (action.type) {
    case 'nameSaved':
      return { ...state, firstName: action.firstName, lastName: action.lastName };
    case 'emailSaved':
      return { ...state, email: action.email };
    case 'passwordSaved':
      return { ...state, password: action.password };
    case 'phoneSaved':
      // Changing the number invalidates an earlier phone verification.
      if (action.phone === state.phone) {
        return state;
      }
      return { ...state, phone: action.phone, phoneVerified: false };
    case 'registered':
      return {
        ...state,
        phone: action.account.phone,
        phoneVerified: false,
        password: null,
        registered: action.account,
      };
    case 'phoneVerified':
      return { ...state, phoneVerified: true };
    default:
      return state;
  }
}
