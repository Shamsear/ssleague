import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
    try {
        const sql = fantasySql;
        const tournamentSql = getTournamentDb();

        // Get the most recent fantasy league
        const leagues = await sql`
      SELECT league_id, season_id, is_active
      FROM fantasy_leagues
      ORDER BY created_at DESC
      LIMIT 1
    `;

        if (leagues.length === 0) {
            return NextResponse.json({
                success: true,
                teams: [],
                maxRounds: 0,
                message: 'No fantasy leagues found in the system'
            });
        }

        const league = leagues[0];

        // Get all fantasy teams with their supported teams
        const teams = await sql`
      SELECT 
        ft.team_id,
        ft.owner_name,
        ft.team_name,
        ft.passive_points,
        ft.total_points,
        ft.player_points,
        ft.supported_team_id,
        ft.supported_team_name
      FROM fantasy_teams ft
      WHERE ft.league_id = ${league.league_id}
      ORDER BY ft.total_points DESC, ft.team_name
    `;

        // Get max rounds from fixtures
        const maxRoundsResult = await tournamentSql`
      SELECT MAX(round_number) as max_round
      FROM fixtures
      WHERE season_id = ${league.season_id}
        AND status = 'completed'
    `;
        const maxRounds = maxRoundsResult[0]?.max_round || 0;

        // Get all player squad members
        const squadMembers = await sql`
      SELECT 
        fs.team_id,
        fs.real_player_id as player_id,
        fs.player_name
      FROM fantasy_squad fs
      WHERE fs.league_id = ${league.league_id}
      ORDER BY fs.team_id, fs.player_name
    `;

        // Get all player points by round
        const playerPoints = await sql`
      SELECT 
        fpp.team_id,
        fpp.real_player_id as player_id,
        fpp.round_number,
        fpp.total_points
      FROM fantasy_player_points fpp
      WHERE fpp.league_id = ${league.league_id}
      ORDER BY fpp.team_id, fpp.real_player_id, fpp.round_number
    `;

        // Get team passive bonus points with breakdown
        const teamBonusPoints = await sql`
      SELECT 
        ftb.team_id,
        ftb.round_number,
        ftb.fixture_id,
        ftb.total_bonus,
        ftb.bonus_breakdown,
        ftb.real_team_name
      FROM fantasy_team_bonus_points ftb
      WHERE ftb.league_id = ${league.league_id}
      ORDER BY ftb.team_id, ftb.round_number
    `;

        // Get fixture details for passive points context
        const fixtureIds = [...new Set(teamBonusPoints.map((b: any) => b.fixture_id))];
        const fixtures = fixtureIds.length > 0 ? await tournamentSql`
      SELECT 
        f.id as fixture_id,
        f.home_team_id,
        f.away_team_id,
        f.round_number,
        f.home_team_name,
        f.away_team_name
      FROM fixtures f
      WHERE f.id = ANY(${fixtureIds})
    ` : [];

        // Get matchup results for each fixture
        const matchups = fixtureIds.length > 0 ? await tournamentSql`
      SELECT 
        m.fixture_id,
        SUM(m.home_goals) as home_goals,
        SUM(m.away_goals) as away_goals
      FROM matchups m
      WHERE m.fixture_id = ANY(${fixtureIds})
      GROUP BY m.fixture_id
    ` : [];

        // Create fixture map with results
        const fixtureMap = new Map();
        fixtures.forEach((f: any) => {
            const matchup = matchups.find((m: any) => m.fixture_id === f.fixture_id);
            fixtureMap.set(f.fixture_id, {
                ...f,
                home_goals: matchup?.home_goals || 0,
                away_goals: matchup?.away_goals || 0
            });
        });

        // Get unique player IDs from points
        const allPlayerIds = [...new Set(playerPoints.map((pp: any) => pp.player_id))];
        const playerNames = new Map<string, string>();

        if (allPlayerIds.length > 0) {
            const players = await tournamentSql`
        SELECT DISTINCT player_id, player_name
        FROM realplayerstats
        WHERE player_id = ANY(${allPlayerIds})
      `;

            players.forEach((p: any) => {
                playerNames.set(p.player_id, p.player_name);
            });
        }

        // Build team breakdowns
        const teamBreakdowns = teams.map((team: any) => {
            // Build player points map
            const playerMap = new Map<string, any>();

            playerPoints
                .filter((pp: any) => pp.team_id === team.team_id)
                .forEach((pp: any) => {
                    if (!playerMap.has(pp.player_id)) {
                        const squadMember = squadMembers.find((sm: any) =>
                            sm.team_id === team.team_id && sm.player_id === pp.player_id
                        );
                        playerMap.set(pp.player_id, {
                            player_id: pp.player_id,
                            player_name: squadMember?.player_name || playerNames.get(pp.player_id) || 'Unknown Player',
                            is_active: !!squadMember,
                            rounds: [],
                            total_points: 0,
                        });
                    }

                    const player = playerMap.get(pp.player_id);
                    const points = pp.total_points || 0;

                    player.rounds.push({
                        round: pp.round_number,
                        points: points,
                        status: player.is_active ? 'active' : 'released'
                    });

                    player.total_points += points;
                });

            // Build passive points breakdown by round
            const passiveByRound: any[] = [];
            for (let round = 1; round <= maxRounds; round++) {
                const roundBonuses = teamBonusPoints.filter((tb: any) =>
                    tb.team_id === team.team_id && tb.round_number === round
                );

                const roundTotal = roundBonuses.reduce((sum: number, b: any) => sum + (b.total_bonus || 0), 0);

                const matches = roundBonuses.map((bonus: any) => {
                    const fixture = fixtureMap.get(bonus.fixture_id);
                    const breakdown = typeof bonus.bonus_breakdown === 'string'
                        ? JSON.parse(bonus.bonus_breakdown)
                        : bonus.bonus_breakdown;

                    return {
                        fixture_id: bonus.fixture_id,
                        supported_team: bonus.real_team_name,
                        opponent: fixture ? (
                            fixture.home_team_id === team.supported_team_id
                                ? fixture.away_team_name
                                : fixture.home_team_name
                        ) : 'Unknown',
                        score: fixture ? (
                            fixture.home_team_id === team.supported_team_id
                                ? `${fixture.home_goals}-${fixture.away_goals}`
                                : `${fixture.away_goals}-${fixture.home_goals}`
                        ) : 'N/A',
                        home_away: fixture ? (
                            fixture.home_team_id === team.supported_team_id ? 'H' : 'A'
                        ) : 'N/A',
                        bonus_points: bonus.total_bonus || 0,
                        breakdown: breakdown || {}
                    };
                });

                passiveByRound.push({
                    round,
                    total_passive: roundTotal,
                    matches
                });
            }

            // Calculate round totals (active + passive)
            const roundTotals: any[] = [];
            for (let round = 1; round <= maxRounds; round++) {
                let roundActiveTotal = 0;

                playerMap.forEach(player => {
                    const roundData = player.rounds.find((r: any) => r.round === round);
                    if (roundData) {
                        roundActiveTotal += roundData.points;
                    }
                });

                const passiveData = passiveByRound.find(p => p.round === round);
                const roundPassiveTotal = passiveData?.total_passive || 0;

                roundTotals.push({
                    round,
                    active_points: roundActiveTotal,
                    passive_points: roundPassiveTotal,
                    total_points: roundActiveTotal + roundPassiveTotal,
                });
            }

            return {
                team_id: team.team_id,
                team_name: team.team_name,
                owner_name: team.owner_name || 'Unknown',
                supported_team_id: team.supported_team_id,
                supported_team_name: team.supported_team_name,
                players: Array.from(playerMap.values()).sort((a, b) => {
                    if (a.is_active !== b.is_active) {
                        return a.is_active ? -1 : 1;
                    }
                    return b.total_points - a.total_points;
                }),
                passive_breakdown: passiveByRound,
                round_totals: roundTotals,
                grand_total_active: team.player_points || 0,
                grand_total_passive: team.passive_points || 0,
                grand_total: team.total_points || 0,
            };
        });

        return NextResponse.json({
            success: true,
            teams: teamBreakdowns,
            maxRounds,
            league_id: league.league_id,
        });

    } catch (error: any) {
        console.error('Error fetching fantasy points breakdown:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch fantasy points breakdown',
                details: error.message
            },
            { status: 500 }
        );
    }
}
