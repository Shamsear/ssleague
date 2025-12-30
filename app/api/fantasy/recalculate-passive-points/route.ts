import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/tournament-db';
import { getFirestore, collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { app } from '@/lib/firebase/config';

const db = getFirestore(app);

export async function POST(request: NextRequest) {
    const logs: string[] = [];

    try {
        logs.push('🔄 Starting passive points recalculation...');
        logs.push('');
        logs.push('============================================================');
        logs.push('📋 Step 1: Getting active fantasy leagues...');

        // Get active fantasy leagues
        const sql = getTournamentDb();
        const leagues = await sql`
      SELECT league_id, season_id
      FROM fantasy_leagues
      WHERE is_active = true
    `;

        logs.push(`✅ Found ${leagues.length} active league(s)`);
        leagues.forEach(league => {
            logs.push(`   - League: ${league.league_id}`);
        });

        let totalFixtures = 0;
        let totalBonusPoints = 0;

        for (const league of leagues) {
            logs.push('');
            logs.push('============================================================');
            logs.push(`Processing League: ${league.league_id}`);
            logs.push('============================================================');

            // Get team scoring rules
            logs.push('📊 Step 2: Loading team scoring rules...');
            const scoringRules = await sql`
        SELECT rule_type, points
        FROM fantasy_team_scoring_rules
        WHERE league_id = ${league.league_id}
      `;

            logs.push(`✅ Found ${scoringRules.length} team scoring rules:`);
            scoringRules.forEach(rule => {
                logs.push(`   ${rule.rule_type}: ${rule.points > 0 ? '+' : ''}${rule.points} pts`);
            });

            // Reset passive points to 0
            logs.push('');
            logs.push('🔄 Step 3: Resetting passive points to 0...');
            await sql`
        UPDATE fantasy_teams
        SET passive_points = 0
        WHERE league_id = ${league.league_id}
      `;
            logs.push('✅ Reset complete');

            // Delete old bonus records
            logs.push('');
            logs.push('🗑️  Step 4: Deleting old bonus records...');
            await sql`
        DELETE FROM fantasy_team_bonus_breakdown
        WHERE league_id = ${league.league_id}
      `;
            logs.push('✅ Deleted old records');

            // Get completed fixtures
            logs.push('');
            logs.push('🏟️  Step 5: Getting completed fixtures...');
            const fixtures = await sql`
        SELECT 
          f.fixture_id,
          f.matchday,
          f.home_team_id,
          f.away_team_id,
          f.home_score,
          f.away_score,
          f.status
        FROM fixtures f
        WHERE f.season_id = ${league.season_id}
          AND f.status = 'completed'
        ORDER BY f.matchday, f.fixture_id
      `;

            logs.push(`✅ Found ${fixtures.length} completed fixtures`);
            totalFixtures += fixtures.length;

            // Recalculate bonuses
            logs.push('');
            logs.push('⚙️  Step 6: Recalculating bonuses...');
            logs.push('');

            let processedCount = 0;
            let leagueBonusPoints = 0;

            for (const fixture of fixtures) {
                processedCount++;

                // Calculate bonuses for both teams
                const homeTeamBonuses = calculateTeamBonuses(
                    fixture.home_score,
                    fixture.away_score,
                    'home',
                    scoringRules
                );

                const awayTeamBonuses = calculateTeamBonuses(
                    fixture.away_score,
                    fixture.home_score,
                    'away',
                    scoringRules
                );

                // Update home team
                if (homeTeamBonuses.totalPoints !== 0) {
                    await sql`
            UPDATE fantasy_teams
            SET passive_points = passive_points + ${homeTeamBonuses.totalPoints}
            WHERE league_id = ${league.league_id}
              AND team_id = ${fixture.home_team_id}
          `;

                    // Save breakdown
                    for (const bonus of homeTeamBonuses.bonuses) {
                        await sql`
              INSERT INTO fantasy_team_bonus_breakdown (
                league_id, team_id, matchday, bonus_type, points
              ) VALUES (
                ${league.league_id},
                ${fixture.home_team_id},
                ${fixture.matchday},
                ${bonus.type},
                ${bonus.points}
              )
            `;
                    }

                    leagueBonusPoints += homeTeamBonuses.totalPoints;
                }

                // Update away team
                if (awayTeamBonuses.totalPoints !== 0) {
                    await sql`
            UPDATE fantasy_teams
            SET passive_points = passive_points + ${awayTeamBonuses.totalPoints}
            WHERE league_id = ${league.league_id}
              AND team_id = ${fixture.away_team_id}
          `;

                    // Save breakdown
                    for (const bonus of awayTeamBonuses.bonuses) {
                        await sql`
              INSERT INTO fantasy_team_bonus_breakdown (
                league_id, team_id, matchday, bonus_type, points
              ) VALUES (
                ${league.league_id},
                ${fixture.away_team_id},
                ${fixture.matchday},
                ${bonus.type},
                ${bonus.points}
              )
            `;
                    }

                    leagueBonusPoints += awayTeamBonuses.totalPoints;
                }

                // Log progress every 5 fixtures
                if (processedCount % 5 === 0) {
                    logs.push(`   Processed ${processedCount}/${fixtures.length} fixtures...`);
                }
            }

            logs.push('');
            logs.push(`✅ Processed all ${fixtures.length} fixtures`);
            logs.push(`✅ Awarded ${leagueBonusPoints} total bonus points`);
            totalBonusPoints += leagueBonusPoints;
        }

        logs.push('');
        logs.push('============================================================');
        logs.push('✅ RECALCULATION COMPLETE!');
        logs.push('============================================================');
        logs.push('');
        logs.push('💡 Summary:');
        logs.push('   - Old passive points deleted');
        logs.push('   - New bonuses calculated with ALL configured rules');
        logs.push('   - Breakdown data saved for each round');
        logs.push('');
        logs.push('🎉 Passive points now include all bonus types!');

        return NextResponse.json({
            success: true,
            logs,
            summary: {
                leagues: leagues.length,
                fixtures: totalFixtures,
                bonusPoints: totalBonusPoints
            }
        });

    } catch (error: any) {
        console.error('Error recalculating passive points:', error);
        logs.push('');
        logs.push(`❌ Error: ${error.message}`);

        return NextResponse.json(
            {
                error: error.message,
                logs
            },
            { status: 500 }
        );
    }
}

// Helper function to calculate team bonuses
function calculateTeamBonuses(
    teamScore: number,
    opponentScore: number,
    side: 'home' | 'away',
    scoringRules: any[]
): { totalPoints: number; bonuses: Array<{ type: string; points: number }> } {
    const bonuses: Array<{ type: string; points: number }> = [];
    let totalPoints = 0;

    // Determine match result
    let result: 'win' | 'draw' | 'loss';
    if (teamScore > opponentScore) {
        result = 'win';
    } else if (teamScore === opponentScore) {
        result = 'draw';
    } else {
        result = 'loss';
    }

    // Apply result bonus
    const resultRule = scoringRules.find(r => r.rule_type === result);
    if (resultRule) {
        bonuses.push({ type: result, points: resultRule.points });
        totalPoints += resultRule.points;
    }

    // Check for clean sheet
    if (opponentScore === 0) {
        const cleanSheetRule = scoringRules.find(r => r.rule_type === 'clean_sheet');
        if (cleanSheetRule) {
            bonuses.push({ type: 'clean_sheet', points: cleanSheetRule.points });
            totalPoints += cleanSheetRule.points;
        }
    }

    // Check for 6+ goals scored
    if (teamScore >= 6) {
        const highScoringRule = scoringRules.find(r => r.rule_type === 'scored_6_plus_goals');
        if (highScoringRule) {
            bonuses.push({ type: 'scored_6_plus_goals', points: highScoringRule.points });
            totalPoints += highScoringRule.points;
        }
    }

    // Check for conceding 15+ goals
    if (opponentScore >= 15) {
        const heavyDefeatRule = scoringRules.find(r => r.rule_type === 'concedes_15_plus_goals');
        if (heavyDefeatRule) {
            bonuses.push({ type: 'concedes_15_plus_goals', points: heavyDefeatRule.points });
            totalPoints += heavyDefeatRule.points;
        }
    }

    return { totalPoints, bonuses };
}
