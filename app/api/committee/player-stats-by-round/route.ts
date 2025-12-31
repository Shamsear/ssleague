import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/committee/player-stats-by-round
 * Get player statistics calculated from matchups table for a specific round or all rounds
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournament_id');
    const seasonId = searchParams.get('season_id');
    const roundNumber = searchParams.get('round_number'); // Optional: specific round or 'all'
    const startRound = searchParams.get('start_round'); // Optional: for range filtering
    const endRound = searchParams.get('end_round'); // Optional: for range filtering

    if (!tournamentId || !seasonId) {
      return NextResponse.json(
        { error: 'Missing required parameters: tournament_id and season_id' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    console.log(`[Player Stats By Round] Fetching stats for tournament=${tournamentId}, season=${seasonId}, round=${roundNumber}, range=${startRound}-${endRound}`);

    // Get all matchups with fixture information
    let matchups;

    if (startRound && endRound) {
      // Filter by round range (e.g., rounds 8-13 for Week 2)
      const startNum = parseInt(startRound);
      const endNum = parseInt(endRound);
      console.log(`[Player Stats By Round] Filtering by rounds ${startNum} to ${endNum} (range)`);
      matchups = await sql`
        SELECT 
          m.home_player_id,
          m.home_player_name,
          m.away_player_id,
          m.away_player_name,
          m.home_goals,
          m.away_goals,
          f.round_number,
          f.home_team_id,
          f.home_team_name,
          f.away_team_id,
          f.away_team_name,
          f.motm_player_id,
          f.status
        FROM matchups m
        JOIN fixtures f ON m.fixture_id = f.id
        WHERE f.tournament_id = ${tournamentId}
          AND f.season_id = ${seasonId}
          AND f.round_number >= ${startNum}
          AND f.round_number <= ${endNum}
          AND f.status = 'completed'
        ORDER BY f.round_number, m.home_player_name
      `;
      console.log(`[Player Stats By Round] Found ${matchups.length} matchups for rounds ${startNum}-${endNum}`);
    } else if (roundNumber && roundNumber !== 'all') {
      // Filter by rounds up to and including the selected round (cumulative)
      const roundNum = parseInt(roundNumber);
      console.log(`[Player Stats By Round] Filtering by rounds 1 to ${roundNum} (cumulative)`);
      matchups = await sql`
        SELECT 
          m.home_player_id,
          m.home_player_name,
          m.away_player_id,
          m.away_player_name,
          m.home_goals,
          m.away_goals,
          f.round_number,
          f.home_team_id,
          f.home_team_name,
          f.away_team_id,
          f.away_team_name,
          f.motm_player_id,
          f.status
        FROM matchups m
        JOIN fixtures f ON m.fixture_id = f.id
        WHERE f.tournament_id = ${tournamentId}
          AND f.season_id = ${seasonId}
          AND f.round_number <= ${roundNum}
          AND f.status = 'completed'
        ORDER BY f.round_number, m.home_player_name
      `;
      console.log(`[Player Stats By Round] Found ${matchups.length} matchups for rounds 1-${roundNum}`);
    } else {
      // Get all rounds
      console.log(`[Player Stats By Round] Fetching all rounds`);
      matchups = await sql`
        SELECT 
          m.home_player_id,
          m.home_player_name,
          m.away_player_id,
          m.away_player_name,
          m.home_goals,
          m.away_goals,
          f.round_number,
          f.home_team_id,
          f.home_team_name,
          f.away_team_id,
          f.away_team_name,
          f.motm_player_id,
          f.status
        FROM matchups m
        JOIN fixtures f ON m.fixture_id = f.id
        WHERE f.tournament_id = ${tournamentId}
          AND f.season_id = ${seasonId}
          AND f.status = 'completed'
        ORDER BY f.round_number, m.home_player_name
      `;
      console.log(`[Player Stats By Round] Found ${matchups.length} total matchups`);
    }

    // Aggregate stats for each player
    const playerStatsMap = new Map<string, any>();

    matchups.forEach((matchup: any) => {
      // Process home player
      if (matchup.home_player_id && matchup.home_player_name) {
        if (!playerStatsMap.has(matchup.home_player_id)) {
          playerStatsMap.set(matchup.home_player_id, {
            player_id: matchup.home_player_id,
            player_name: matchup.home_player_name,
            team_name: matchup.home_team_name,
            matches_played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goals_scored: 0,
            goals_conceded: 0,
            clean_sheets: 0,
            motm_awards: 0,
            points: 0, // Track points based on GD per match
            rounds_played: new Set(),
          });
        }

        const player = playerStatsMap.get(matchup.home_player_id);
        player.matches_played++;
        player.goals_scored += matchup.home_goals || 0;
        player.goals_conceded += matchup.away_goals || 0;
        player.rounds_played.add(matchup.round_number);

        // Calculate goal difference for this match
        const matchGD = (matchup.home_goals || 0) - (matchup.away_goals || 0);
        // Cap points at +5 or -5 per match
        const matchPoints = Math.max(-5, Math.min(5, matchGD));
        player.points += matchPoints;

        if (matchup.home_goals > matchup.away_goals) player.wins++;
        else if (matchup.home_goals === matchup.away_goals) player.draws++;
        else player.losses++;

        if (matchup.away_goals === 0) player.clean_sheets++;
        if (matchup.motm_player_id === matchup.home_player_id) player.motm_awards++;
      }

      // Process away player
      if (matchup.away_player_id && matchup.away_player_name) {
        if (!playerStatsMap.has(matchup.away_player_id)) {
          playerStatsMap.set(matchup.away_player_id, {
            player_id: matchup.away_player_id,
            player_name: matchup.away_player_name,
            team_name: matchup.away_team_name,
            matches_played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goals_scored: 0,
            goals_conceded: 0,
            clean_sheets: 0,
            motm_awards: 0,
            points: 0, // Track points based on GD per match
            rounds_played: new Set(),
          });
        }

        const player = playerStatsMap.get(matchup.away_player_id);
        player.matches_played++;
        player.goals_scored += matchup.away_goals || 0;
        player.goals_conceded += matchup.home_goals || 0;
        player.rounds_played.add(matchup.round_number);

        // Calculate goal difference for this match
        const matchGD = (matchup.away_goals || 0) - (matchup.home_goals || 0);
        // Cap points at +5 or -5 per match
        const matchPoints = Math.max(-5, Math.min(5, matchGD));
        player.points += matchPoints;

        if (matchup.away_goals > matchup.home_goals) player.wins++;
        else if (matchup.away_goals === matchup.home_goals) player.draws++;
        else player.losses++;

        if (matchup.home_goals === 0) player.clean_sheets++;
        if (matchup.motm_player_id === matchup.away_player_id) player.motm_awards++;
      }
    });

    // Convert to array and calculate derived stats
    const playerStats = Array.from(playerStatsMap.values()).map((player) => {
      const winRate = player.matches_played > 0
        ? Math.round((player.wins / player.matches_played) * 100 * 10) / 10
        : 0;

      const goalDifference = player.goals_scored - player.goals_conceded;

      return {
        player_id: player.player_id,
        player_name: player.player_name,
        team_name: player.team_name,
        matches_played: player.matches_played,
        wins: player.wins,
        draws: player.draws,
        losses: player.losses,
        goals_scored: player.goals_scored,
        goals_conceded: player.goals_conceded,
        goal_difference: goalDifference,
        clean_sheets: player.clean_sheets,
        motm_awards: player.motm_awards,
        win_rate: winRate,
        points: player.points, // Use tracked points from matchups
        rounds_played: Array.from(player.rounds_played).sort((a, b) => a - b),
      };
    });

    // Sort by points, then goal difference, then goals scored
    playerStats.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      return b.goals_scored - a.goals_scored;
    });

    console.log(`[Player Stats By Round] Returning ${playerStats.length} players for round ${roundNumber || 'all'}`);
    if (playerStats.length > 0) {
      console.log(`[Player Stats By Round] Sample player:`, {
        name: playerStats[0].player_name,
        matches: playerStats[0].matches_played,
        wins: playerStats[0].wins,
        rounds: playerStats[0].rounds_played
      });
    }

    return NextResponse.json({
      success: true,
      players: playerStats,
      round_filter: roundNumber || 'all',
      total_players: playerStats.length,
    });
  } catch (error) {
    console.error('Error fetching player stats by round:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch player statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
