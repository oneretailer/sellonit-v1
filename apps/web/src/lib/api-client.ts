/**
 * Minimal same-origin API client for the Sellonit web app.
 *
 * Browser code only ever calls `/api/v1/*` on this origin. The Next.js server
 * proxies those requests to the API (see `rewrites` in `next.config.ts`), so
 * no API URL, key or token ever reaches the client. The session cookie
 * (`sellonit_access_token`) is managed by the browser; this module never
 * reads or writes it.
 */

export const API_BASE_PATH = '/api/v1';

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
      }
    } catch {
      // Malformed error body — fall through to the generic message.
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
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_PATH}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new NetworkError();
  }

  if (!response.ok) {
    throw await readErrorBody(response);
  }

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
