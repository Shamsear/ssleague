/**
 * Script to give passive points to all fantasy teams
 * This will calculate points for all fixtures that have results
 * 
 * The system calculates TWO types of points:
 * 1. Player points - from individual player performances (goals, clean sheets, etc.)
 * 2. Passive points (team bonuses) - from the real team's performance that fantasy teams support
 * 
 * Both are calculated automatically via the calculate-points API
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function givePassivePointsToAllTeams() {
  const sql = neon(process.env.FANTASY_DATABASE_URL);
  
  console.log('🎮 Starting passive points calculation for all fantasy teams...\n');

  try {
    // Get all active fantasy leagues
    const leagues = await sql`
      SELECT id, league_id, season_id
      FROM fantasy_leagues
      WHERE is_active = true
    `;

    if (leagues.length === 0) {
      console.log('❌ No active fantasy leagues found');
      return;
    }

    console.log(`Found ${leagues.length} active fantasy league(s):\n`);
    leagues.forEach(league => {
      console.log(`  - ${league.name} (${league.league_id})`);
    });
    console.log('');

    // For each league, get all fixtures from their season
    for (const league of leagues) {
      console.log(`\n📊 Processing league: ${league.name}`);
      console.log(`   Season ID: ${league.season_id}`);
      
      // Get all fixtures for this season that have results
      const fixtures = await sql`
        SELECT 
          f.id as fixture_id,
          f.round_number,
          f.home_team_score,
          f.away_team_score,
          f.status,
          r.round_name
        FROM fixtures f
        LEFT JOIN rounds r ON f.round_id = r.id
        WHERE f.season_id = ${league.season_id}
          AND f.status = 'completed'
          AND f.home_team_score IS NOT NULL
          AND f.away_team_score IS NOT NULL
        ORDER BY f.round_number, f.id
      `;

      console.log(`   Found ${fixtures.length} completed fixtures\n`);

      if (fixtures.length === 0) {
        console.log('   ⚠️  No completed fixtures found for this league');
        continue;
      }

      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // Process each fixture
      for (const fixture of fixtures) {
        const roundInfo = fixture.round_name || `Round ${fixture.round_number}`;
        console.log(`   Processing ${roundInfo} - Fixture ${fixture.fixture_id}...`);

        try {
          // Check if points already calculated for this fixture
          const existingPoints = await sql`
            SELECT COUNT(*) as count
            FROM fantasy_player_points
            WHERE league_id = ${league.league_id}
              AND fixture_id = ${fixture.fixture_id}
          `;

          if (existingPoints[0].count > 0) {
            console.log(`      ⏭️  Already calculated (${existingPoints[0].count} player records)`);
            skippedCount++;
            continue;
          }

          // Call the calculate-points API
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
          const response = await fetch(`${baseUrl}/api/fantasy/calculate-points`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fixture_id: fixture.fixture_id,
              season_id: league.season_id,
              round_number: fixture.round_number,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.log(`      ❌ Error: ${errorData.error || 'Unknown error'}`);
            errorCount++;
            continue;
          }

          const result = await response.json();
          console.log(`      ✅ ${result.message}`);
          successCount++;

        } catch (error) {
          console.log(`      ❌ Error: ${error.message}`);
          errorCount++;
        }
      }

      console.log(`\n   Summary for ${league.name}:`);
      console.log(`   ✅ Successfully calculated: ${successCount}`);
      console.log(`   ⏭️  Skipped (already done): ${skippedCount}`);
      console.log(`   ❌ Errors: ${errorCount}`);
    }

    console.log('\n\n🎉 Passive points calculation complete!');
    console.log('\n📊 Final Summary:');
    
    // Show final team standings for each league
    for (const league of leagues) {
      const teams = await sql`
        SELECT 
          ft.team_name,
          ft.player_points,
          ft.bonus_points,
          ft.total_points,
          ft.rank
        FROM fantasy_teams ft
        WHERE ft.league_id = ${league.league_id}
        ORDER BY ft.rank ASC
        LIMIT 10
      `;

      console.log(`\n${league.name} - Top Teams:`);
      teams.forEach((team, index) => {
        console.log(`  ${index + 1}. ${team.team_name}: ${team.total_points} pts (Player: ${team.player_points}, Bonus: ${team.bonus_points || 0})`);
      });
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

// Run the script
givePassivePointsToAllTeams()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
