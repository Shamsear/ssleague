import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { username, reason } = await request.json();

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    // Find user by username
    const usernameDoc = await adminDb
      .collection('usernames')
      .doc(username.toLowerCase())
      .get();

    if (!usernameDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found with this username' },
        { status: 404 }
      );
    }

    const userId = usernameDoc.data()?.uid;

    // Get user details
    const userDoc = await adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User account not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    // Check if user already has a pending request
    const existingRequestQuery = await adminDb
      .collection('passwordResetRequests')
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existingRequestQuery.empty) {
      return NextResponse.json(
        { success: false, error: 'You already have a pending password reset request' },
        { status: 400 }
      );
    }

    // Create password reset request
    const requestData = {
      userId: userId,
      userEmail: userData.email,
      username: userData.username,
      teamName: userData.role === 'team' ? userData.teamName : null,
      reason: reason || null,
      status: 'pending',
      requestedAt: new Date(),
    };

    await adminDb.collection('passwordResetRequests').add(requestData);

    console.log(`✅ Password reset request created for user: ${username}`);

    return NextResponse.json({
      success: true,
      message: 'Password reset request submitted successfully',
    });
  } catch (error: any) {
    console.error('Error creating password reset request:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to submit password reset request',
      },
      { status: 500 }
    );
  }
}
