/**
 * Authenticated fetch client with:
 * - automatic Bearer injection from localStorage token,
 * - envelope unwrap ({ data, meta } → data) matching the server's
 *   TransformInterceptor,
 * - structured error handling for { error: { code, message, details } }
 *   from AllExceptionsFilter,
 * - single retry on 401 via Telegram re-auth,
 * - network-error toast hook delegated to the caller (we throw; a
 *   global listener in the shell surfaces the toast).
 */

import { telegram } from './telegram.js';

const TOKEN_KEY = 'gymbo_token';

/** @typedef {{ code: string, message: string, details?: unknown }} ApiErrorBody */

export class ApiError extends Error {
  /** @param {number} status @param {ApiErrorBody} body */
  constructor(status, body) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

export class NetworkError extends Error {
  /** @param {unknown} cause */
  constructor(cause) {
    super('Network error');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

class Api {
  constructor() {
    this.baseUrl = '';
    this.token = globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  }

  setToken(token) {
    this.token = token;
    if (token) globalThis.localStorage?.setItem(TOKEN_KEY, token);
    else globalThis.localStorage?.removeItem(TOKEN_KEY);
  }

  /**
   * Exchange Telegram initData for a JWT.
   * @returns {Promise<string | null>}
   */
  async authenticateWithTelegram() {
    const initData = telegram.initData;
    if (!initData) return null;

    try {
      const res = await fetch(this.baseUrl + '/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      if (!res.ok) return null;
      const body = unwrap(await res.json());
      const token = body?.token ?? body?.access_token ?? null;
      this.setToken(token);
      return token;
    } catch {
      return null;
    }
  }

  async request(path, opts = {}, _retry = true) {
    const headers = { ...(opts.headers ?? {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const isFormData = opts.body instanceof FormData;
    if (!isFormData && opts.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    let res;
    try {
      res = await fetch(this.baseUrl + path, { ...opts, headers });
    } catch (cause) {
      throw new NetworkError(cause);
    }

    if (res.status === 401 && _retry) {
      this.setToken(null);
      const token = await this.authenticateWithTelegram();
      if (token) return this.request(path, opts, false);
    }

    if (!res.ok) {
      const raw = await res.json().catch(() => ({}));
      const body =
        raw?.error ??
        /** @type {ApiErrorBody} */ ({
          code: `HTTP_${res.status}`,
          message: raw?.message ?? `Request failed: ${res.status}`,
        });
      throw new ApiError(res.status, body);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) return unwrap(await res.json());
    return res.text();
  }

  get(path) {
    return this.request(path, { method: 'GET' });
  }

  post(path, body) {
    return this.request(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    });
  }

  put(path, body) {
    return this.request(path, { method: 'PUT', body: JSON.stringify(body ?? {}) });
  }

  del(path) {
    return this.request(path, { method: 'DELETE' });
  }

  upload(path, formData) {
    return this.request(path, { method: 'POST', body: formData });
  }
}

/** @param {unknown} body */
function unwrap(body) {
  if (
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    'data' in body &&
    'meta' in body
  ) {
    return /** @type {{ data: unknown }} */ (body).data;
  }
  return body;
}

export const api = new Api();
