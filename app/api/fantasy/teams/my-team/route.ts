import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/fantasy/teams/my-team?user_id=xxx
 * Get the fantasy team for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id query parameter is required' },
        { status: 400 }
      );
    }

    // Get user's fantasy team from PostgreSQL
    const fantasyTeams = await fantasySql`
      SELECT * FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND is_enabled = true
      LIMIT 1
    `;

    if (fantasyTeams.length === 0) {
      // Check if user has a team registered for the current season
      const userDoc = await adminDb.collection('users').doc(user_id).get();
      if (!userDoc.exists) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      const userData = userDoc.data()!;
      const teamName = userData.teamName || userData.username || 'Team';

      // Get current season info
      const tournamentSql = getTournamentDb();
      const primaryTournaments = await tournamentSql`
        SELECT season_id FROM tournaments
        WHERE is_primary = true
        AND status IN ('active', 'upcoming')
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (primaryTournaments.length === 0) {
        return NextResponse.json(
          { 
            error: 'No fantasy league available',
            message: 'No active season found. Fantasy leagues will be available when a new season starts.',
            can_register: false
          },
          { status: 404 }
        );
      }

      const seasonId = primaryTournaments[0].season_id;
      const seasonNumber = seasonId.replace('SSPSLS', '');
      const leagueId = `SSPSLFLS${seasonNumber}`;

      return NextResponse.json(
        { 
          error: 'No fantasy team found',
          message: 'You have not registered for the fantasy league yet.',
          can_register: true,
          registration_info: {
            season_id: seasonId,
            league_id: leagueId,
            team_name: teamName
          }
        },
        { status: 404 }
      );
    }

    const teamData = fantasyTeams[0];
    const teamId = teamData.team_id;
    const leagueId = teamData.league_id;

    // Get drafted players from PostgreSQL
    const squadPlayers = await fantasySql`
      SELECT 
        s.squad_id as draft_id,
        s.real_player_id,
        s.player_name,
        s.position,
        s.real_team_name as team,
        s.purchase_price as draft_price,
        s.total_points,
        s.is_captain,
        s.is_vice_captain
      FROM fantasy_squad s
      WHERE s.team_id = ${teamId}
      ORDER BY s.acquired_at ASC
    `;

    // Get points breakdown for each player
    const draftedPlayers = await Promise.all(
      squadPlayers.map(async (player: any) => {
        // Get player's match-by-match points
        const playerPoints = await fantasySql`
          SELECT 
            COUNT(*) as matches_played,
            SUM(total_points) as total_points
          FROM fantasy_player_points
          WHERE team_id = ${teamId}
            AND real_player_id = ${player.real_player_id}
        `;

        const matchesPlayed = Number(playerPoints[0]?.matches_played || 0);
        const totalPoints = Number(playerPoints[0]?.total_points || player.total_points || 0);
        const averagePoints = matchesPlayed > 0 ? totalPoints / matchesPlayed : 0;

        return {
          draft_id: player.draft_id,
          real_player_id: player.real_player_id,
          player_name: player.player_name,
          position: player.position || 'Unknown',
          team: player.team || 'Unknown',
          draft_price: Number(player.draft_price),
          total_points: totalPoints,
          matches_played: matchesPlayed,
          average_points: Math.round(averagePoints * 10) / 10,
          is_captain: player.is_captain,
          is_vice_captain: player.is_vice_captain,
        };
      })
    );

    // Get recent points (last 5 rounds) from PostgreSQL
    const recentRounds = await fantasySql`
      SELECT 
        round_number as round,
        SUM(total_points) as points
      FROM fantasy_player_points
      WHERE team_id = ${teamId}
        AND round_number IS NOT NULL
      GROUP BY round_number
      ORDER BY round_number DESC
      LIMIT 5
    `;

    // Convert to expected format
    const formattedRounds = recentRounds.map((r: any) => ({
      round: Number(r.round),
      points: Number(r.points),
    }));

    return NextResponse.json({
      success: true,
      team: {
        id: teamId,
        fantasy_league_id: leagueId,
        team_name: teamData.team_name,
        total_points: Number(teamData.total_points) || 0,
        rank: teamData.rank,
        player_count: draftedPlayers.length,
        supported_team_id: teamData.supported_team_id || null,
        supported_team_name: teamData.supported_team_name || null,
        passive_points: Number(teamData.passive_points) || 0,
      },
      players: draftedPlayers,
      recent_rounds: formattedRounds,
    });
  } catch (error) {
    console.error('Error fetching my fantasy team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fantasy team' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fantasy/teams/my-team
 * Register the current user for the fantasy league
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, league_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    // Get user/team info from Firebase
    const userDoc = await adminDb.collection('users').doc(user_id).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data()!;
    const teamName = userData.teamName || userData.username || 'Team';

    // If league_id not provided, get current season
    let finalLeagueId = league_id;
    if (!finalLeagueId) {
      const tournamentSql = getTournamentDb();
      const primaryTournaments = await tournamentSql`
        SELECT season_id FROM tournaments
        WHERE is_primary = true
        AND status IN ('active', 'upcoming')
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (primaryTournaments.length === 0) {
        return NextResponse.json(
          { error: 'No active season found' },
          { status: 404 }
        );
      }

      const seasonId = primaryTournaments[0].season_id;
      const seasonNumber = seasonId.replace('SSPSLS', '');
      finalLeagueId = `SSPSLFLS${seasonNumber}`;
    }

    // Check if fantasy team already exists
    const existingTeams = await fantasySql`
      SELECT * FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND league_id = ${finalLeagueId}
      LIMIT 1
    `;

    if (existingTeams.length > 0) {
      return NextResponse.json(
        { 
          error: 'Fantasy team already exists',
          message: 'You are already registered for this fantasy league',
          team_id: existingTeams[0].team_id
        },
        { status: 400 }
      );
    }

    // Get team ID from Firebase teams collection
    const teamsQuery = await adminDb.collection('teams')
      .where('user_id', '==', user_id)
      .limit(1)
      .get();

    const teamDocId = !teamsQuery.empty ? teamsQuery.docs[0].id : user_id;
    const fantasyTeamId = `${finalLeagueId}_${teamDocId}`;

    // Create fantasy team
    await fantasySql`
      INSERT INTO fantasy_teams (
        team_id,
        league_id,
        team_name,
        owner_uid,
        owner_name,
        total_points,
        rank,
        is_enabled,
        created_at,
        updated_at
      ) VALUES (
        ${fantasyTeamId},
        ${finalLeagueId},
        ${teamName},
        ${user_id},
        ${userData.username || teamName},
        0,
        999,
        true,
        NOW(),
        NOW()
      )
    `;

    // Update Firebase team document
    if (!teamsQuery.empty) {
      await adminDb.collection('teams').doc(teamDocId).update({
        fantasy_participating: true,
        fantasy_league_id: finalLeagueId,
        updated_at: new Date()
      });
    }

    console.log(`✅ Fantasy team registered: ${fantasyTeamId} for ${teamName}`);

    return NextResponse.json({
      success: true,
      message: 'Successfully registered for fantasy league!',
      team: {
        id: fantasyTeamId,
        league_id: finalLeagueId,
        team_name: teamName,
        total_points: 0,
        rank: 999,
        player_count: 0
      }
    });
  } catch (error) {
    console.error('Error registering fantasy team:', error);
    return NextResponse.json(
      { error: 'Failed to register fantasy team', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
