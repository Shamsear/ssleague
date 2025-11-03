import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Clear token cookie (name must match what we set)
    const cookieStore = await cookies();
    cookieStore.delete('token');
    
    console.log('[clear-token API] ✅ Token cookie cleared');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing token:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to clear token' },
      { status: 500 }
    );
  }
}
