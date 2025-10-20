import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    console.log('[Firebase Test] Starting test...');
    
    // Check environment variables
    const envCheck = {
      FIREBASE_ADMIN_PROJECT_ID: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
      FIREBASE_ADMIN_CLIENT_EMAIL: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      FIREBASE_ADMIN_PRIVATE_KEY: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
      projectIdValue: process.env.FIREBASE_ADMIN_PROJECT_ID,
    };
    
    console.log('[Firebase Test] Environment variables:', envCheck);
    
    // Check if adminDb is initialized
    if (!adminDb) {
      return NextResponse.json({
        success: false,
        error: 'Firebase Admin DB not initialized',
        envCheck
      }, { status: 500 });
    }
    
    // Try to access Firestore
    console.log('[Firebase Test] Testing Firestore access...');
    const testDoc = await adminDb.collection('_test').doc('test').get();
    
    console.log('[Firebase Test] Firestore access successful');
    
    return NextResponse.json({
      success: true,
      message: 'Firebase Admin SDK is working',
      envCheck,
      firestoreAccess: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Firebase Test] Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      envCheck: {
        FIREBASE_ADMIN_PROJECT_ID: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
        FIREBASE_ADMIN_CLIENT_EMAIL: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        FIREBASE_ADMIN_PRIVATE_KEY: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
      }
    }, { status: 500 });
  }
}
