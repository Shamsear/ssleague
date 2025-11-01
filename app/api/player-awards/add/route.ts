import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { addFantasyPointsForAward } from '@/lib/fantasy-award-points';

// POST - Manually add a player award
export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const body = await request.json();
    const {
      player_id,
      player_name,
      season_id,
      award_category, // 'individual' or 'category'
      award_type,     // 'Golden Boot', 'Best Attacker', etc.
      award_position, // 'Winner', 'Runner Up', 'Third Place'
      player_category, // 'Attacker', 'Midfielder', etc. (for category awards)
      notes
    } = body;

    // Validation
    if (!player_id || !player_name || !season_id || !award_category || !award_type) {
      return NextResponse.json(
        { success: false, error: 'player_id, player_name, season_id, award_category, and award_type are required' },
        { status: 400 }
      );
    }

    // Validate award_category
    if (!['individual', 'category'].includes(award_category)) {
      return NextResponse.json(
        { success: false, error: 'award_category must be "individual" or "category"' },
        { status: 400 }
      );
    }

    // If category award, player_category is required
    if (award_category === 'category' && !player_category) {
      return NextResponse.json(
        { success: false, error: 'player_category is required for category awards' },
        { status: 400 }
      );
    }

    // Insert award
    const result = await sql`
      INSERT INTO player_awards (
        player_id,
        player_name,
        season_id,
        award_category,
        award_type,
        award_position,
        player_category,
        awarded_by,
        notes,
        created_at,
        updated_at
      )
      VALUES (
        ${player_id},
        ${player_name},
        ${season_id},
        ${award_category},
        ${award_type},
        ${award_position || null},
        ${player_category || null},
        'manual',
        ${notes || 'Manually awarded by committee'},
        NOW(),
        NOW()
      )
      ON CONFLICT (player_id, season_id, award_category, award_type, award_position) DO NOTHING
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Award already exists for this player' },
        { status: 409 }
      );
    }

    // Update player_season awards_count
    await sql`
      UPDATE player_season
      SET 
        awards_count = COALESCE(awards_count, 0) + 1,
        updated_at = NOW()
      WHERE player_id = ${player_id} AND season_id = ${season_id}
    `;

    // Add fantasy points if there's a matching fantasy scoring rule
    const fantasyResult = await addFantasyPointsForAward(
      player_id,
      player_name,
      season_id,
      award_type
    );

    console.log('Fantasy points result:', fantasyResult);

    return NextResponse.json({
      success: true,
      award: result[0],
      message: 'Player award added successfully',
      fantasy_points: fantasyResult
    });
  } catch (error: any) {
    console.error('Error adding player award:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add player award' },
      { status: 500 }
    );
  }
}
