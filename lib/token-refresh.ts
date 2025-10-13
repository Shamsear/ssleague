import { auth } from '@/lib/firebase/config';

/**
 * Refresh the current user's ID token and update the cookie
 * This should be called when a 401 error is received from the API
 */
export async function refreshAuthToken(): Promise<string | null> {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.error('No user logged in to refresh token');
      return null;
    }

    // Force token refresh
    const idToken = await currentUser.getIdToken(true);
    
    // Update token in cookie via API
    const response = await fetch('/api/auth/set-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: idToken }),
    });

    if (!response.ok) {
      console.error('Failed to update token cookie');
      return null;
    }

    console.log('✅ Token refreshed successfully');
    return idToken;
  } catch (error) {
    console.error('Error refreshing auth token:', error);
    return null;
  }
}

/**
 * Setup automatic token refresh every 50 minutes (tokens expire after 1 hour)
 */
export function setupTokenRefreshInterval(): () => void {
  const REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes in milliseconds
  
  const intervalId = setInterval(async () => {
    const token = await refreshAuthToken();
    if (token) {
      console.log('✅ Automatic token refresh completed');
    } else {
      console.warn('⚠️ Automatic token refresh failed');
    }
  }, REFRESH_INTERVAL);

  // Return cleanup function
  return () => clearInterval(intervalId);
}

/**
 * Enhanced fetch wrapper that automatically retries with token refresh on 401
 */
export async function fetchWithTokenRefresh(
  url: string,
  options?: RequestInit
): Promise<Response> {
  // First attempt
  let response = await fetch(url, options);

  // If we get a 401, try refreshing the token and retry once
  if (response.status === 401) {
    console.log('🔄 Received 401, attempting token refresh...');
    
    const newToken = await refreshAuthToken();
    
    if (newToken) {
      // Retry the request with refreshed token
      response = await fetch(url, options);
      
      if (response.ok) {
        console.log('✅ Request succeeded after token refresh');
      }
    }
  }

  return response;
}
