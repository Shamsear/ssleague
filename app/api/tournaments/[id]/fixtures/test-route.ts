import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// Simple test endpoint
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        console.log('=== FIXTURES GET ENDPOINT CALLED ===');
        const { id: tournamentId } = await params;
        console.log('Tournament ID:', tournamentId);

        const sql = getTournamentDb();
        console.log('Database connection obtained');

        const fixtures = await sql`
      SELECT *
      FROM fixtures
      WHERE tournament_id = ${tournamentId}
      ORDER BY round_number ASC, match_number ASC
    `;

        console.log('Fixtures fetched:', fixtures.length);

        return NextResponse.json({ success: true, fixtures });
    } catch (error: any) {
        console.error('=== ERROR IN FIXTURES GET ===');
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch fixtures' },
            { status: 500 }
        );
    }
}
