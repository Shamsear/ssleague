import { auth } from './firebase/config';

// Token cache to prevent race conditions
let cachedToken: string | null = null;
let tokenExpiry: number = 0;
let refreshPromise: Promise<string> | null = null;

/**
 * Fetch wrapper that automatically retries on 401 (token expired) errors
 * by refreshing the token and retrying the request once
 * 
 * This function sends the token in the Authorization header for immediate effect,
 * avoiding cookie timing issues. Uses token caching to prevent race conditions.
 */
/**
 * Get a fresh token, using cache if available and not expired
 */
async function getFreshToken(forceRefresh: boolean = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user');
  }

  const now = Date.now();
  
  // Return cached token if valid and not expired (expires in 1 hour, refresh at 55 min)
  if (!forceRefresh && cachedToken && tokenExpiry > now) {
    return cachedToken;
  }

  // If refresh is already in progress, wait for it
  if (refreshPromise) {
    return await refreshPromise;
  }

  // Start token refresh
  refreshPromise = (async () => {
    try {
      console.log('🔄 Refreshing token...');
      const token = await user.getIdToken(true);
      console.log('✅ Token refreshed successfully, length:', token.length);
      
      // Cache token for 55 minutes (tokens expire in 60 min)
      cachedToken = token;
      tokenExpiry = now + (55 * 60 * 1000);
      
      // Update cookie for server-side rendering (fire and forget)
      fetch('/api/auth/set-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).catch((err) => {
        console.warn('⚠️ Cookie update failed:', err);
      });
      
      return token;
    } finally {
      refreshPromise = null;
    }
  })();

  return await refreshPromise;
}

export async function fetchWithTokenRetry(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const user = auth.currentUser;
  
  if (!user) {
    console.error('❌ No authenticated user found. Please log in.');
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get fresh token (uses cache if available)
    const token = await getFreshToken();
    
    // Add token to request headers
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    return new Response(JSON.stringify({ error: 'Token refresh failed. Please log in again.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // First attempt
  let response = await fetch(url, options);

  // If 401 (unauthorized), try to refresh token and retry once
  if (response.status === 401) {
    console.log('🔄 Got 401, forcing token refresh and retry...');
    
    try {
      // Force refresh the token (bypass cache)
      const newToken = await getFreshToken(true);
      
      console.log('✅ Token force-refreshed, retrying request...');
      
      // Update Authorization header with new token
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${newToken}`,
      };
      
      // Retry the original request with new token in header
      response = await fetch(url, options);
      
      // If still 401 after refresh, session is completely expired
      if (response.status === 401) {
        console.error('❌ Session expired. Please log in again.');
        // Clear cache to force fresh login
        cachedToken = null;
        tokenExpiry = 0;
        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login?expired=true';
        }
      }
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      // Clear cache
      cachedToken = null;
      tokenExpiry = 0;
    }
  }

  return response;
}
