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
            // Stale time: Longer cache for better performance (stats don't change every second)
            staleTime: 5 * 60 * 1000, // ✅ 5 minutes - balance between fresh data and performance
            
            // Cache time: how long inactive data stays in cache
            gcTime: 10 * 60 * 1000, // ✅ 10 minutes - keep data longer
            
            // Refetch on window focus - DISABLED for better UX
            refetchOnWindowFocus: false, // ✅ Don't refetch when switching tabs
            
            // Refetch on reconnect - keep enabled for reliability
            refetchOnReconnect: true,
            
            // Refetch on mount - DISABLED, use cached data
            refetchOnMount: false, // ✅ Use cached data on navigation
            
            // Retry failed requests
            retry: 1,
            
            // Network mode
            networkMode: 'online',
            
            // Refetch interval - disabled by default (can override per query)
            refetchInterval: false,
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
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
