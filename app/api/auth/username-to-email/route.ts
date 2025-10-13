import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    // Look up username in usernames collection (server-side has full access)
    const usernameDoc = await adminDb
      .collection('usernames')
      .doc(username.toLowerCase())
      .get();

    if (!usernameDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Username not found' },
        { status: 404 }
      );
    }

    const uid = usernameDoc.data()?.uid;

    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Invalid username data' },
        { status: 500 }
      );
    }

    // Get user document to retrieve email
    const userDoc = await adminDb.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const email = userDoc.data()?.email;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email not found for user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email,
    });
  } catch (error: any) {
    console.error('Error in username-to-email API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
