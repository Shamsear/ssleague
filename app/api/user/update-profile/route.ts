import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { getAuthToken } from '@/lib/auth/token-helper';

export async function POST(request: NextRequest) {
  try {
    // Get token from Authorization header or cookie
    const token = await getAuthToken(request);

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - No token' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err) {
      console.error('Token verification error:', err);
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const body = await request.json();
    const { displayName } = body;

    if (!displayName) {
      return NextResponse.json(
        { success: false, message: 'Display name is required' },
        { status: 400 }
      );
    }

    // Update Firebase user profile
    await adminAuth.updateUser(userId, {
      displayName: displayName.trim(),
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}
