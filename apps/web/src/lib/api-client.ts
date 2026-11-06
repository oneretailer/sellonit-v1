/**
 * Minimal same-origin API client for the Sellonit web app.
 *
 * Browser code only ever calls `/api/v1/*` on this origin. The Next.js server
 * proxies those requests to the API (see `rewrites` in `next.config.ts`), so
 * no API URL, key or token ever reaches the client. The session cookie
 * (`sellonit_access_token`) is managed by the browser; this module never
 * reads or writes it.
 */

import { ACTIVE_BUSINESS_HEADER, getActiveBusinessId } from '@/lib/business/activeBusiness';

export const API_BASE_PATH = '/api/v1';
export const ENDPOINT_NOT_IMPLEMENTED_CODE = 'ENDPOINT_NOT_IMPLEMENTED';

/** A non-successful API response. `code` is the backend's stable error code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly requestId: string | null;
  /** Per-field messages from a 422 body (`error.fields`), when present. */
  readonly fields: Record<string, string> | null;

  constructor(
    status: number,
    code: string | null,
    message: string,
    requestId: string | null = null,
    fields: Record<string, string> | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.fields = fields;
  }
}

export function isEndpointNotImplemented(error: unknown): boolean {
  return error instanceof ApiError && error.code === ENDPOINT_NOT_IMPLEMENTED_CODE;
}

/** The API could not be reached at all (offline, proxy down, ...). */
export class NetworkError extends Error {
  constructor() {
    super('Network request failed');
    this.name = 'NetworkError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringOr(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Builds an ApiError from a failed response. Failed responses do not always
 * carry a JSON body, so parsing is defensive and the fallback messages never
 * expose server internals.
 */
async function readErrorBody(response: Response): Promise<ApiError> {
  let code: string | null = null;
  let message = '';
  let requestId: string | null = null;
  let fields: Record<string, string> | null = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body: unknown = await response.json();
      if (isRecord(body) && isRecord(body.error)) {
        code = stringOr(body.error.code);
        message = stringOr(body.error.message) ?? '';
        requestId = stringOr(body.error.requestId);
        if (isRecord(body.error.fields)) {
          const entries = Object.entries(body.error.fields).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          );
          fields = entries.length > 0 ? Object.fromEntries(entries) : null;
        }
        // Additive PROPOSED 422/409 envelopes use the existing ErrorDetail[] shape.
        if (!fields && Array.isArray(body.error.details)) {
          const entries = body.error.details.flatMap((detail: unknown) =>
            isRecord(detail) &&
            typeof detail.field === 'string' &&
            typeof detail.message === 'string'
              ? [[detail.field, detail.message] as [string, string]]
              : [],
          );
          fields = entries.length > 0 ? Object.fromEntries(entries) : null;
        }
      }
    } catch {
      // Malformed error body — fall through to the generic message.
    }
  } else if (response.status === 404 && contentType.includes('text/html')) {
    // TODO(BE-007): Express returns text/html `Cannot <METHOD> /api/v1/...` for
    // unmounted routes because apps/api/src/main.ts has no JSON 404 catch-all.
    // Tag these so UI screens show an honest "not available yet" state instead
    // of mistaking an unimplemented endpoint for a deleted domain record.
    try {
      const text = await response.text();
      if (/Cannot\s+(GET|POST|PUT|PATCH|DELETE)\s+/i.test(text)) {
        code = ENDPOINT_NOT_IMPLEMENTED_CODE;
        message = 'This feature is not available on the server yet.';
      }
    } catch {
      // Ignore unreadable body and fall through to generic message.
    }
  }
  if (!message) {
    message =
      response.status >= 500
        ? 'Something went wrong on our side. Please try again in a moment.'
        : 'We could not complete that request. Please try again.';
  }
  return new ApiError(response.status, code, message, requestId, fields);
}

/**
 * Performs a JSON request against the same-origin API and returns the parsed
 * body. Throws {@link ApiError} for non-success responses and
 * {@link NetworkError} when the request cannot be made.
 */
export async function apiFetchResponse(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    // Merge through Headers so callers may pass plain objects, tuples or a
    // Headers instance (openapi-fetch supplies Headers; spreading one loses all entries).
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has('content-type'))
      headers.set('content-type', 'application/json');
    // TODO(BE-004): Live backend supplier routes resolve tenancy via `:businessId`
    // path/body; keep X-Business-Id attached for forward compatibility.
    const businessId = getActiveBusinessId();
    if (businessId && !headers.has(ACTIVE_BUSINESS_HEADER))
      headers.set(ACTIVE_BUSINESS_HEADER, businessId);
    response = await fetch(`${API_BASE_PATH}${path}`, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
    });
  } catch {
    throw new NetworkError();
  }

  if (!response.ok) {
    throw await readErrorBody(response);
  }
  return response;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetchResponse(path, init);
  const contentType = response.headers.get('content-type') ?? '';
  if (response.status === 204 || !contentType.includes('application/json')) {
    return null as T;
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(
      response.status,
      null,
      'We received an unexpected response. Please try again.',
      null,
    );
  }
}
