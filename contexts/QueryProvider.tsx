'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: how long data is considered fresh (no refetch needed)
            staleTime: 30 * 1000, // 30 seconds
            
            // Cache time: how long inactive data stays in cache
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            
            // Refetch on window focus
            refetchOnWindowFocus: true,
            
            // Refetch on reconnect
            refetchOnReconnect: true,
            
            // Refetch on mount if data is stale
            refetchOnMount: true,
            
            // Retry failed requests
            retry: 1,
            
            // Network mode
            networkMode: 'online',
          },
          mutations: {
            // Retry failed mutations
            retry: 1,
            
            // Network mode for mutations
            networkMode: 'online',
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
      )}
    </QueryClientProvider>
  );
}
