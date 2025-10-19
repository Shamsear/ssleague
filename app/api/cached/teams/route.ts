import { NextResponse } from 'next/server';
import { buildTeamsSummary } from '@/lib/firebase/aggregates';

/**
 * GET /api/cached/teams
 * Returns aggregated teams data with ISR caching
 * 
 * Query params:
 * - seasonId: Filter by season (optional)
 * 
 * This endpoint uses Next.js caching with revalidation
 * Data is cached and only rebuilt when:
 * 1. The revalidation time expires (900 seconds = 15 minutes)
 * 2. On-demand revalidation is triggered via /api/revalidate
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId') || undefined;
    
    // Build teams summary from Firestore
    const teams = await buildTeamsSummary(seasonId);
    
    return NextResponse.json(
      {
        success: true,
        data: teams,
        cached: true,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
          'CDN-Cache-Control': 'public, s-maxage=900',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=900',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching teams summary:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch teams',
      },
      { status: 500 }
    );
  }
}

// Opt into static generation with revalidation
export const revalidate = 900; // Revalidate every 15 minutes
export const dynamic = 'force-static'; // Force static generation
