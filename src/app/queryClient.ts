import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Only transient failures are retried; 4xx answers are final.
      retry: (failureCount, error) =>
        failureCount < 2 && isApiError(error) && (error.kind === 'network' || error.kind === 'server'),
    },
    mutations: { retry: false },
  },
});
