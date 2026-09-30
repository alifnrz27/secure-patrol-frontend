import { useEffect, useSyncExternalStore } from 'react';
import { branding, pageTitle, type BrandingState } from '@/lib/branding';

export function useBranding(): BrandingState {
  return useSyncExternalStore(branding.subscribe, branding.get);
}

/** Sets document.title to "{page} — {app name}". */
export function useDocumentTitle(page: string | null): void {
  const { appName } = useBranding();
  useEffect(() => {
    document.title = pageTitle(page, appName);
  }, [page, appName]);
}
