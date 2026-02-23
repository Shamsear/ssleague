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

        // Get tournaments and their rounds
        const tournaments = await tournamentSql`
      SELECT DISTINCT 
        f.tournament_id,
        t.tournament_name,
        MAX(f.round_number) as max_round
      FROM fixtures f
      LEFT JOIN tournaments t ON f.tournament_id = t.id
      WHERE f.season_id = ${league.season_id}
        AND f.status = 'completed'
      GROUP BY f.tournament_id, t.tournament_name
      ORDER BY t.tournament_name
    `;
        
        const maxRounds = Math.max(...tournaments.map((t: any) => t.max_round || 0), 0);

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

        // Get all player points by round with tournament info
        const playerPoints = await sql`
      SELECT 
        fpp.team_id,
        fpp.real_player_id as player_id,
        fpp.round_number,
        fpp.fixture_id,
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

        // Get admin bonus points (awards like TOD, TOW, POTD, POTW)
        const adminBonusPoints = await sql`
      SELECT 
        bp.target_type,
        bp.target_id,
        bp.points,
        bp.reason,
        bp.awarded_at
      FROM bonus_points bp
      WHERE bp.league_id = ${league.league_id}
      ORDER BY bp.awarded_at DESC
    `;

        // Get fixture details for passive points context
        const allFixtureIds = [...new Set([
            ...teamBonusPoints.map((b: any) => b.fixture_id),
            ...playerPoints.map((p: any) => p.fixture_id)
        ])];
        const fixtures = allFixtureIds.length > 0 ? await tournamentSql`
      SELECT 
        f.id as fixture_id,
        f.home_team_id,
        f.away_team_id,
        f.round_number,
        f.tournament_id,
        f.home_team_name,
        f.away_team_name,
        t.tournament_name
      FROM fixtures f
      LEFT JOIN tournaments t ON f.tournament_id = t.id
      WHERE f.id = ANY(${allFixtureIds})
    ` : [];

        // Get matchup results for each fixture
        const matchups = allFixtureIds.length > 0 ? await tournamentSql`
      SELECT 
        m.fixture_id,
        SUM(m.home_goals) as home_goals,
        SUM(m.away_goals) as away_goals
      FROM matchups m
      WHERE m.fixture_id = ANY(${allFixtureIds})
      GROUP BY m.fixture_id
    ` : [];

        // Create fixture map with results and tournament info
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

                    const fixture = fixtureMap.get(pp.fixture_id);
                    player.rounds.push({
                        round: pp.round_number,
                        points: points,
                        status: player.is_active ? 'active' : 'released',
                        tournament_id: fixture?.tournament_id || 'unknown',
                        tournament_name: fixture?.tournament_name || 'Unknown Tournament'
                    });

                    player.total_points += points;
                });

            // Build passive points breakdown by tournament and round
            const passiveByTournamentRound: any[] = [];
            tournaments.forEach((tournament: any) => {
                for (let round = 1; round <= tournament.max_round; round++) {
                    const roundBonuses = teamBonusPoints.filter((tb: any) => {
                        const fixture = fixtureMap.get(tb.fixture_id);
                        return tb.team_id === team.team_id && 
                               tb.round_number === round &&
                               fixture?.tournament_id === tournament.tournament_id;
                    });

                    const roundTotal = roundBonuses.reduce((sum: number, b: any) => sum + (b.total_bonus || 0), 0);

                    const matches = roundBonuses.map((bonus: any) => {
                        const fixture = fixtureMap.get(bonus.fixture_id);
                        const breakdown = typeof bonus.bonus_breakdown === 'string'
                            ? JSON.parse(bonus.bonus_breakdown)
                            : bonus.bonus_breakdown;

                        // Extract the real team ID from real_team_id field (format: SSPSLT0015)
                        const realTeamId = bonus.real_team_id || team.supported_team_id.split('_')[0];
                        const isHome = fixture && fixture.home_team_id === realTeamId;
                        const isAway = fixture && fixture.away_team_id === realTeamId;

                        return {
                            fixture_id: bonus.fixture_id,
                            supported_team: bonus.real_team_name,
                            opponent: fixture ? (
                                isHome ? fixture.away_team_name : fixture.home_team_name
                            ) : 'Unknown',
                            score: fixture ? (
                                isHome
                                    ? `${fixture.home_goals}-${fixture.away_goals}`
                                    : `${fixture.away_goals}-${fixture.home_goals}`
                            ) : 'N/A',
                            home_away: fixture ? (
                                isHome ? 'H' : 'A'
                            ) : 'N/A',
                            bonus_points: bonus.total_bonus || 0,
                            breakdown: breakdown || {}
                        };
                    });

                    passiveByTournamentRound.push({
                        tournament_id: tournament.tournament_id,
                        tournament_name: tournament.tournament_name,
                        round,
                        total_passive: roundTotal,
                        matches
                    });
                }
            });

            // Calculate round totals by tournament (active + passive)
            const roundTotals: any[] = [];
            tournaments.forEach((tournament: any) => {
                for (let round = 1; round <= tournament.max_round; round++) {
                    let roundActiveTotal = 0;

                    playerMap.forEach(player => {
                        const roundData = player.rounds.filter((r: any) => 
                            r.round === round && r.tournament_id === tournament.tournament_id
                        );
                        roundData.forEach((rd: any) => {
                            roundActiveTotal += rd.points;
                        });
                    });

                    const passiveData = passiveByTournamentRound.find(p => 
                        p.round === round && p.tournament_id === tournament.tournament_id
                    );
                    const roundPassiveTotal = passiveData?.total_passive || 0;

                    roundTotals.push({
                        tournament_id: tournament.tournament_id,
                        tournament_name: tournament.tournament_name,
                        round,
                        active_points: roundActiveTotal,
                        passive_points: roundPassiveTotal,
                        total_points: roundActiveTotal + roundPassiveTotal,
                    });
                }
            });

            // Get admin bonuses for this team
            const teamAdminBonuses = adminBonusPoints.filter((b: any) => {
                if (b.target_type === 'team') {
                    return b.target_id === team.supported_team_id;
                } else if (b.target_type === 'player') {
                    // Check if this team owns the player
                    const squadMember = squadMembers.find((sm: any) =>
                        sm.team_id === team.team_id && sm.player_id === b.target_id
                    );
                    return !!squadMember;
                }
                return false;
            }).map((b: any) => ({
                type: b.target_type,
                target_id: b.target_id,
                points: b.points,
                reason: b.reason,
                awarded_at: b.awarded_at
            }));

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
                passive_breakdown: passiveByTournamentRound,
                round_totals: roundTotals,
                admin_bonuses: teamAdminBonuses,
                grand_total_active: team.player_points || 0,
                grand_total_passive: team.passive_points || 0,
                grand_total: team.total_points || 0,
            };
        });

        return NextResponse.json({
            success: true,
            teams: teamBreakdowns,
            maxRounds,
            tournaments: tournaments.map((t: any) => ({
                tournament_id: t.tournament_id,
                tournament_name: t.tournament_name,
                max_round: t.max_round
            })),
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
