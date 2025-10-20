import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

// Vercel function timeout configuration
export const maxDuration = 10; // 10 seconds max

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('[username-to-email API] Request started');
    console.log('[username-to-email API] Environment check:', {
      hasAdminDb: !!adminDb,
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      hasClientEmail: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY
    });
    
    const { username } = await request.json();
    console.log('[username-to-email API] Username received:', username);

    if (!username) {
      console.log('[username-to-email API] No username provided');
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    // Look up username in usernames collection (server-side has full access)
    console.log('[username-to-email API] Looking up username in Firestore');
    const usernameDoc = await adminDb
      .collection('usernames')
      .doc(username.toLowerCase())
      .get();
    
    console.log('[username-to-email API] Username doc exists:', usernameDoc.exists);

    if (!usernameDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Username not found' },
        { status: 404 }
      );
    }

    const uid = usernameDoc.data()?.uid;
    console.log('[username-to-email API] UID found:', !!uid);

    if (!uid) {
      console.log('[username-to-email API] No UID in username document');
      return NextResponse.json(
        { success: false, error: 'Invalid username data' },
        { status: 500 }
      );
    }

    // Get user document to retrieve email
    console.log('[username-to-email API] Fetching user document');
    const userDoc = await adminDb.collection('users').doc(uid).get();
    console.log('[username-to-email API] User doc exists:', userDoc.exists);

    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const email = userDoc.data()?.email;
    console.log('[username-to-email API] Email found:', !!email);

    if (!email) {
      console.log('[username-to-email API] No email in user document');
      return NextResponse.json(
        { success: false, error: 'Email not found for user' },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[username-to-email API] Success in ${duration}ms`);
    
    return NextResponse.json({
      success: true,
      email,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[username-to-email API] Error after ${duration}ms:`, {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
