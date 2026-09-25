/**
 * The one way the React app talks to the Express API.
 *
 * - Same origin by default (Express serves the built app; Vite proxies
 *   /api in development). Set VITE_API_URL only if the API is hosted on
 *   a different domain.
 * - Cookies are always sent, so the admin session works.
 * - Every write carries the X-Requested-With header the server requires
 *   as its CSRF guard.
 * - Errors become `ApiError` with the server's readable message.
 */
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const ADMIN_HEADER = { 'X-Requested-With': 'ceylon-admin' };

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** URLs the API returns for GridFS files are relative ("/api/files/..."). */
export function assetUrl(url) {
  if (!url) return url;
  return url.startsWith('/api/') ? `${API_BASE}${url}` : url;
}

async function parse(res) {
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok || body?.ok === false) {
    const fallback =
      res.status === 0 || res.status >= 502
        ? 'The server is not responding. Please try again in a moment.'
        : `Request failed (HTTP ${res.status}).`;
    throw new ApiError(body?.error || fallback, res.status, body);
  }
  return body;
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') Object.assign(headers, ADMIN_HEADER);
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, credentials: 'include', signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Could not reach the server. Check your internet connection and try again.', 0);
  }
  return parse(res);
}

/**
 * Multipart upload with progress (fetch cannot report upload progress).
 * `onProgress` receives 0..1.
 */
export function upload(path, formData, { method = 'POST', onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_BASE}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('X-Requested-With', ADMIN_HEADER['X-Requested-With']);
    if (onProgress) {
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    }
    xhr.onload = () => {
      parse(new Response(xhr.responseText || null, { status: xhr.status || 500 })).then(resolve, reject);
    };
    xhr.onerror = () => reject(new ApiError('The upload was interrupted. Check your connection and try again.', 0));
    xhr.send(formData);
  });
}
