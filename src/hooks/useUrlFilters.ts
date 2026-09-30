import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filter state kept in the URL query string so filtered views can be shared
 * and survive a reload. Changing any filter other than `page` resets `page`.
 */
export function useUrlFilters<K extends string>(keys: readonly K[], defaults: Partial<Record<K, string>> = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = {} as Record<K, string>;
    for (const key of keys) result[key] = searchParams.get(key) ?? defaults[key] ?? '';
    return result;
  }, [searchParams, keys.join(',')]);

  const setFilters = useCallback(
    (patch: Partial<Record<K, string | number | null | undefined>>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch) as [K, string | number | null | undefined][]) {
            const text = value === null || value === undefined ? '' : String(value);
            if (text === '' || text === (defaults[key] ?? '')) next.delete(key);
            else next.set(key, text);
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => setSearchParams(new URLSearchParams(), { replace: true }), [setSearchParams]);

  return { filters, setFilters, resetFilters };
}

export function toNumber(value: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function toPage(value: string): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
