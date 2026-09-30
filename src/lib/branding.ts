import { brandingApi } from '@/api/branding';
import type { Branding } from '@/lib/api/types';

// App name and logo set by the Super-Admin (GET /branding). Cached in
// localStorage so the login page and header show them instantly on reload;
// refreshed in the background on every start.

export const DEFAULT_APP_NAME = 'Secure Patrol';
const DEFAULT_FAVICON = '/favicon.svg';
const CACHE_KEY = 'sp.branding';

export interface BrandingState {
  appName: string;
  /** data: URL of the custom logo; null = built-in logo */
  logoUrl: string | null;
  logoUpdatedAt: string | null;
}

const DEFAULT_STATE: BrandingState = { appName: DEFAULT_APP_NAME, logoUrl: null, logoUpdatedAt: null };

export function toBrandingState(data: Branding): BrandingState {
  return {
    appName: data.app_name?.trim() || DEFAULT_APP_NAME,
    logoUrl: data.logo_base64 && data.logo_mime_type ? `data:${data.logo_mime_type};base64,${data.logo_base64}` : null,
    logoUpdatedAt: data.logo_updated_at,
  };
}

function readCache(): BrandingState {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<BrandingState>;
    return {
      appName: typeof parsed.appName === 'string' && parsed.appName ? parsed.appName : DEFAULT_APP_NAME,
      // Only our own data: URLs are accepted from the cache.
      logoUrl: typeof parsed.logoUrl === 'string' && /^data:image\/(png|jpeg);base64,/.test(parsed.logoUrl) ? parsed.logoUrl : null,
      logoUpdatedAt: typeof parsed.logoUpdatedAt === 'string' ? parsed.logoUpdatedAt : null,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeCache(state: BrandingState): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: branding still works for this page.
  }
}

let state: BrandingState = readCache();
const listeners = new Set<() => void>();

function applyFavicon(logoUrl: string | null): void {
  if (typeof document === 'undefined') return;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = logoUrl ? (logoUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg') : 'image/svg+xml';
  link.href = logoUrl ?? DEFAULT_FAVICON;
}

export const branding = {
  get: (): BrandingState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  set(next: BrandingState): void {
    state = next;
    writeCache(next);
    applyFavicon(next.logoUrl);
    listeners.forEach((l) => l());
  },
  /** Applies the cached branding and fetches the current one in the background. */
  async load(): Promise<void> {
    applyFavicon(state.logoUrl);
    try {
      branding.set(toBrandingState(await brandingApi.get()));
    } catch {
      // Offline or server down: keep the cached (or built-in) branding.
    }
  },
};

/** "Dashboard — Secure Patrol" */
export function pageTitle(page: string | null, appName: string): string {
  return page ? `${page} — ${appName}` : appName;
}
