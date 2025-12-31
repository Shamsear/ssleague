import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
    try {
        const sql = fantasySql;

        // Get the most recent fantasy league (not just active)
        const leagues = await sql`
      SELECT league_id, season_id, is_active
      FROM fantasy_leagues
      ORDER BY created_at DESC
      LIMIT 1
    `;

        if (leagues.length === 0) {
            console.log('[Points Breakdown] No fantasy leagues found');
            return NextResponse.json({
                success: true,
                teams: [],
                maxRounds: 0,
                message: 'No fantasy leagues found in the system'
            });
        }

        const league = leagues[0];
        console.log('[Points Breakdown] Found league:', league.league_id);

        // Get all fantasy teams
        const teams = await sql`
      SELECT 
        ft.team_id,
        ft.owner_name,
        ft.team_name,
        ft.passive_points,
        ft.total_points
      FROM fantasy_teams ft
      WHERE ft.league_id = ${league.league_id}
      ORDER BY ft.total_points DESC, ft.team_name
    `;

        console.log('[Points Breakdown] Found teams:', teams.length);

        // Get max rounds from fixtures (from tournament database)
        const tournamentSql = getTournamentDb();
        const maxRoundsResult = await tournamentSql`
      SELECT MAX(round_number) as max_round
      FROM fixtures
      WHERE season_id = ${league.season_id}
        AND status = 'completed'
    `;
        const maxRounds = maxRoundsResult[0]?.max_round || 0;

        // Get all player squad members (current players only)
        const squadMembers = await sql`
      SELECT 
        fs.team_id,
        fs.real_player_id as player_id,
        fs.player_name
      FROM fantasy_squad fs
      WHERE fs.league_id = ${league.league_id}
      ORDER BY fs.team_id, fs.player_name
    `;

        // Get all player points by round (player performance - active points)
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

        // Get team passive bonus points by round
        const teamBonusPoints = await sql`
      SELECT 
        ftb.team_id,
        ftb.round_number,
        ftb.points as bonus_points
      FROM fantasy_team_bonus_points ftb
      WHERE ftb.league_id = ${league.league_id}
      ORDER BY ftb.team_id, ftb.round_number
    `;

        // Get unique player IDs from points (includes released players)
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
            // Create player map from ALL players who have points (includes released players)
            const playerMap = new Map<string, any>();

            // Process all player points for this team
            playerPoints
                .filter((pp: any) => pp.team_id === team.team_id)
                .forEach((pp: any) => {
                    // Initialize player if not in map yet
                    if (!playerMap.has(pp.player_id)) {
                        // Check if player is currently in squad
                        const squadMember = squadMembers.find((sm: any) =>
                            sm.team_id === team.team_id && sm.player_id === pp.player_id
                        );
                        const isCurrentlyInSquad = !!squadMember;

                        playerMap.set(pp.player_id, {
                            player_id: pp.player_id,
                            player_name: squadMember?.player_name || playerNames.get(pp.player_id) || 'Unknown Player',
                            is_active: isCurrentlyInSquad,
                            rounds: [],
                            total_active: 0,
                            total_passive: 0,
                            total_points: 0,
                        });
                    }

                    // Add this round's player points (active points)
                    const player = playerMap.get(pp.player_id);
                    const activePoints = pp.total_points || 0;

                    player.rounds.push({
                        round: pp.round_number,
                        active_points: activePoints,
                        passive_points: 0, // Will be calculated from team bonuses
                        total_points: activePoints,
                        status: player.is_active ? 'active' : 'released'
                    });

                    player.total_active += activePoints;
                    player.total_points += activePoints;
                });

            // Add team passive bonuses to each player's rounds
            teamBonusPoints
                .filter((tb: any) => tb.team_id === team.team_id)
                .forEach((tb: any) => {
                    const bonusPerPlayer = (tb.bonus_points || 0) / Math.max(playerMap.size, 1);

                    playerMap.forEach(player => {
                        const roundData = player.rounds.find((r: any) => r.round === tb.round_number);
                        if (roundData) {
                            roundData.passive_points = bonusPerPlayer;
                            roundData.total_points += bonusPerPlayer;
                            player.total_passive += bonusPerPlayer;
                            player.total_points += bonusPerPlayer;
                        }
                    });
                });

            // Calculate round totals for the team
            const roundTotals: any[] = [];
            for (let round = 1; round <= maxRounds; round++) {
                let roundActiveTotal = 0;
                let roundPassiveTotal = 0;

                playerMap.forEach(player => {
                    const roundData = player.rounds.find((r: any) => r.round === round);
                    if (roundData) {
                        roundActiveTotal += roundData.active_points;
                        roundPassiveTotal += roundData.passive_points;
                    }
                });

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
                players: Array.from(playerMap.values()).sort((a, b) => {
                    // Sort: active players first, then by total points
                    if (a.is_active !== b.is_active) {
                        return a.is_active ? -1 : 1;
                    }
                    return b.total_points - a.total_points;
                }),
                round_totals: roundTotals,
                grand_total_active: (team.total_points || 0) - (team.passive_points || 0),
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
