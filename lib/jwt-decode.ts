/**
 * Decode JWT token locally without Firebase verification
 * This avoids Firebase API calls and reads, suitable for non-sensitive operations
 * 
 * IMPORTANT: Only use this for read-only operations like starred players.
 * For sensitive operations (bids, payments, etc.), use proper Firebase verification.
 */

export interface DecodedToken {
  uid: string;
  user_id?: string;
  email?: string;
  role?: string;
  [key: string]: any;
}

export function decodeJWTLocally(token: string): DecodedToken | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (middle part)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );

    return payload;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Extract Firebase UID from a JWT token
 */
export function getFirebaseUidFromToken(token: string): string | null {
  const decoded = decodeJWTLocally(token);
  if (!decoded) return null;
  
  return decoded.uid || decoded.user_id || null;
}
