import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';
import { calculateFootballPlayerSalary } from '@/lib/contracts';
import { getAuctionDb } from '@/lib/neon/auction-config';

/**
 * GET /api/contracts/mid-season-salary/preview
 * Preview salary deductions for all teams before processing
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

            // Fetch football players from Neon DB
            const footballPlayers = await sql`
        SELECT 
          id,
          player_id,
          name,
          acquisition_value
        FROM footballplayers
        WHERE team_id = ${teamId}
          AND season_id = ${seasonId}
        ORDER BY name
      `;

            const players = footballPlayers.map((p: any) => ({
                id: p.id,
                playerId: p.player_id,
                name: p.name,
                auctionValue: p.acquisition_value || 0,
                salary: calculateFootballPlayerSalary(p.acquisition_value || 0),
            }));

            const totalSalary = players.reduce((sum, p) => sum + p.salary, 0);
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
        teamsPreview.sort((a, b) => a.teamName.localeCompare(b.teamName));

        const totalDeduction = teamsPreview.reduce((sum, t) => sum + t.totalSalary, 0);
        const teamsWithIssues = teamsPreview.filter(t => !t.canAfford).length;

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
