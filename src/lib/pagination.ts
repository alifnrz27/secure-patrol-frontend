import type { Paginated } from '@/lib/api/types';

export const MAX_PAGE_SIZE = 100;

/** Fetches every page (limit=100) of a paginated endpoint. */
export async function fetchAllPages<T>(
  fetchPage: (page: number, signal?: AbortSignal) => Promise<Paginated<T>>,
  options: { signal?: AbortSignal; onProgress?: (loaded: number, total: number) => void } = {},
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    options.signal?.throwIfAborted();
    const result = await fetchPage(page, options.signal);
    items.push(...result.items);
    totalPages = result.pagination.total_pages;
    options.onProgress?.(items.length, result.pagination.total);
    page += 1;
  } while (page <= totalPages);
  return items;
}
