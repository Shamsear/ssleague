import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

// POST - Check and create matchups for all blind_lineup fixtures that are ready
export async function POST(request: NextRequest) {
    try {
        const sql = getTournamentDb();

        // Find all blind_lineup fixtures where:
        // 1. Both teams submitted
        // 2. Lineups not locked yet
        // 3. Matchups don't exist yet
        const fixtures = await sql`
      SELECT 
        f.id,
        f.tournament_id,
        f.home_team_name,
        f.away_team_name,
        f.round_number,
        f.leg
      FROM fixtures f
      WHERE f.matchup_mode = 'blind_lineup'
        AND f.home_lineup_submitted = true
        AND f.away_lineup_submitted = true
        AND f.lineups_locked = false
        AND NOT EXISTS (
          SELECT 1 FROM matchups m 
          WHERE m.fixture_id = f.id
        )
    `;

        console.log(`🔍 Found ${fixtures.length} fixtures ready for auto-matchup creation`);

        const results = [];

        for (const fixture of fixtures) {
            try {
                // Call auto-create-matchups API for this fixture
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fixtures/${fixture.id}/auto-create-matchups`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const data = await response.json();

                if (data.success) {
                    console.log(`✅ Created matchups for fixture ${fixture.id}`);
                    results.push({
                        fixture_id: fixture.id,
                        tournament_id: fixture.tournament_id,
                        home_team: fixture.home_team_name,
                        away_team: fixture.away_team_name,
                        round: fixture.round_number,
                        leg: fixture.leg,
                        status: 'success',
                        matchups_created: data.matchups_created
                    });
                } else {
                    console.error(`❌ Failed to create matchups for fixture ${fixture.id}:`, data.error);
                    results.push({
                        fixture_id: fixture.id,
                        status: 'error',
                        error: data.error
                    });
                }
            } catch (error: any) {
                console.error(`❌ Error processing fixture ${fixture.id}:`, error);
                results.push({
                    fixture_id: fixture.id,
                    status: 'error',
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;

        return NextResponse.json({
            success: true,
            message: `Processed ${fixtures.length} fixtures: ${successCount} succeeded, ${errorCount} failed`,
            fixtures_processed: fixtures.length,
            success_count: successCount,
            error_count: errorCount,
            results
        });

    } catch (error: any) {
        console.error('Error in blind lineup matchup creation:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
