import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/awards/eligible
 * Get eligible candidates for awards
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournament_id');
    const seasonId = searchParams.get('season_id');
    const awardType = searchParams.get('award_type');
    const roundNumber = searchParams.get('round_number');
    const weekNumber = searchParams.get('week_number');

    if (!tournamentId || !seasonId || !awardType) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    let candidates: any[] = [];

    switch (awardType) {
      case 'POTD': {
        // Get MOTM winners from fixtures in this round
        if (!roundNumber) {
          return NextResponse.json(
            { success: false, error: 'round_number required for POTD' },
            { status: 400 }
          );
        }

        const fixtures = await sql`
          SELECT 
            f.id as fixture_id,
            f.motm_player_id,
            f.motm_player_name,
            f.home_team_id,
            f.home_team_name,
            f.away_team_id,
            f.away_team_name,
            f.home_score,
            f.away_score
          FROM fixtures f
          WHERE f.season_id = ${seasonId}
            AND f.round = ${parseInt(roundNumber)}
            AND f.motm_player_id IS NOT NULL
            AND f.status = 'completed'
        `;

        // Get player stats for each MOTM
        for (const fixture of fixtures) {
          const playerStats = await sql`
            SELECT 
              ps.player_id,
              ps.player_name,
              ps.team_id,
              ps.goals_scored,
              ps.assists,
              ps.motm_awards
            FROM player_seasons ps
            WHERE ps.player_id = ${fixture.motm_player_id}
              AND ps.season_id = ${seasonId}
          `;

          if (playerStats.length > 0) {
            const stats = playerStats[0];
            candidates.push({
              player_id: fixture.motm_player_id,
              player_name: fixture.motm_player_name,
              team_id: stats.team_id,
              fixture_id: fixture.fixture_id,
              result: `${fixture.home_team_name} ${fixture.home_score}-${fixture.away_score} ${fixture.away_team_name}`,
              performance_stats: {
                goals: stats.goals_scored,
                assists: stats.assists,
                motm_count: stats.motm_awards,
              },
            });
          }
        }
        break;
      }

      case 'POTW': {
        // Get POTD winners from this week
        if (!weekNumber) {
          return NextResponse.json(
            { success: false, error: 'week_number required for POTW' },
            { status: 400 }
          );
        }

        const startRound = (parseInt(weekNumber) - 1) * 7 + 1;
        const endRound = parseInt(weekNumber) * 7;

        const potdWinners = await sql`
          SELECT 
            a.player_id,
            a.player_name,
            a.team_id,
            a.team_name,
            a.round_number,
            a.performance_stats
          FROM awards a
          WHERE a.tournament_id = ${tournamentId}
            AND a.season_id = ${seasonId}
            AND a.award_type = 'POTD'
            AND a.round_number >= ${startRound}
            AND a.round_number <= ${endRound}
          ORDER BY a.round_number
        `;

        // Aggregate stats for each player
        const playerMap = new Map();
        potdWinners.forEach((award: any) => {
          const playerId = award.player_id;
          if (!playerMap.has(playerId)) {
            playerMap.set(playerId, {
              player_id: playerId,
              player_name: award.player_name,
              team_id: award.team_id,
              team_name: award.team_name,
              potd_count: 0,
              rounds: [],
              total_goals: 0,
              total_assists: 0,
            });
          }
          const player = playerMap.get(playerId);
          player.potd_count++;
          player.rounds.push(award.round_number);
          if (award.performance_stats) {
            const stats = typeof award.performance_stats === 'string' 
              ? JSON.parse(award.performance_stats) 
              : award.performance_stats;
            player.total_goals += stats.goals || 0;
            player.total_assists += stats.assists || 0;
          }
        });

        candidates = Array.from(playerMap.values());
        break;
      }

      case 'TOD': {
        // Get teams from fixtures in this round, sorted by performance
        if (!roundNumber) {
          return NextResponse.json(
            { success: false, error: 'round_number required for TOD' },
            { status: 400 }
          );
        }

        const fixtures = await sql`
          SELECT 
            f.home_team_id,
            f.home_team_name,
            f.home_score,
            f.away_team_id,
            f.away_team_name,
            f.away_score
          FROM fixtures f
          WHERE f.season_id = ${seasonId}
            AND f.round = ${parseInt(roundNumber)}
            AND f.status = 'completed'
        `;

        const teamPerformance = new Map();

        fixtures.forEach((fixture: any) => {
          // Home team
          if (!teamPerformance.has(fixture.home_team_id)) {
            teamPerformance.set(fixture.home_team_id, {
              team_id: fixture.home_team_id,
              team_name: fixture.home_team_name,
              goals_for: 0,
              goals_against: 0,
              wins: 0,
              draws: 0,
              losses: 0,
            });
          }
          const homeTeam = teamPerformance.get(fixture.home_team_id);
          homeTeam.goals_for += fixture.home_score;
          homeTeam.goals_against += fixture.away_score;
          if (fixture.home_score > fixture.away_score) homeTeam.wins++;
          else if (fixture.home_score === fixture.away_score) homeTeam.draws++;
          else homeTeam.losses++;

          // Away team
          if (!teamPerformance.has(fixture.away_team_id)) {
            teamPerformance.set(fixture.away_team_id, {
              team_id: fixture.away_team_id,
              team_name: fixture.away_team_name,
              goals_for: 0,
              goals_against: 0,
              wins: 0,
              draws: 0,
              losses: 0,
            });
          }
          const awayTeam = teamPerformance.get(fixture.away_team_id);
          awayTeam.goals_for += fixture.away_score;
          awayTeam.goals_against += fixture.home_score;
          if (fixture.away_score > fixture.home_score) awayTeam.wins++;
          else if (fixture.away_score === fixture.home_score) awayTeam.draws++;
          else awayTeam.losses++;
        });

        candidates = Array.from(teamPerformance.values()).map((team: any) => ({
          team_id: team.team_id,
          team_name: team.team_name,
          performance_stats: {
            goals_for: team.goals_for,
            goals_against: team.goals_against,
            goal_difference: team.goals_for - team.goals_against,
            wins: team.wins,
            draws: team.draws,
            losses: team.losses,
            clean_sheet: team.goals_against === 0,
          },
        }));

        // Sort by goal difference, then goals scored
        candidates.sort((a: any, b: any) => {
          const diffA = a.performance_stats.goal_difference;
          const diffB = b.performance_stats.goal_difference;
          if (diffB !== diffA) return diffB - diffA;
          return b.performance_stats.goals_for - a.performance_stats.goals_for;
        });

        break;
      }

      case 'TOW': {
        // Similar to TOD but for entire week
        if (!weekNumber) {
          return NextResponse.json(
            { success: false, error: 'week_number required for TOW' },
            { status: 400 }
          );
        }

        const startRound = (parseInt(weekNumber) - 1) * 7 + 1;
        const endRound = parseInt(weekNumber) * 7;

        const todWinners = await sql`
          SELECT 
            a.team_id,
            a.team_name,
            a.round_number,
            a.performance_stats
          FROM awards a
          WHERE a.tournament_id = ${tournamentId}
            AND a.season_id = ${seasonId}
            AND a.award_type = 'TOD'
            AND a.round_number >= ${startRound}
            AND a.round_number <= ${endRound}
          ORDER BY a.round_number
        `;

        const teamMap = new Map();
        todWinners.forEach((award: any) => {
          const teamId = award.team_id;
          if (!teamMap.has(teamId)) {
            teamMap.set(teamId, {
              team_id: teamId,
              team_name: award.team_name,
              tod_count: 0,
              rounds: [],
            });
          }
          const team = teamMap.get(teamId);
          team.tod_count++;
          team.rounds.push(award.round_number);
        });

        candidates = Array.from(teamMap.values());
        break;
      }

      case 'POTS':
      case 'TOTS': {
        // For season awards, return all players/teams with season stats
        if (awardType === 'POTS') {
          const players = await sql`
            SELECT 
              ps.player_id,
              ps.player_name,
              ps.team_id,
              ps.goals_scored,
              ps.assists,
              ps.matches_played,
              ps.motm_awards,
              ps.wins,
              ps.draws,
              ps.losses
            FROM player_seasons ps
            WHERE ps.season_id = ${seasonId}
            ORDER BY 
              ps.goals_scored DESC,
              ps.assists DESC,
              ps.motm_awards DESC
            LIMIT 50
          `;

          candidates = players.map((p: any) => ({
            player_id: p.player_id,
            player_name: p.player_name,
            team_id: p.team_id,
            performance_stats: {
              goals: p.goals_scored,
              assists: p.assists,
              matches_played: p.matches_played,
              motm_count: p.motm_awards,
              wins: p.wins,
              draws: p.draws,
              losses: p.losses,
            },
          }));
        } else {
          const teams = await sql`
            SELECT 
              ts.team_id,
              ts.team_name,
              ts.wins,
              ts.draws,
              ts.losses,
              ts.goals_for,
              ts.goals_against
            FROM teamstats ts
            WHERE ts.season_id = ${seasonId}
            ORDER BY 
              ts.wins DESC,
              (ts.goals_for - ts.goals_against) DESC
            LIMIT 20
          `;

          candidates = teams.map((t: any) => ({
            team_id: t.team_id,
            team_name: t.team_name,
            performance_stats: {
              wins: t.wins,
              draws: t.draws,
              losses: t.losses,
              goals_for: t.goals_for,
              goals_against: t.goals_against,
              goal_difference: t.goals_for - t.goals_against,
            },
          }));
        }
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid award type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: candidates,
    });
  } catch (error: any) {
    console.error('Error fetching eligible candidates:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
