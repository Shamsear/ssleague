import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Extract authentication token from request
 * Checks Authorization header first, then falls back to cookie
 * 
 * @param request - Next.js request object
 * @returns Token string or undefined if not found
 */
export async function getAuthToken(request: NextRequest): Promise<string | undefined> {
  // Prefer Authorization header (faster, no cookie delays)
  const authHeader = request.headers.get('authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Fallback to cookie (for server-side pages)
  const cookieStore = await cookies();
  return cookieStore.get('auth-token')?.value;
}
