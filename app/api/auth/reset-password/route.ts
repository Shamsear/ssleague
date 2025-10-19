import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
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
        { success: false, error: 'Invalid or expired reset token' },
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
          { success: false, error: 'Reset link has expired. Please request a new one.' },
          { status: 400 }
        );
      }
    }

    // Update the user's password using Firebase Admin SDK
    try {
      await adminAuth.updateUser(requestData.userId, {
        password: newPassword,
      });

      console.log(`✅ Password updated for user: ${requestData.userId}`);
    } catch (authError: any) {
      console.error('Error updating password:', authError);
      return NextResponse.json(
        { success: false, error: `Failed to update password: ${authError.message}` },
        { status: 500 }
      );
    }

    // Mark the reset request as completed
    await adminDb.collection('passwordResetRequests').doc(requestDoc.id).update({
      status: 'completed',
      completedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to reset password',
      },
      { status: 500 }
    );
  }
}
