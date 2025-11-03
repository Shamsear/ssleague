import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    console.log('[set-token API] Request received');
    
    // Check if request has a body
    const text = await request.text();
    if (!text) {
      console.log('[set-token API] Empty request body');
      return NextResponse.json(
        { success: false, message: 'Request body is required' },
        { status: 400 }
      );
    }
    
    const { token } = JSON.parse(text);
    console.log('[set-token API] Token extracted, length:', token?.length);

    if (!token) {
      console.log('[set-token API] No token provided');
      return NextResponse.json(
        { success: false, message: 'Token is required' },
        { status: 400 }
      );
    }

    // Set token in HTTP-only cookie (name must match what endpoints expect)
    const cookieStore = await cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    
    console.log('[set-token API] ✅ Token cookie set successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting token:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to set token' },
      { status: 500 }
    );
  }
}
