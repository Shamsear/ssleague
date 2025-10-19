import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Find the password reset request by token
    const requestsSnapshot = await adminDb
      .collection('passwordResetRequests')
      .where('resetToken', '==', token)
      .where('status', '==', 'approved')
      .limit(1)
      .get();

    if (requestsSnapshot.empty) {
      return NextResponse.json(
        { success: false, valid: false, error: 'Invalid or expired reset token' },
        { status: 404 }
      );
    }

    const requestDoc = requestsSnapshot.docs[0];
    const requestData = requestDoc.data();

    // Check if token is expired
    if (requestData.resetLinkExpiresAt) {
      const expiresAt = requestData.resetLinkExpiresAt.toDate();
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { success: false, valid: false, error: 'Reset link has expired' },
          { status: 400 }
        );
      }
    }

    // Return validated request data
    return NextResponse.json({
      success: true,
      valid: true,
      request: {
        id: requestDoc.id,
        userId: requestData.userId,
        userEmail: requestData.userEmail,
        username: requestData.username,
        teamName: requestData.teamName,
        status: requestData.status,
      },
    });
  } catch (error: any) {
    console.error('Error validating reset token:', error);
    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: error.message || 'Failed to validate reset token',
      },
      { status: 500 }
    );
  }
}
