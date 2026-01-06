/**
 * Recalculate ONLY passive team bonus points with enhanced rules
 * FIXED VERSION: Properly handles team changes after round 13
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);

const TEAM_CHANGE_AFTER_ROUND = 13; // Teams changed after this round

async function recalculatePassivePoints() {
    console.log('🔄 Recalculating Passive Team Bonus Points (WITH TEAM CHANGE SUPPORT)\n');
    console.log('='.repeat(60));

    try {
        // Step 1: Get active fantasy leagues
        console.log('\n📋 Step 1: Getting active fantasy leagues...');
        const leagues = await fantasyDb`
      SELECT league_id, season_id
      FROM fantasy_leagues
      WHERE is_active = true
    `;

        if (leagues.length === 0) {
            console.log('❌ No active fantasy leagues found');
            return;
        }

        console.log(`✅ Found ${leagues.length} active league(s)`);
        leagues.forEach(l => console.log(`   - League: ${l.league_id}`));

        for (const league of leagues) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`Processing League: ${league.league_id}`);
            console.log('='.repeat(60));

            // Step 1.5: Get team changes
            console.log('\n🔄 Step 1.5: Loading team changes...');
            const teamChanges = await fantasyDb`
        SELECT 
          team_id,
          old_supported_team_id,
          old_supported_team_name,
          new_supported_team_id,
          new_supported_team_name,
          changed_at
        FROM supported_team_changes
        WHERE league_id = ${league.league_id}
        ORDER BY changed_at ASC
      `;

            console.log(`✅ Found ${teamChanges.length} team change(s)`);
            if (teamChanges.length > 0) {
                console.log(`   Teams that changed after Round ${TEAM_CHANGE_AFTER_ROUND}:`);
                teamChanges.forEach(change => {
                    console.log(`   - ${change.team_id}: ${change.old_supported_team_name} → ${change.new_supported_team_name}`);
                });
            }

            // Create a map for quick lookup
            const teamChangeMap = new Map();
            teamChanges.forEach(change => {
                teamChangeMap.set(change.team_id, {
                    oldTeamId: change.old_supported_team_id,
                    oldTeamName: change.old_supported_team_name,
                    newTeamId: change.new_supported_team_id,
                    newTeamName: change.new_supported_team_name
                });
            });

            // Step 2: Get team scoring rules
            console.log('\n📊 Step 2: Loading team scoring rules...');
            const teamRules = await fantasyDb`
        SELECT rule_type, points_value
        FROM fantasy_scoring_rules
        WHERE league_id = ${league.league_id}
          AND applies_to = 'team'
          AND is_active = true
      `;

            if (teamRules.length === 0) {
                console.log('⏭️  No team scoring rules configured, skipping');
                continue;
            }

            console.log(`✅ Found ${teamRules.length} team scoring rules:`)
            teamRules.forEach(rule => {
                const sign = rule.points_value > 0 ? '+' : '';
                console.log(`   ${rule.rule_type}: ${sign}${rule.points_value} pts`);
            });

            const teamScoringRules = new Map();
            teamRules.forEach(rule => {
                teamScoringRules.set(rule.rule_type, rule.points_value);
            });

            // Step 3: Reset passive points to 0
            console.log('\n🔄 Step 3: Resetting passive points to 0...');
            await fantasyDb`
        UPDATE fantasy_teams
        SET passive_points = 0
        WHERE league_id = ${league.league_id}
      `;
            console.log('✅ Reset complete');

            // Step 4: Delete old bonus records
            console.log('\n🗑️  Step 4: Deleting old bonus records...');
            await fantasyDb`
        DELETE FROM fantasy_team_bonus_points
        WHERE league_id = ${league.league_id}
      `;
            console.log(`✅ Deleted old records`);

            // Step 5: Get all completed fixtures for this season
            console.log('\n🏟️  Step 5: Getting completed fixtures...');
            const fixtures = await tournamentDb`
        SELECT 
          id,
          home_team_id,
          away_team_id,
          round_number,
          status
        FROM fixtures
        WHERE season_id = ${league.season_id}
          AND status = 'completed'
        ORDER BY round_number ASC
      `;

            console.log(`✅ Found ${fixtures.length} completed fixtures`);

            let totalBonusesAwarded = 0;
            let fixturesProcessed = 0;

            // Step 6: Process each fixture
            console.log('\n⚙️  Step 6: Recalculating bonuses (with team change support)...\n');

            for (const fixture of fixtures) {
                // Get matchup results
                const matchups = await tournamentDb`
          SELECT home_goals, away_goals
          FROM matchups
          WHERE fixture_id = ${fixture.id}
        `;

                if (matchups.length === 0) continue;

                // Calculate aggregate scores
                let homeTeamGoals = 0;
                let awayTeamGoals = 0;

                for (const matchup of matchups) {
                    homeTeamGoals += matchup.home_goals || 0;
                    awayTeamGoals += matchup.away_goals || 0;
                }

                // Award bonuses for home team (with team change awareness)
                const homeBonuses = await awardTeamBonus({
                    fantasy_league_id: league.league_id,
                    real_team_id: fixture.home_team_id,
                    fixture_id: fixture.id,
                    round_number: fixture.round_number,
                    goals_scored: homeTeamGoals,
                    goals_conceded: awayTeamGoals,
                    teamScoringRules,
                    teamChangeMap,
                });

                // Award bonuses for away team (with team change awareness)
                const awayBonuses = await awardTeamBonus({
                    fantasy_league_id: league.league_id,
                    real_team_id: fixture.away_team_id,
                    fixture_id: fixture.id,
                    round_number: fixture.round_number,
                    goals_scored: awayTeamGoals,
                    goals_conceded: homeTeamGoals,
                    teamScoringRules,
                    teamChangeMap,
                });

                totalBonusesAwarded += homeBonuses + awayBonuses;
                fixturesProcessed++;

                if (fixturesProcessed % 5 === 0) {
                    console.log(`   Processed ${fixturesProcessed}/${fixtures.length} fixtures...`);
                }
            }

            console.log(`\n✅ Processed all ${fixturesProcessed} fixtures`);
            console.log(`✅ Awarded ${totalBonusesAwarded} total bonus points`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ RECALCULATION COMPLETE!');
        console.log('='.repeat(60));
        console.log('\n💡 Summary:');
        console.log('   - Old passive points deleted');
        console.log('   - New bonuses calculated with ALL configured rules');
        console.log(`   - Team changes after Round ${TEAM_CHANGE_AFTER_ROUND} properly handled`);
        console.log('   - Breakdown data saved for each round');
        console.log('\n🎉 Passive points now accurate with team changes!');

    } catch (error) {
        console.error('\n❌ Error during recalculation:', error);
        throw error;
    }
}

async function awardTeamBonus(params) {
    const {
        fantasy_league_id,
        real_team_id,
        fixture_id,
        round_number,
        goals_scored,
        goals_conceded,
        teamScoringRules,
        teamChangeMap,
    } = params;

    // Get ALL fantasy teams first
    const allFantasyTeams = await fantasyDb`
    SELECT team_id, team_name, supported_team_id, supported_team_name
    FROM fantasy_teams
    WHERE league_id = ${fantasy_league_id}
      AND supported_team_id IS NOT NULL
  `;

    // Filter teams based on round number and team changes
    const fantasyTeams = allFantasyTeams.filter(team => {
        const teamChange = teamChangeMap.get(team.team_id);

        if (!teamChange) {
            // Team never changed, use current supported team
            // Match: SSPSLT0015 against SSPSLT0015_SSPSLS16
            return team.supported_team_id === real_team_id ||
                team.supported_team_id.startsWith(`${real_team_id}_`);
        }

        // Team changed after round 13
        if (round_number <= TEAM_CHANGE_AFTER_ROUND) {
            // For rounds 1-13, use OLD supported team
            return teamChange.oldTeamId === real_team_id ||
                teamChange.oldTeamId.startsWith(`${real_team_id}_`);
        } else {
            // For rounds 14+, use NEW supported team
            return teamChange.newTeamId === real_team_id ||
                teamChange.newTeamId.startsWith(`${real_team_id}_`) ||
                team.supported_team_id === real_team_id ||
                team.supported_team_id.startsWith(`${real_team_id}_`);
        }
    });

    if (fantasyTeams.length === 0) {
        return 0;
    }

    // Calculate bonuses based on configured rules
    const won = goals_scored > goals_conceded;
    const draw = goals_scored === goals_conceded;
    const lost = goals_scored < goals_conceded;
    const clean_sheet = goals_conceded === 0;
    const goal_margin = Math.abs(goals_scored - goals_conceded);

    const bonus_breakdown = {};
    let total_bonus = 0;

    // Apply ALL configured scoring rules dynamically
    teamScoringRules.forEach((points, ruleType) => {
        let applies = false;

        switch (ruleType) {
            case 'win': applies = won; break;
            case 'draw': applies = draw; break;
            case 'loss': applies = lost; break;
            case 'clean_sheet': applies = clean_sheet; break;
            case 'concedes_4_plus_goals': applies = goals_conceded >= 4; break;
            case 'concedes_6_plus_goals': applies = goals_conceded >= 6; break;
            case 'concedes_8_plus_goals': applies = goals_conceded >= 8; break;
            case 'concedes_10_plus_goals': applies = goals_conceded >= 10; break;
            case 'concedes_15_plus_goals': applies = goals_conceded >= 15; break;
            case 'scored_4_plus_goals':
            case 'high_scoring': applies = goals_scored >= 4; break;
            case 'scored_6_plus_goals': applies = goals_scored >= 6; break;
            case 'scored_8_plus_goals': applies = goals_scored >= 8; break;
            case 'scored_10_plus_goals': applies = goals_scored >= 10; break;
            case 'scored_15_plus_goals': applies = goals_scored >= 15; break;
            case 'big_win': applies = won && goal_margin >= 3; break;
            case 'huge_win': applies = won && goal_margin >= 5; break;
            case 'narrow_win': applies = won && goal_margin === 1; break;
            case 'shutout_win': applies = won && clean_sheet; break;
            default: applies = false;
        }

        if (applies) {
            bonus_breakdown[ruleType] = points;
            total_bonus += points;
        }
    });

    if (total_bonus === 0) {
        return 0;
    }

    let totalAwarded = 0;

    // Award bonuses to each fantasy team
    for (const fantasyTeam of fantasyTeams) {
        // Determine which team name to use for the record
        const teamChange = teamChangeMap.get(fantasyTeam.team_id);
        let realTeamName = fantasyTeam.supported_team_name;

        if (teamChange && round_number <= TEAM_CHANGE_AFTER_ROUND) {
            realTeamName = teamChange.oldTeamName;
        }

        // Insert bonus record
        await fantasyDb`
      INSERT INTO fantasy_team_bonus_points (
        league_id,
        team_id,
        real_team_id,
        real_team_name,
        fixture_id,
        round_number,
        bonus_breakdown,
        total_bonus,
        calculated_at
      ) VALUES (
        ${fantasy_league_id},
        ${fantasyTeam.team_id},
        ${real_team_id},
        ${realTeamName},
        ${fixture_id},
        ${round_number},
        ${JSON.stringify(bonus_breakdown)},
        ${total_bonus},
        NOW()
      )
    `;

        // Update fantasy team points
        await fantasyDb`
      UPDATE fantasy_teams
      SET
        passive_points = passive_points + ${total_bonus},
        total_points = total_points + ${total_bonus},
        updated_at = NOW()
      WHERE team_id = ${fantasyTeam.team_id}
    `;

        totalAwarded += total_bonus;

        const roundInfo = round_number <= TEAM_CHANGE_AFTER_ROUND && teamChange ? ' [OLD TEAM]' : '';
        console.log(`   Round ${round_number}: ${fantasyTeam.team_name} → ${total_bonus > 0 ? '+' : ''}${total_bonus} pts (${realTeamName}${roundInfo}, ${Object.keys(bonus_breakdown).join(', ')})`);
    }

    return totalAwarded;
}

recalculatePassivePoints()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
