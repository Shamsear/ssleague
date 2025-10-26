import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/players/populate
 * Populate fantasy_players table from player_seasons in Neon database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, season_id } = body;

    if (!league_id || !season_id) {
      return NextResponse.json(
        { error: 'league_id and season_id are required' },
        { status: 400 }
      );
    }

    console.log(`Populating fantasy_players for league ${league_id}, season ${season_id}...`);

    // Get star pricing for the league
    const pricingResult = await fantasySql`
      SELECT star_rating_prices 
      FROM fantasy_leagues 
      WHERE league_id = ${league_id}
      LIMIT 1
    `;

    const starPricing: Record<number, number> = {};
    if (pricingResult[0]?.star_rating_prices) {
      pricingResult[0].star_rating_prices.forEach((p: any) => {
        starPricing[p.stars] = p.price;
      });
    }

    // Get all players from player_seasons table in Neon
    const sql = getTournamentDb();
    const playersResult = await sql`
      SELECT 
        ps.player_id,
        ps.player_name,
        ps.team_id,
        ps.team,
        ps.star_rating
      FROM player_seasons ps
      WHERE ps.season_id = ${season_id}
    `;

    console.log(`Found ${playersResult.length} players in player_seasons`);

    let insertedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const playerData of playersResult) {
      // Skip if player doesn't have required data
      if (!playerData.player_name) {
        skippedCount++;
        continue;
      }

      try {
        const starRating = playerData.star_rating || 5;
        const draftPrice = starPricing[starRating] || 10;

        await fantasySql`
          INSERT INTO fantasy_players (
            real_player_id,
            league_id,
            player_name,
            real_team_id,
            real_team_name,
            position,
            star_rating,
            draft_price,
            current_price,
            is_available
          ) VALUES (
            ${playerData.player_id},
            ${league_id},
            ${playerData.player_name},
            ${playerData.team_id || ''},
            ${playerData.team || ''},
            'Unknown',
            ${starRating},
            ${draftPrice},
            ${draftPrice},
            true
          )
          ON CONFLICT (league_id, real_player_id)
          DO UPDATE SET
            player_name = EXCLUDED.player_name,
            real_team_id = EXCLUDED.real_team_id,
            real_team_name = EXCLUDED.real_team_name,
            position = EXCLUDED.position,
            star_rating = EXCLUDED.star_rating,
            draft_price = EXCLUDED.draft_price,
            updated_at = CURRENT_TIMESTAMP
        `;

        insertedCount++;
      } catch (error) {
        errors.push(`${playerData.player_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Get final count
    const countResult = await fantasySql`
      SELECT COUNT(*) as count
      FROM fantasy_players
      WHERE league_id = ${league_id}
    `;

    return NextResponse.json({
      success: true,
      message: 'Fantasy players populated successfully',
      stats: {
        found_in_player_seasons: playersResult.length,
        inserted_or_updated: insertedCount,
        skipped: skippedCount,
        errors: errors.length,
        total_in_database: parseInt(countResult[0].count),
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error populating fantasy players:', error);
    return NextResponse.json(
      { 
        error: 'Failed to populate fantasy players',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
