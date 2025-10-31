import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Clear token cookie
    const cookieStore = await cookies();
    cookieStore.delete('auth-token');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing token:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to clear token' },
      { status: 500 }
    );
  }
}
