/**
 * Data collected across the registration steps. The current step is NOT stored
 * here: the URL (`/auth/register/<step>`) is the single source of truth for it.
 *
 * Only data that later steps depend on lives here. Each step's own inputs,
 * submit state and errors stay local to that step's component.
 */
export type RegisterFlowState = {
  /** The 10 national digits entered on the phone step, e.g. `8072994315`. */
  phone: string | null;
  /** Set once the phone number has been verified with the SMS code. */
  phoneVerified: boolean;
};

export type RegisterFlowAction = { type: 'phoneSaved'; phone: string } | { type: 'phoneVerified' };

export const initialRegisterFlowState: RegisterFlowState = {
  phone: null,
  phoneVerified: false,
};

export function registerFlowReducer(
  state: RegisterFlowState,
  action: RegisterFlowAction,
): RegisterFlowState {
  switch (action.type) {
    case 'phoneSaved':
      // Changing the number invalidates any earlier verification.
      if (action.phone === state.phone) {
        return state;
      }
      return { phone: action.phone, phoneVerified: false };
    case 'phoneVerified':
      return { ...state, phoneVerified: true };
    default:
      return state;
  }
}
