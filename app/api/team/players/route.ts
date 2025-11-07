import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { sql } from '@/lib/neon/config';

export async function GET(request: NextRequest) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['team'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const uid = auth.userId!;

    // Get the team's database ID from Neon
    const teamResult = await sql`
      SELECT id FROM teams WHERE firebase_uid = ${uid} LIMIT 1
    `;
    
    if (!teamResult || teamResult.length === 0) {
      // No team found in Neon database - return empty array
      console.log(`No team found in Neon for uid: ${uid}`);
      return NextResponse.json({
        success: true,
        data: {
          players: [],
          count: 0,
        },
      });
    }

    const teamId = teamResult[0].id;

    // Fetch team's won football players from Neon (team_players table)
    const playersResult = await sql`
      SELECT 
        tp.id,
        tp.player_id,
        tp.team_id,
        tp.purchase_price,
        tp.acquired_at,
        fp.name,
        fp.position,
        fp.position_group,
        fp.team_name as nfl_team,
        fp.overall_rating,
        fp.player_id as football_player_id
      FROM team_players tp
      INNER JOIN footballplayers fp ON tp.player_id = fp.id
      WHERE tp.team_id = ${teamId}
      ORDER BY tp.acquired_at DESC
    `;

    const players = playersResult.map(player => ({
      id: player.id,
      name: player.name || '',
      position: player.position || '',
      position_group: player.position_group || '',
      nfl_team: player.nfl_team || '',
      overall_rating: player.overall_rating || 0,
      acquisition_value: player.purchase_price || 0,
      player_id: player.football_player_id || player.player_id || null,
    }));

    console.log(`✅ Fetched ${players.length} players for team ${teamId} (uid: ${uid})`);

    return NextResponse.json({
      success: true,
      data: {
        players,
        count: players.length,
      },
    });

  } catch (error: any) {
    console.error('Error fetching team players:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch players'
      },
      { status: 500 }
    );
  }
}
