function required(name: string, value: string | undefined): string {
  if (!value) {
    // Surfaced on the login screen instead of crashing the whole app.
    console.error(`Missing environment variable ${name}`);
    return '';
  }
  return value;
}

export const env = {
  /**
   * Backend origin without trailing slash. Empty means the API is served from
   * this app's own origin (reverse proxy for /api and /health, see docker/).
   */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, ''),
  appId: required('VITE_APP_ID', import.meta.env.VITE_APP_ID),
  appKey: required('VITE_APP_KEY', import.meta.env.VITE_APP_KEY),
};

export const isEnvConfigured = Boolean(env.appId && env.appKey);

/** Absolute origin for API calls: the configured backend or, when empty, this page's origin. */
export function apiOrigin(): string {
  return env.apiBaseUrl || window.location.origin;
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'];

/**
 * Configuration that cannot work from this page, shown on the login screen:
 * an API on "localhost" while the page is opened from another machine, or an
 * http API from an https page (blocked by the browser as mixed content).
 */
export function apiConfigProblem(): string | null {
  if (!env.apiBaseUrl) return null;
  let api: URL;
  try {
    api = new URL(env.apiBaseUrl);
  } catch {
    return `VITE_API_BASE_URL tidak valid: ${env.apiBaseUrl}`;
  }
  const page = window.location;
  if (LOCAL_HOSTS.includes(api.hostname) && !LOCAL_HOSTS.includes(page.hostname)) {
    return `Alamat API (${api.origin}) menunjuk ke komputer pengguna sendiri, bukan ke server. Kosongkan VITE_API_BASE_URL (API lewat proxy di server ini) atau isi dengan alamat server, lalu build ulang.`;
  }
  if (page.protocol === 'https:' && api.protocol === 'http:') {
    return `Halaman dibuka lewat HTTPS tetapi API memakai HTTP (${api.origin}); browser memblokirnya. Gunakan API HTTPS atau kosongkan VITE_API_BASE_URL agar lewat proxy.`;
  }
  return null;
}
