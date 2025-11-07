import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(['team', 'committee'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, message: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;
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
