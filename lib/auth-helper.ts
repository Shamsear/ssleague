import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  role?: string;
  error?: string;
}

/**
 * Verify Firebase JWT token and extract user role from custom claims
 * ✅ ZERO DATABASE READS - Uses JWT token claims only
 * 
 * @param requiredRoles - Optional array of roles that are allowed (e.g., ['admin', 'committee_admin'])
 * @param request - Optional NextRequest object to extract token from header
 */
export async function verifyAuth(
  requiredRoles?: string[],
  request?: NextRequest
): Promise<AuthResult> {
  try {
    // Get token from request header (if provided) or cookie
    let token: string | undefined;
    
    if (request) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    // Fallback to cookie if no header token
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('token')?.value;
    }

    if (!token) {
      return {
        authenticated: false,
        error: 'No token provided',
      };
    }

    // ✅ Verify Firebase token (validates signature, expiry, etc.)
    // This does NOT read from database - only validates the JWT
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error: any) {
      console.error('Token verification error:', error);
      return {
        authenticated: false,
        error: 'Invalid or expired token',
      };
    }

    const userId = decodedToken.uid;
    
    // ✅ Get role from custom claims (already in the JWT token - zero DB reads!)
    // Note: Custom claims must be set when user is created/updated
    // See: adminAuth.setCustomUserClaims(uid, { role: 'committee_admin' })
    const role = decodedToken.role as string | undefined;

    // Check if user has required role (if specified)
    if (requiredRoles && requiredRoles.length > 0) {
      if (!role || !requiredRoles.includes(role)) {
        return {
          authenticated: false,
          userId,
          role,
          error: `Access denied. Required roles: ${requiredRoles.join(', ')}`,
        };
      }
    }

    return {
      authenticated: true,
      userId,
      role,
    };
  } catch (error: any) {
    console.error('Auth verification error:', error);
    return {
      authenticated: false,
      error: error.message || 'Authentication failed',
    };
  }
}
