const { Pool } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function updateFootballPlayersCount() {
  console.log('\n🔄 Updating football_players_count for all teams...\n');
  
  const connectionString = process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ Error: Database URL not found in environment variables');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    // Get all teams
    const teamsResult = await pool.query(`
      SELECT id, name, season_id, football_players_count
      FROM teams
      ORDER BY season_id, name
    `);
    
    console.log(`📊 Found ${teamsResult.rows.length} teams\n`);
    
    if (teamsResult.rows.length === 0) {
      console.log('⚠️  No teams found in database');
      await pool.end();
      return;
    }
    
    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    
    for (const team of teamsResult.rows) {
      try {
        // Count actual football players for this team
        const countResult = await pool.query(`
          SELECT COUNT(*) as player_count
          FROM footballplayers
          WHERE team_id = $1
          AND (
            contract_end_season IS NULL 
            OR contract_end_season >= $2
          )
        `, [team.id, team.season_id]);
        
        const actualCount = parseInt(countResult.rows[0].player_count) || 0;
        const currentCount = parseInt(team.football_players_count) || 0;
        
        if (actualCount !== currentCount) {
          // Update the count
          await pool.query(`
            UPDATE teams
            SET football_players_count = $1,
                updated_at = NOW()
            WHERE id = $2
          `, [actualCount, team.id]);
          
          console.log(`✅ ${team.name} (${team.season_id}): ${currentCount} → ${actualCount} players`);
          updated++;
        } else {
          console.log(`⏭️  ${team.name} (${team.season_id}): ${currentCount} players (no change)`);
          unchanged++;
        }
        
      } catch (error) {
        console.error(`❌ Error updating ${team.name}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Unchanged: ${unchanged}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📋 Total: ${teamsResult.rows.length}`);
    
    // Verify a few samples
    console.log('\n🔍 Verification - Sample teams:\n');
    
    const sampleResult = await pool.query(`
      SELECT 
        t.id,
        t.name,
        t.season_id,
        t.football_players_count,
        COUNT(fp.id) as actual_count
      FROM teams t
      LEFT JOIN footballplayers fp ON t.id = fp.team_id
        AND (fp.contract_end_season IS NULL OR fp.contract_end_season >= t.season_id)
      GROUP BY t.id, t.name, t.season_id, t.football_players_count
      ORDER BY t.season_id DESC, t.name
      LIMIT 5
    `);
    
    sampleResult.rows.forEach(row => {
      const match = parseInt(row.football_players_count) === parseInt(row.actual_count);
      const icon = match ? '✅' : '❌';
      console.log(`${icon} ${row.name} (${row.season_id}):`);
      console.log(`   - Stored count: ${row.football_players_count}`);
      console.log(`   - Actual count: ${row.actual_count}`);
      console.log(`   - Match: ${match ? 'YES' : 'NO'}`);
    });
    
    console.log('\n🎉 Football players count update complete!\n');
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run the update
updateFootballPlayersCount()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
