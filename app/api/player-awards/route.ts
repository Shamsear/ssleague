import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - List player awards for a season
export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    const playerId = searchParams.get('player_id');
    const awardCategory = searchParams.get('award_category'); // 'individual' or 'category'

    let awards;

    if (playerId && seasonId) {
      // Get awards for specific player in season
      awards = await sql`
        SELECT * FROM player_awards
        WHERE player_id = ${playerId} AND season_id = ${seasonId}
        ORDER BY created_at DESC
      `;
    } else if (seasonId) {
      // Get all awards for season (with optional category filter)
      if (awardCategory) {
        awards = await sql`
          SELECT * FROM player_awards
          WHERE season_id = ${seasonId} AND award_category = ${awardCategory}
          ORDER BY award_category, award_type, award_position, created_at DESC
        `;
      } else {
        awards = await sql`
          SELECT * FROM player_awards
          WHERE season_id = ${seasonId}
          ORDER BY award_category, award_type, award_position, created_at DESC
        `;
      }
    } else {
      // Get all awards - player_awards table only
      awards = await sql`
        SELECT * FROM player_awards
        ORDER BY created_at DESC
      `;
    }

    return NextResponse.json({ success: true, awards });
  } catch (error) {
    console.error('Error fetching player awards:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch player awards' },
      { status: 500 }
    );
  }
}
