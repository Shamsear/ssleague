import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const maxDuration = 10;

export async function GET() {
  try {
    console.log('[Neon Test] Starting test...');
    
    const hasNeonUrl = !!process.env.NEON_DATABASE_URL;
    console.log('[Neon Test] NEON_DATABASE_URL exists:', hasNeonUrl);
    
    if (!hasNeonUrl) {
      return NextResponse.json({
        success: false,
        error: 'NEON_DATABASE_URL environment variable is missing',
        hint: 'Add it to Vercel environment variables'
      }, { status: 500 });
    }
    
    // Try to connect to Neon
    const sql = neon(process.env.NEON_DATABASE_URL!);
    
    console.log('[Neon Test] Testing database query...');
    const result = await sql`SELECT NOW() as current_time`;
    
    console.log('[Neon Test] Query successful:', result);
    
    return NextResponse.json({
      success: true,
      message: 'Neon database connection is working',
      currentTime: result[0].current_time,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Neon Test] Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      hasNeonUrl: !!process.env.NEON_DATABASE_URL
    }, { status: 500 });
  }
}
