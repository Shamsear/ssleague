import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { verifyAuth } from '@/lib/auth-helper';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

/**
 * POST - Manually generate round robin matchups for a fixture
 * Admin/Committee only endpoint
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const { fixtureId } = await params;
    
    // Verify admin/committee auth
    const auth = await verifyAuth(['committee_admin', 'super_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized - Committee admin access required' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;
    const sql = getTournamentDb();
    
    // Get fixture
    const fixtures = await sql`
      SELECT * FROM fixtures WHERE id = ${fixtureId} LIMIT 1
    `;

    if (fixtures.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Fixture not found' },
        { status: 404 }
      );
    }

    const fixture = fixtures[0];
    
    // Check if it's a round robin fixture
    if (fixture.knockout_format !== 'round_robin') {
      return NextResponse.json(
        { success: false, error: 'This fixture is not a round robin format' },
        { status: 400 }
      );
    }
    
    // Check if both lineups exist in the lineups table
    const homeLineups = await sql`
      SELECT * FROM lineups 
      WHERE fixture_id = ${fixtureId} 
      AND team_id = ${fixture.home_team_id}
      LIMIT 1
    `;
    
    const awayLineups = await sql`
      SELECT * FROM lineups 
      WHERE fixture_id = ${fixtureId} 
      AND team_id = ${fixture.away_team_id}
      LIMIT 1
    `;
    
    if (homeLineups.length === 0 || awayLineups.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Both teams must submit lineups before generating matchups' },
        { status: 400 }
      );
    }
    
    const homeLineup = homeLineups[0];
    const awayLineup = awayLineups[0];
    
    // Check if matchups already exist
    const existingMatchups = await sql`
      SELECT COUNT(*) as count FROM matchups WHERE fixture_id = ${fixtureId}
    `;
    
    if (existingMatchups[0].count > 0) {
      return NextResponse.json(
        { success: false, error: 'Matchups already exist for this fixture. Delete them first if you want to regenerate.' },
        { status: 409 }
      );
    }
    
    // Get the 5 starting players from each team (starting_xi array)
    const homePlayerIds = homeLineup.starting_xi || [];
    const awayPlayerIds = awayLineup.starting_xi || [];
    
    if (homePlayerIds.length < 5 || awayPlayerIds.length < 5) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot generate round robin matchups: need at least 5 starting players per team. Found ${homePlayerIds.length} home and ${awayPlayerIds.length} away.` 
        },
        { status: 400 }
      );
    }
    
    // Get player names from player_seasons table
    const allPlayerIds = [...homePlayerIds.slice(0, 5), ...awayPlayerIds.slice(0, 5)];
    const players = await sql`
      SELECT player_id, player_name 
      FROM player_seasons 
      WHERE player_id = ANY(${allPlayerIds})
      AND season_id = ${fixture.season_id}
    `;
    
    // Create a map of player_id to player_name
    const playerMap = new Map(players.map((p: any) => [p.player_id, p.player_name]));
    
    // Take first 5 players from each team
    const homePlayers = homePlayerIds.slice(0, 5).map((id: string) => ({
      player_id: id,
      player_name: playerMap.get(id) || 'Unknown Player'
    }));
    
    const awayPlayers = awayPlayerIds.slice(0, 5).map((id: string) => ({
      player_id: id,
      player_name: playerMap.get(id) || 'Unknown Player'
    }));
    
    // Generate all 25 matchups (5x5)
    let position = 1;
    const matchups = [];
    
    for (let h = 0; h < 5; h++) {
      for (let a = 0; a < 5; a++) {
        matchups.push({
          home_player_id: homePlayers[h].player_id,
          home_player_name: homePlayers[h].player_name,
          away_player_id: awayPlayers[a].player_id,
          away_player_name: awayPlayers[a].player_name,
          position: position++
        });
      }
    }
    
    // Insert all matchups
    for (const matchup of matchups) {
      await sql`
        INSERT INTO matchups (
          fixture_id,
          season_id,
          tournament_id,
          round_number,
          home_player_id,
          home_player_name,
          away_player_id,
          away_player_name,
          position,
          match_duration,
          created_by,
          created_at
        ) VALUES (
          ${fixtureId},
          ${fixture.season_id},
          ${fixture.tournament_id},
          ${fixture.round_number},
          ${matchup.home_player_id},
          ${matchup.home_player_name},
          ${matchup.away_player_id},
          ${matchup.away_player_name},
          ${matchup.position},
          6,
          ${userId},
          NOW()
        )
      `;
    }
    
    // Update fixture to mark matchups as created
    await sql`
      UPDATE fixtures
      SET 
        matchups_created_by = ${userId},
        matchups_created_at = NOW(),
        updated_at = NOW()
      WHERE id = ${fixtureId}
    `;
    
    // Lock both lineups in the lineups table
    await sql`
      UPDATE lineups
      SET 
        is_locked = true,
        locked_at = NOW(),
        locked_by = ${userId},
        updated_at = NOW()
      WHERE fixture_id = ${fixtureId}
      AND team_id IN (${fixture.home_team_id}, ${fixture.away_team_id})
    `;
    
    console.log(`✅ Admin manually generated 25 round robin matchups for fixture ${fixtureId}`);
    
    // Send notification
    try {
      await sendNotificationToSeason(
        {
          title: '⚔️ Round Robin Matchups Created',
          body: `All 25 matchups have been generated by admin for ${fixture.home_team_name} vs ${fixture.away_team_name}. Lineups are now locked.`,
          url: `/fixtures/${fixtureId}`,
          icon: '/logo.png',
          data: {
            type: 'matchups_admin_created',
            fixture_id: fixtureId,
            format: 'round_robin',
            matchup_count: '25'
          }
        },
        fixture.season_id
      );
    } catch (notifError) {
      console.error('Failed to send matchups notification:', notifError);
    }
    
    return NextResponse.json({
      success: true,
      message: '25 round robin matchups generated successfully',
      matchups_count: 25
    });
    
  } catch (error: any) {
    console.error('Error generating round robin matchups:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate matchups' },
      { status: 500 }
    );
  }
}
