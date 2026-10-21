/**
 * Every auth endpoint path the web app calls, in one place.
 *
 * Paths are relative to the same-origin API base `/api/v1` (see api-client.ts).
 * To change a path, edit one line here. Nothing else needs to change.
 */
export const AUTH_ENDPOINTS = {
  /**
   * EXISTING. POST. Body: `{ "email": "<email or 11-digit phone>", "password": "…" }`.
   * The field name stays `email` for both identifier types.
   */
  login: '/auth/login',
} as const;
