import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';

/**
 * Set custom claims for a user's JWT token
 * This enables role-based authentication without database reads
 * POST /api/auth/set-custom-claims
 * 
 * Required: super_admin role
 */
export async function POST(request: NextRequest) {
  try {
    // Verify super admin authentication
    const auth = await verifyAuth(['super_admin'], request);
    
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { uid, role } = await request.json();

    if (!uid || !role) {
      return NextResponse.json(
        { success: false, error: 'Missing uid or role' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['team', 'committee_admin', 'super_admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Get current custom claims
    const user = await adminAuth.getUser(uid);
    const currentClaims = user.customClaims || {};

    // Set custom claims
    await adminAuth.setCustomUserClaims(uid, {
      ...currentClaims,
      role: role,
    });

    console.log(`✅ Custom claims set for user ${uid}: role=${role}`);

    return NextResponse.json({
      success: true,
      message: 'Custom claims set successfully',
      uid,
      role,
    });
  } catch (error: any) {
    console.error('Error setting custom claims:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to set custom claims' },
      { status: 500 }
    );
  }
}
