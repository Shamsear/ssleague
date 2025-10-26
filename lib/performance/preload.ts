/**
 * Preload Utilities
 * Preload critical resources for faster page loads
 */

/**
 * Preload API endpoint data
 * Call this to start fetching data before navigation
 */
export function preloadData(url: string) {
  if (typeof window === 'undefined') return;
  
  // Use browser's native fetch with high priority
  const controller = new AbortController();
  
  fetch(url, {
    priority: 'high' as any,
    signal: controller.signal,
  }).then(res => res.json())
    .then(data => {
      // Data will be cached by React Query
      console.log(`[Preload] Data ready for: ${url}`);
    })
    .catch(err => {
      if (err.name !== 'AbortError') {
        console.warn(`[Preload] Failed to preload: ${url}`, err);
      }
    });
  
  // Return abort controller for cleanup
  return controller;
}

/**
 * Preload multiple endpoints
 */
export function preloadMultiple(urls: string[]) {
  const controllers = urls.map(url => preloadData(url));
  
  return () => {
    controllers.forEach(ctrl => ctrl?.abort());
  };
}

/**
 * Prefetch dashboard data
 */
export function prefetchDashboard(seasonId: string) {
  return preloadMultiple([
    `/api/team/dashboard?season_id=${seasonId}`,
    `/api/stats/teams?seasonId=${seasonId}`,
  ]);
}

/**
 * Prefetch player details
 */
export function prefetchPlayer(playerId: string) {
  return preloadData(`/api/stats/players?playerId=${playerId}`);
}

/**
 * Prefetch auction round
 */
export function prefetchAuction(roundId: string) {
  return preloadMultiple([
    `/api/team/round/${roundId}`,
    `/api/auction/bids?roundId=${roundId}`,
  ]);
}
