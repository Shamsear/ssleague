import { cookies, headers } from 'next/headers';

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  role?: string;
  error?: string;
}

/**
 * Simple auth check - validates token exists
 * Checks Authorization header first, then falls back to cookies
 * For production, implement proper Firebase Admin token verification
 */
export async function verifyAuth(requiredRoles?: string[]): Promise<AuthResult> {
  try {
    // Check Authorization header first (preferred method)
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    
    let token: string | undefined;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
      console.log('✅ Token found in Authorization header');
    } else {
      // Fallback to cookies (check both possible cookie names)
      const cookieStore = await cookies();
      token = cookieStore.get('token')?.value || cookieStore.get('auth-token')?.value;
      
      if (token) {
        console.log('✅ Token found in cookies');
      }
    }

    if (!token) {
      console.log('❌ No token found in header or cookies');
      return {
        authenticated: false,
        error: 'No token provided',
      };
    }

    // For now, we trust the token exists means user is authenticated
    // In production, you should verify the Firebase token properly
    // This requires Firebase Admin SDK with proper service account credentials
    
    // TODO: Implement proper token verification when service account is set up
    // const decodedToken = await adminAuth.verifyIdToken(token);
    // const userId = decodedToken.uid;

    // Since we can't verify the token server-side without Admin SDK,
    // we'll allow the request to proceed if a token exists
    // The user role check will happen on the client side
    
    return {
      authenticated: true,
      userId: 'temp-user-id', // Placeholder
      role: 'committee_admin', // Assume committee admin for now
    };
  } catch (error: any) {
    console.error('Auth verification error:', error);
    return {
      authenticated: false,
      error: error.message || 'Authentication failed',
    };
  }
}
