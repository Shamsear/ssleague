import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;

    // Get distinct round numbers from fixtures table
    const rounds = await sql`
      SELECT DISTINCT 
        round_number,
        MIN(scheduled_date) as start_time,
        MAX(scheduled_date) as end_time
      FROM fixtures
      WHERE tournament_id = ${tournamentId}
        AND round_number IS NOT NULL
      GROUP BY round_number
      ORDER BY round_number ASC
    `;

    // Transform to expected format
    const formattedRounds = rounds.map(r => ({
      id: `${tournamentId}-R${r.round_number}`,
      round_number: r.round_number,
      position: `Round ${r.round_number}`,
      status: 'completed', // Simplified - could check fixture statuses
      start_time: r.start_time,
      end_time: r.end_time,
    }));

    return NextResponse.json({
      success: true,
      rounds: formattedRounds,
    });
  } catch (error: any) {
    console.error('Error fetching tournament rounds:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch tournament rounds',
      },
      { status: 500 }
    );
  }
}
