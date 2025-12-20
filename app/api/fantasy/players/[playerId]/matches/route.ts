import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const leagueId = searchParams.get('league_id');
    const teamId = searchParams.get('team_id'); // Optional: if provided, use specific team

    console.log('🔍 [Player Matches] Request:', {
      playerId,
      leagueId,
      teamId: teamId || 'not provided'
    });

    if (!leagueId) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL!);
    const fantasyDb = neon(process.env.FANTASY_DATABASE_URL!);

    // Get player's fantasy squad info (captain/VC status)
    // If team_id is provided, use it to get the correct team's data
    const squadInfo = teamId 
      ? await fantasyDb`
          SELECT fs.is_captain, fs.is_vice_captain, fs.team_id
          FROM fantasy_squad fs
          JOIN fantasy_teams ft ON fs.team_id = ft.team_id
          WHERE fs.real_player_id = ${playerId}
          AND fs.team_id = ${teamId}
          AND ft.league_id = ${leagueId}
          LIMIT 1
        `
      : await fantasyDb`
          SELECT fs.is_captain, fs.is_vice_captain, fs.team_id
          FROM fantasy_squad fs
          JOIN fantasy_teams ft ON fs.team_id = ft.team_id
          WHERE fs.real_player_id = ${playerId}
          AND ft.league_id = ${leagueId}
          LIMIT 1
        `;

    if (squadInfo.length === 0) {
      return NextResponse.json(
        { error: 'Player not found in fantasy squad' },
        { status: 404 }
      );
    }

    const isCaptain = squadInfo[0]?.is_captain || false;
    const isViceCaptain = squadInfo[0]?.is_vice_captain || false;

    // Get all completed matchups for this player
    const matchups = await tournamentDb`
      SELECT 
        m.fixture_id,
        m.home_player_id,
        m.home_player_name,
        m.away_player_id,
        m.away_player_name,
        m.home_goals,
        m.away_goals,
        m.position,
        f.motm_player_id,
        f.round_number,
        f.home_team_name,
        f.away_team_name,
        f.status
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE (m.home_player_id = ${playerId} OR m.away_player_id = ${playerId})
        AND f.status = 'completed'
        AND m.home_goals IS NOT NULL
        AND m.away_goals IS NOT NULL
      ORDER BY f.round_number
    `;

    // Get fantasy_player_points records for this player to get actual multipliers
    const playerTeamId = squadInfo[0]?.team_id;
    let playerPointsMap = new Map();
    
    if (playerTeamId) {
      const playerPoints = await fantasyDb`
        SELECT 
          fixture_id,
          points_multiplier,
          base_points,
          total_points
        FROM fantasy_player_points
        WHERE team_id = ${playerTeamId}
          AND real_player_id = ${playerId}
      `;
      
      playerPoints.forEach((p: any) => {
        playerPointsMap.set(p.fixture_id, {
          points_multiplier: p.points_multiplier,
          base_points: p.base_points,
          total_points: p.total_points
        });
      });
    }

    // Process matches
    const matches = matchups.map((m: any) => {
      const isHome = m.home_player_id === playerId;
      const goalsScored = isHome ? m.home_goals : m.away_goals;
      const goalsConceded = isHome ? m.away_goals : m.home_goals;
      const opponentName = isHome ? m.away_team_name : m.home_team_name;
      const cleanSheet = goalsConceded === 0;
      const motm = m.motm_player_id === playerId;
      
      // Get actual points_multiplier from fantasy_player_points
      const pointsData = playerPointsMap.get(m.fixture_id);

      return {
        round_number: m.round_number,
        opponent_name: opponentName,
        goals_scored: goalsScored,
        goals_conceded: goalsConceded,
        clean_sheet: cleanSheet,
        motm: motm,
        is_captain: isCaptain,
        is_vice_captain: isViceCaptain,
        points_multiplier: pointsData?.points_multiplier || (isCaptain ? 200 : isViceCaptain ? 150 : 100),
        base_points: pointsData?.base_points || 0,
        total_points: pointsData?.total_points || 0,
      };
    });

    // Calculate stats
    const totalGoals = matches.reduce((sum: number, m: any) => sum + m.goals_scored, 0);
    const totalCleanSheets = matches.filter((m: any) => m.clean_sheet).length;
    const totalMotm = matches.filter((m: any) => m.motm).length;
    const totalMatches = matches.length;

    // Get total points from fantasy_squad for the specific team
    // playerTeamId is already defined above from squadInfo[0]?.team_id
    
    const pointsData = await fantasyDb`
      SELECT fs.total_points, ft.league_id
      FROM fantasy_squad fs
      JOIN fantasy_teams ft ON fs.team_id = ft.team_id
      WHERE fs.real_player_id = ${playerId}
      AND fs.team_id = ${playerTeamId}
      AND ft.league_id = ${leagueId}
      LIMIT 1
    `;

    console.log('📊 [Player Matches] Points query:', {
      playerId,
      teamId: playerTeamId,
      leagueId,
      result: pointsData[0]
    });

    const totalPoints = pointsData[0]?.total_points || 0;
    const playerLeagueId = pointsData[0]?.league_id;
    const averagePoints = totalMatches > 0 ? (totalPoints / totalMatches).toFixed(1) : '0.0';
    
    // Find best performance
    const bestPerformance = totalPoints; // Simplified - could calculate per-match if needed

    // Get admin bonus points for this player
    console.log('🔍 [Player Matches] Querying admin bonuses for:', {
      target_type: 'player',
      target_id: playerId,
      league_id: playerLeagueId
    });

    const adminBonuses = await fantasyDb`
      SELECT 
        id,
        points,
        reason,
        awarded_at
      FROM bonus_points
      WHERE target_type = 'player'
        AND target_id = ${playerId}
        AND league_id = ${playerLeagueId}
      ORDER BY awarded_at DESC
    `;

    const totalAdminBonus = adminBonuses.reduce((sum: number, b: any) => sum + (b.points || 0), 0);

    console.log('📊 [Player Matches] Admin bonuses found:', {
      count: adminBonuses.length,
      total: totalAdminBonus,
      bonuses: adminBonuses.map(b => ({ reason: b.reason, points: b.points }))
    });

    console.log('📊 [Player Matches] Summary:', {
      total_points_from_db: totalPoints,
      matches_count: totalMatches,
      admin_bonus_total: totalAdminBonus
    });

    return NextResponse.json({
      stats: {
        total_goals: totalGoals,
        total_clean_sheets: totalCleanSheets,
        total_motm: totalMotm,
        total_matches: totalMatches,
        total_points: totalPoints,
        average_points: averagePoints,
        best_performance: bestPerformance,
        total_bonus_points: totalAdminBonus,
      },
      admin_bonuses: adminBonuses.map((bonus: any) => ({
        id: bonus.id,
        points: bonus.points,
        reason: bonus.reason,
        awarded_at: bonus.awarded_at,
      })),
      matches: matches,
    });
  } catch (error: any) {
    console.error('Error fetching player matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player matches', details: error.message },
      { status: 500 }
    );
  }
}
