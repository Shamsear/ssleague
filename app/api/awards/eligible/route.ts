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
    const skipAwardCheck = searchParams.get('skip_award_check') === 'true'; // For fan polls

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

        console.log(`🔍 Searching for POTD candidates: tournament=${tournamentId}, round=${roundNumber}`);

        // Check if an award has already been given for this round (skip for fan polls)
        if (!skipAwardCheck) {
          const existingAward = await sql`
            SELECT player_id, player_name
            FROM awards
            WHERE tournament_id = ${tournamentId}
              AND award_type = 'POTD'
              AND round_number = ${parseInt(roundNumber)}
          `;

          if (existingAward.length > 0) {
            console.log(`⚠️ POTD award already given for round ${roundNumber} to ${existingAward[0].player_name}`);
            // Return empty candidates list since award is already given
            return NextResponse.json({
              success: true,
              data: [],
              message: 'Award already given for this round'
            });
          }
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
            f.away_score,
            f.status
          FROM fixtures f
          WHERE f.tournament_id = ${tournamentId}
            AND f.round_number = ${parseInt(roundNumber)}
            AND f.status = 'completed'
        `;

        console.log(`📊 Found ${fixtures.length} completed fixtures in round ${roundNumber}`);
        console.log(`🏆 Fixtures with MOTM: ${fixtures.filter((f: any) => f.motm_player_id).length}`);

        // Create candidates from MOTM winners with their match stats
        for (const fixture of fixtures) {
          if (fixture.motm_player_id && fixture.motm_player_name) {
            // Get player's matchup details
            const matchups = await sql`
              SELECT 
                home_player_id,
                away_player_id,
                home_goals,
                away_goals,
                home_player_name,
                away_player_name
              FROM matchups
              WHERE fixture_id = ${fixture.fixture_id}
                AND (home_player_id = ${fixture.motm_player_id} OR away_player_id = ${fixture.motm_player_id})
            `;

            let playerGoals = 0;
            let playerTeam = '';
            let matchupDetails = '';

            if (matchups.length > 0) {
              const matchup = matchups[0];
              if (matchup.home_player_id === fixture.motm_player_id) {
                playerGoals = matchup.home_goals || 0;
                playerTeam = fixture.home_team_name;
                matchupDetails = `${matchup.home_player_name} ${matchup.home_goals}-${matchup.away_goals} ${matchup.away_player_name}`;
              } else {
                playerGoals = matchup.away_goals || 0;
                playerTeam = fixture.away_team_name;
                matchupDetails = `${matchup.home_player_name} ${matchup.home_goals}-${matchup.away_goals} ${matchup.away_player_name}`;
              }
            }

            candidates.push({
              player_id: fixture.motm_player_id,
              player_name: fixture.motm_player_name,
              team_id: fixture.home_team_id,
              team_name: playerTeam,
              fixture_id: fixture.fixture_id,
              result: `${fixture.home_team_name} ${fixture.home_score}-${fixture.away_score} ${fixture.away_team_name}`,
              performance_stats: {
                goals: playerGoals,
                motm: true,
                match_score: `${fixture.home_score}-${fixture.away_score}`,
                matchup: matchupDetails,
              },
            });
          }
        }

        console.log(`✅ Found ${candidates.length} POTD candidates`);
        break;
      }

      case 'POTW': {
        // Get all players who played in this week with their cumulative stats
        if (!weekNumber) {
          return NextResponse.json(
            { success: false, error: 'week_number required for POTW' },
            { status: 400 }
          );
        }

        // Custom week ranges
        const weekRanges: Record<number, { start: number; end: number }> = {
          1: { start: 1, end: 7 },
          2: { start: 8, end: 13 },
          3: { start: 14, end: 20 },
          4: { start: 21, end: 26 },
        };

        const week = parseInt(weekNumber);
        const weekRange = weekRanges[week];

        if (!weekRange) {
          return NextResponse.json(
            { success: false, error: `Invalid week number: ${week}. Valid weeks are 1-4.` },
            { status: 400 }
          );
        }

        const startRound = weekRange.start;
        const endRound = weekRange.end;

        console.log(`🔍 Searching for POTW candidates: week=${weekNumber}, rounds ${startRound}-${endRound}`);

        // Check if an award has already been given for this week (skip for fan polls)
        if (!skipAwardCheck) {
          const existingAward = await sql`
            SELECT player_id, player_name
            FROM awards
            WHERE tournament_id = ${tournamentId}
              AND award_type = 'POTW'
              AND week_number = ${parseInt(weekNumber)}
          `;

          if (existingAward.length > 0) {
            console.log(`⚠️ POTW award already given for week ${weekNumber} to ${existingAward[0].player_name}`);
            return NextResponse.json({
              success: true,
              data: [],
              message: 'Award already given for this week'
            });
          }
        }

        // Get all matchups from this week
        const matchups = await sql`
          SELECT 
            m.home_player_id,
            m.home_player_name,
            m.away_player_id,
            m.away_player_name,
            m.home_goals,
            m.away_goals,
            f.round_number,
            f.home_team_name,
            f.away_team_name
          FROM matchups m
          JOIN fixtures f ON m.fixture_id = f.id
          WHERE f.tournament_id = ${tournamentId}
            AND f.round_number >= ${startRound}
            AND f.round_number <= ${endRound}
            AND f.status = 'completed'
        `;

        // Aggregate stats for each player
        const playerMap = new Map();

        matchups.forEach((matchup: any) => {
          // Process home player
          if (matchup.home_player_id) {
            if (!playerMap.has(matchup.home_player_id)) {
              playerMap.set(matchup.home_player_id, {
                player_id: matchup.home_player_id,
                player_name: matchup.home_player_name,
                team_name: matchup.home_team_name,
                matches_played: 0,
                total_goals: 0,
                rounds_played: new Set(),
              });
            }
            const player = playerMap.get(matchup.home_player_id);
            player.matches_played++;
            player.total_goals += matchup.home_goals || 0;
            player.rounds_played.add(matchup.round_number);
          }

          // Process away player
          if (matchup.away_player_id) {
            if (!playerMap.has(matchup.away_player_id)) {
              playerMap.set(matchup.away_player_id, {
                player_id: matchup.away_player_id,
                player_name: matchup.away_player_name,
                team_name: matchup.away_team_name,
                matches_played: 0,
                total_goals: 0,
                rounds_played: new Set(),
              });
            }
            const player = playerMap.get(matchup.away_player_id);
            player.matches_played++;
            player.total_goals += matchup.away_goals || 0;
            player.rounds_played.add(matchup.round_number);
          }
        });

        // Convert to candidates array and sort by goals
        candidates = Array.from(playerMap.values())
          .map((player: any) => ({
            player_id: player.player_id,
            player_name: player.player_name,
            team_name: player.team_name,
            performance_stats: {
              matches_played: player.matches_played,
              total_goals: player.total_goals,
              rounds_played: Array.from(player.rounds_played).sort(),
              avg_goals: (player.total_goals / player.matches_played).toFixed(2),
            },
          }))
          .sort((a: any, b: any) => b.performance_stats.total_goals - a.performance_stats.total_goals)
          .slice(0, 20); // Top 20 performers

        console.log(`✅ Found ${candidates.length} POTW candidates`);
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

        // Check if an award has already been given for this round (skip for fan polls)
        if (!skipAwardCheck) {
          const existingAward = await sql`
            SELECT team_id, team_name
            FROM awards
            WHERE tournament_id = ${tournamentId}
              AND award_type = 'TOD'
              AND round_number = ${parseInt(roundNumber)}
          `;

          if (existingAward.length > 0) {
            console.log(`⚠️ TOD award already given for round ${roundNumber} to ${existingAward[0].team_name}`);
            return NextResponse.json({
              success: true,
              data: [],
              message: 'Award already given for this round'
            });
          }
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
          WHERE f.tournament_id = ${tournamentId}
            AND f.round_number = ${parseInt(roundNumber)}
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
        // Get teams from fixtures in this week, sorted by cumulative performance
        if (!weekNumber) {
          return NextResponse.json(
            { success: false, error: 'week_number required for TOW' },
            { status: 400 }
          );
        }

        // Custom week ranges
        const weekRanges: Record<number, { start: number; end: number }> = {
          1: { start: 1, end: 7 },
          2: { start: 8, end: 13 },
          3: { start: 14, end: 20 },
          4: { start: 21, end: 26 },
        };

        const week = parseInt(weekNumber);
        const weekRange = weekRanges[week];

        if (!weekRange) {
          return NextResponse.json(
            { success: false, error: `Invalid week number: ${week}. Valid weeks are 1-4.` },
            { status: 400 }
          );
        }

        const startRound = weekRange.start;
        const endRound = weekRange.end;

        console.log(`🔍 Searching for TOW candidates: week=${weekNumber}, rounds ${startRound}-${endRound}`);

        // Check if an award has already been given for this week (skip for fan polls)
        if (!skipAwardCheck) {
          const existingAward = await sql`
            SELECT team_id, team_name
            FROM awards
            WHERE tournament_id = ${tournamentId}
              AND award_type = 'TOW'
              AND week_number = ${parseInt(weekNumber)}
          `;

          if (existingAward.length > 0) {
            console.log(`⚠️ TOW award already given for week ${weekNumber} to ${existingAward[0].team_name}`);
            return NextResponse.json({
              success: true,
              data: [],
              message: 'Award already given for this week'
            });
          }
        }

        const fixtures = await sql`
          SELECT 
            f.home_team_id,
            f.home_team_name,
            f.home_score,
            f.away_team_id,
            f.away_team_name,
            f.away_score,
            f.round_number
          FROM fixtures f
          WHERE f.tournament_id = ${tournamentId}
            AND f.round_number >= ${startRound}
            AND f.round_number <= ${endRound}
            AND f.status = 'completed'
        `;

        console.log(`📊 Found ${fixtures.length} completed fixtures in week ${weekNumber}`);

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
              matches_played: 0,
              rounds_played: new Set(),
            });
          }
          const homeTeam = teamPerformance.get(fixture.home_team_id);
          homeTeam.goals_for += fixture.home_score;
          homeTeam.goals_against += fixture.away_score;
          homeTeam.matches_played++;
          homeTeam.rounds_played.add(fixture.round_number);
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
              matches_played: 0,
              rounds_played: new Set(),
            });
          }
          const awayTeam = teamPerformance.get(fixture.away_team_id);
          awayTeam.goals_for += fixture.away_score;
          awayTeam.goals_against += fixture.home_score;
          awayTeam.matches_played++;
          awayTeam.rounds_played.add(fixture.round_number);
          if (fixture.away_score > fixture.home_score) awayTeam.wins++;
          else if (fixture.away_score === fixture.home_score) awayTeam.draws++;
          else awayTeam.losses++;
        });

        candidates = Array.from(teamPerformance.values()).map((team: any) => ({
          team_id: team.team_id,
          team_name: team.team_name,
          performance_stats: {
            matches_played: team.matches_played,
            goals_for: team.goals_for,
            goals_against: team.goals_against,
            goal_difference: team.goals_for - team.goals_against,
            wins: team.wins,
            draws: team.draws,
            losses: team.losses,
            rounds_played: Array.from(team.rounds_played).sort(),
            points: (team.wins * 3) + team.draws,
            clean_sheets: team.goals_against === 0 ? 1 : 0,
          },
        }));

        // Sort by points, then goal difference, then goals scored
        candidates.sort((a: any, b: any) => {
          if (b.performance_stats.points !== a.performance_stats.points) {
            return b.performance_stats.points - a.performance_stats.points;
          }
          if (b.performance_stats.goal_difference !== a.performance_stats.goal_difference) {
            return b.performance_stats.goal_difference - a.performance_stats.goal_difference;
          }
          return b.performance_stats.goals_for - a.performance_stats.goals_for;
        });

        console.log(`✅ Found ${candidates.length} TOW candidates`);
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
