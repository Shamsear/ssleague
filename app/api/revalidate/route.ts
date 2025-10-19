import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * POST /api/revalidate
 * Triggers on-demand revalidation of cached data
 * 
 * This endpoint should be called whenever data changes in Firestore
 * It can be triggered by:
 * 1. Cloud Functions (when Firestore data changes)
 * 2. Admin actions (after updating teams/players)
 * 3. Scheduled jobs (for periodic updates)
 * 
 * Security: Requires REVALIDATE_SECRET to match
 * 
 * Body:
 * {
 *   "secret": "your-secret-key",
 *   "paths": ["/api/cached/teams", "/api/cached/players"],  // Optional: specific paths
 *   "type": "teams" | "players" | "stats" | "all"  // Optional: what to revalidate
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { secret, paths, type = 'all' } = body;
    
    // Verify secret
    const expectedSecret = process.env.REVALIDATE_SECRET;
    if (!expectedSecret) {
      console.error('REVALIDATE_SECRET is not configured');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    if (secret !== expectedSecret) {
      console.error('Invalid revalidation secret');
      return NextResponse.json(
        { success: false, error: 'Invalid secret' },
        { status: 401 }
      );
    }
    
    // Determine what to revalidate
    const pathsToRevalidate: string[] = [];
    
    if (paths && Array.isArray(paths)) {
      pathsToRevalidate.push(...paths);
    } else {
      // Revalidate based on type
      switch (type) {
        case 'teams':
          pathsToRevalidate.push(
            '/api/cached/teams',
            '/api/cached/firebase/team-seasons'
          );
          break;
        case 'players':
          pathsToRevalidate.push('/api/cached/players'); // Neon DB
          break;
        case 'stats':
          pathsToRevalidate.push('/api/cached/stats');
          break;
        case 'fixtures':
          pathsToRevalidate.push('/api/cached/firebase/fixtures');
          break;
        case 'matchups':
          pathsToRevalidate.push('/api/cached/firebase/fixtures'); // Same endpoint
          break;
        case 'seasons':
          pathsToRevalidate.push(
            '/api/cached/firebase/seasons',
            '/api/seasons/list'
          );
          break;
        case 'match-data':
          pathsToRevalidate.push('/api/cached/firebase/match-data');
          break;
        case 'all':
        default:
          pathsToRevalidate.push(
            '/api/cached/teams',
            '/api/cached/players',
            '/api/cached/stats',
            '/api/cached/firebase/team-seasons',
            '/api/cached/firebase/seasons',
            '/api/cached/firebase/fixtures',
            '/api/cached/firebase/match-data',
            '/api/seasons/list'
          );
          break;
      }
    }
    
    // Revalidate all specified paths
    const results: Array<{ path: string; success: boolean; error?: string }> = [];
    
    for (const path of pathsToRevalidate) {
      try {
        revalidatePath(path);
        results.push({ path, success: true });
        console.log(`Successfully revalidated: ${path}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ path, success: false, error: errorMessage });
        console.error(`Failed to revalidate ${path}:`, error);
      }
    }
    
    const allSuccessful = results.every(r => r.success);
    
    return NextResponse.json({
      success: allSuccessful,
      message: allSuccessful 
        ? 'Cache revalidated successfully' 
        : 'Some paths failed to revalidate',
      results,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revalidate',
      },
      { status: 500 }
    );
  }
}

// Also support GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Revalidation endpoint is running',
    timestamp: new Date().toISOString(),
  });
}
