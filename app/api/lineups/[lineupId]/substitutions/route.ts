import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lineupId } = await params;
    
    const sql = getTournamentDb();
    
    // Get all substitutions for this lineup
    const substitutions = await sql`
      SELECT *
      FROM lineup_substitutions
      WHERE lineup_id = ${lineupId}
      ORDER BY made_at ASC
    `;

    return NextResponse.json({
      success: true,
      substitutions: substitutions
    });
  } catch (error: any) {
    console.error('Error fetching substitution history:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch substitution history' },
      { status: 500 }
    );
  }
}
