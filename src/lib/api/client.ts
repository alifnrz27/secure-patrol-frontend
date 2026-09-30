import { apiOrigin, env } from '@/config/env';
import { updateClockFromResponse, serverTimestampSeconds } from './clock';
import { APP_AUTH_ERRORS, ApiError, PLATFORM_NOT_ALLOWED, UNIT_INACTIVE } from './errors';
import { randomNonce, serializeFormData, serializeJson, signRequest, type PreparedBody } from './signing';
import type { Envelope } from './types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface ApiRequestOptions {
  method?: HttpMethod;
  query?: QueryParams;
  json?: unknown;
  form?: FormData;
  /** Send the access token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
}

/**
 * Connects apiFetch to the session without a circular import. The session
 * module registers itself at startup.
 */
export interface AuthHandler {
  getAccessToken(): Promise<string | null>;
  /** Called after a 401 "Unauthorized". Resolves true when a new token is available. */
  handleUnauthorized(usedToken: string): Promise<boolean>;
  /** The server revoked the session for good (inactive unit, role blocked on this platform). */
  handleRevoked(reason: 'unit_inactive' | 'forbidden'): void;
}

let authHandler: AuthHandler | null = null;

export function setAuthHandler(handler: AuthHandler | null): void {
  authHandler = handler;
}

export function buildApiUrl(path: string, query?: QueryParams): URL {
  const fullPath = path.startsWith('/api/') ? path : `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  const url = new URL(apiOrigin() + fullPath);
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.append(key, String(value));
    }
    url.search = params.toString();
  }
  return url;
}

async function prepareBody(options: ApiRequestOptions): Promise<PreparedBody> {
  if (options.form) return serializeFormData(options.form);
  if (options.json !== undefined) return serializeJson(options.json);
  return { bytes: new Uint8Array(0) };
}

async function readErrorEnvelope(response: Response): Promise<ApiError> {
  let message = response.statusText || `HTTP ${response.status}`;
  let data: unknown = null;
  try {
    const body = (await response.json()) as Partial<Envelope<unknown>>;
    if (body?.meta?.message) message = body.meta.message;
    data = body?.data ?? null;
  } catch {
    // Not JSON (e.g. a proxy error page); keep the status text.
  }
  return new ApiError(response.status, message, data);
}

/**
 * Sends a signed request and applies the retry rules for clock skew, nonce
 * collisions and expired tokens. Returns the successful Response; any other
 * outcome throws ApiError (or the AbortError of `signal`).
 */
export async function apiRequest(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  const method = options.method ?? 'GET';
  const useAuth = options.auth ?? true;
  const url = buildApiUrl(path, options.query);
  const requestUri = url.pathname + url.search;
  const body = await prepareBody(options);

  let clockRetried = false;
  let nonceRetried = false;
  let authRetried = false;

  for (;;) {
    let token: string | null = null;
    if (useAuth) {
      token = authHandler ? await authHandler.getAccessToken() : null;
      if (!token) throw new ApiError(401, 'Unauthorized', 'no active session');
    }

    const timestamp = serverTimestampSeconds();
    const nonce = randomNonce();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-App-Id': env.appId,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Signature': signRequest({ method, requestUri, timestamp, nonce, body: body.bytes, appKey: env.appKey }),
    };
    if (body.contentType) headers['Content-Type'] = body.contentType;
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch(url.href, {
        method,
        headers,
        body: body.bytes.length > 0 ? (body.bytes as BodyInit) : undefined,
        signal: options.signal,
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ApiError(0, 'Network error', error instanceof Error ? error.message : null);
    }

    updateClockFromResponse(response);
    if (response.ok) return response;

    const error = await readErrorEnvelope(response);

    if (response.status === 401 && error.kind === 'app') {
      if (error.data === APP_AUTH_ERRORS.timestamp && !clockRetried) {
        clockRetried = true;
        updateClockFromResponse(response, true);
        continue;
      }
      if ((error.data === APP_AUTH_ERRORS.nonceReused || error.data === APP_AUTH_ERRORS.nonceInvalid) && !nonceRetried) {
        nonceRetried = true;
        continue;
      }
      throw error;
    }

    // Not an ordinary 403: the session itself is no longer allowed, on any request.
    if (response.status === 403 && useAuth && authHandler) {
      if (error.mentions(UNIT_INACTIVE)) authHandler.handleRevoked('unit_inactive');
      else if (error.mentions(PLATFORM_NOT_ALLOWED)) authHandler.handleRevoked('forbidden');
    }

    if (response.status === 401 && useAuth && token && authHandler && !authRetried) {
      authRetried = true;
      if (await authHandler.handleUnauthorized(token)) continue;
    }

    throw error;
  }
}

/** Signed request that returns the `data` field of the JSON envelope. */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await apiRequest(path, options);
  const envelope = (await response.json()) as Envelope<T>;
  return envelope.data;
}

/** Signed request for binary responses such as protected images. */
export async function apiFetchBlob(path: string, options: ApiRequestOptions = {}): Promise<Blob> {
  const response = await apiRequest(path, options);
  return response.blob();
}

/** Unsigned GET {BASE_URL}/health, used only to learn the server clock at startup. */
export async function syncClockWithServer(timeoutMs = 4000): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiOrigin()}/health`, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
    updateClockFromResponse(response, true);
  } catch {
    // The first signed request will correct the clock through the 401 retry.
  } finally {
    clearTimeout(timer);
  }
}
