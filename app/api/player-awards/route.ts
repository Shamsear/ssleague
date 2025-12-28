import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - List player awards for a season
// Season 16+ uses 'awards' table, Season 15 and below uses 'player_awards' table
export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    const playerId = searchParams.get('player_id');
    const awardCategory = searchParams.get('award_category'); // 'individual' or 'category'

    // Determine which table to use based on season number
    const getSeasonNumber = (seasonId: string | null): number => {
      if (!seasonId) return 0;
      const match = seasonId.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    };

    const seasonNumber = getSeasonNumber(seasonId);
    const useNewAwardsTable = seasonNumber >= 16;

    let awards;

    if (playerId && seasonId) {
      // Get awards for specific player in season
      if (useNewAwardsTable) {
        // Season 16+: Query from 'awards' table
        awards = await sql`
          SELECT 
            id,
            award_type,
            season_id,
            round_number,
            week_number,
            player_id,
            player_name,
            team_id,
            team_name,
            performance_stats,
            notes,
            created_at,
            updated_at,
            -- Map fields to match player_awards structure
            award_type as award_category,
            'individual' as award_type_legacy,
            NULL as award_position,
            NULL as player_category,
            NULL as awarded_by
          FROM awards
          WHERE player_id = ${playerId} AND season_id = ${seasonId}
          ORDER BY created_at DESC
        `;
      } else {
        // Season 15 and below: Query from 'player_awards' table
        awards = await sql`
          SELECT * FROM player_awards
          WHERE player_id = ${playerId} AND season_id = ${seasonId}
          ORDER BY created_at DESC
        `;
      }
    } else if (seasonId) {
      // Get all awards for season (with optional category filter)
      if (useNewAwardsTable) {
        // Season 16+: Query from 'awards' table
        awards = await sql`
          SELECT 
            id,
            award_type,
            season_id,
            round_number,
            week_number,
            player_id,
            player_name,
            team_id,
            team_name,
            performance_stats,
            notes,
            created_at,
            updated_at,
            award_type as award_category,
            'individual' as award_type_legacy
          FROM awards
          WHERE season_id = ${seasonId}
          ORDER BY award_type, created_at DESC
        `;
      } else {
        // Season 15 and below: Query from 'player_awards' table
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
      }
    } else {
      // Get all awards - from both tables
      const oldAwards = await sql`
        SELECT * FROM player_awards
        ORDER BY created_at DESC
      `;
      const newAwards = await sql`
        SELECT 
          id,
          award_type as award_category,
          season_id,
          player_id,
          player_name,
          performance_stats,
          notes,
          created_at
        FROM awards
        ORDER BY created_at DESC
      `;
      awards = [...oldAwards, ...newAwards];
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
