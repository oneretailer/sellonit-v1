import createClient from 'openapi-fetch';
import type { paths } from '@sellonit/shared';
import { API_BASE_PATH, ApiError, apiFetchResponse } from './api-client';

/** The typed face of the existing same-origin transport; no second URL/error stack. */
export const api = createClient<paths>({
  // Request needs an absolute URL in Node/tests. The custom fetch below strips this
  // placeholder back to the existing same-origin path before any network request.
  baseUrl:
    typeof window === 'undefined'
      ? `http://sellonit.invalid${API_BASE_PATH}`
      : `${window.location.origin}${API_BASE_PATH}`,
  fetch: async (request) => {
    const url = new URL(request.url);
    return apiFetchResponse(url.pathname.slice(API_BASE_PATH.length) + url.search, {
      method: request.method,
      headers: request.headers,
      body: request.body ? await request.text() : undefined,
      signal: request.signal,
    });
  },
});

/** apiFetchResponse normalizes HTTP failures to ApiError before openapi-fetch parses. */
export async function unwrap<T>(
  result: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, response } = await result;
  if (data === undefined) {
    throw new ApiError(
      response.status,
      null,
      'We received an unexpected response. Please try again.',
    );
  }
  return data;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
