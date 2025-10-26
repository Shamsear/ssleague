/**
 * API Route: Get Team's Historical Stats from Neon
 * Fetches all teamstats records for a specific team across all seasons
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'teamId is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Fetch all teamstats for this team across all seasons
    // Note: Season details (name, status, is_active) come from Firebase
    // This query only gets stats from Neon
    const teamStats = await sql`
      SELECT *
      FROM teamstats
      WHERE team_id = ${teamId}
      ORDER BY season_id DESC
    `;

    return NextResponse.json({
      success: true,
      data: teamStats,
      count: teamStats.length,
    });
  } catch (error: any) {
    console.error('Error fetching team history:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
