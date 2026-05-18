import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';
import { calculateFootballPlayerSalary } from '@/lib/contracts';
import { getAuctionDb } from '@/lib/neon/auction-config';

/**
 * GET /api/contracts/mid-season-salary/preview
 * Preview salary deductions for all teams before processing.
 * 
 * IMPORTANT: Shows ALL players with an active contract for the team,
 * not just players bought in the current season. A player bought in
 * Season 16 with a 2-season contract is still active in Season 17.
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAuth(['committee_admin'], request);
        if (!auth.authenticated) {
            return NextResponse.json(
                { error: auth.error || 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const seasonId = searchParams.get('seasonId');

        if (!seasonId) {
            return NextResponse.json(
                { error: 'Missing seasonId parameter' },
                { status: 400 }
            );
        }

        // Parse the current season number for contract comparison.
        // Season IDs like "16", "16.5", "17", "17.5" are parsed as floats
        // so comparisons work correctly across half-season boundaries.
        const currentSeasonNum = parseFloat(seasonId);

        // Get all team_seasons for this season
        const teamSeasonsSnapshot = await adminDb
            .collection('team_seasons')
            .where('season_id', '==', seasonId)
            .where('status', '==', 'registered')
            .get();

        const sql = getAuctionDb();
        const teamsPreview = [];

        // Process each team
        for (const teamSeasonDoc of teamSeasonsSnapshot.docs) {
            const teamSeasonData = teamSeasonDoc.data();
            const teamId = teamSeasonData.team_id;
            const teamName = teamSeasonData.team_name || 'Unknown Team';
            const currentBalance = teamSeasonData.football_budget || 0;

            // Fetch ALL football players owned by this team that have an active
            // contract covering the current season.
            //
            // A player's contract is active for the current season if:
            //   contract_start_season <= currentSeasonNum AND
            //   contract_end_season   >= currentSeasonNum
            //
            // We also include players that are simply marked is_sold = true and
            // assigned to this team but lack explicit contract fields (legacy data),
            // falling back to the original season_id match.
            const footballPlayers = await sql`
                SELECT 
                    id,
                    player_id,
                    name,
                    acquisition_value,
                    season_id,
                    contract_start_season,
                    contract_end_season,
                    contract_status
                FROM footballplayers
                WHERE team_id = ${teamId}
                  AND is_sold = true
                  AND (
                    -- Players with explicit contract fields: check if contract covers current season
                    (
                        contract_start_season IS NOT NULL
                        AND contract_end_season IS NOT NULL
                        AND contract_status IS DISTINCT FROM 'expired'
                        AND CAST(contract_start_season AS FLOAT) <= ${currentSeasonNum}
                        AND CAST(contract_end_season AS FLOAT) >= ${currentSeasonNum}
                    )
                    OR
                    -- Legacy players without contract fields: match by season_id
                    (
                        contract_start_season IS NULL
                        AND season_id = ${seasonId}
                    )
                  )
                ORDER BY name
            `;

            const players = footballPlayers.map((p: any) => ({
                id: p.id,
                playerId: p.player_id,
                name: p.name,
                auctionValue: p.acquisition_value || 0,
                salary: calculateFootballPlayerSalary(p.acquisition_value || 0),
                contractSeason: p.contract_start_season || p.season_id,
                contractEnd: p.contract_end_season,
            }));

            const totalSalary = players.reduce((sum: number, p: any) => sum + p.salary, 0);
            const newBalance = currentBalance - totalSalary;

            teamsPreview.push({
                teamId,
                teamName,
                playerCount: players.length,
                totalSalary,
                currentBalance,
                newBalance,
                canAfford: currentBalance >= totalSalary,
                players,
            });
        }

        // Sort by team name
        teamsPreview.sort((a: any, b: any) => a.teamName.localeCompare(b.teamName));

        const totalDeduction = teamsPreview.reduce((sum: number, t: any) => sum + t.totalSalary, 0);
        const teamsWithIssues = teamsPreview.filter((t: any) => !t.canAfford).length;

        return NextResponse.json({
            success: true,
            teams: teamsPreview,
            summary: {
                totalTeams: teamsPreview.length,
                totalDeduction,
                teamsWithIssues,
            },
        });
    } catch (error) {
        console.error('Error generating salary preview:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate preview' },
            { status: 500 }
        );
    }
}
