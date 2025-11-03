import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function addFootballPlayersCount() {
  console.log('🔧 Adding football_players_count column to teams table...\n');

  try {
    // Add the column
    console.log('📝 Step 1: Adding column...');
    await sql`
      ALTER TABLE teams
      ADD COLUMN IF NOT EXISTS football_players_count INTEGER DEFAULT 0
    `;
    console.log('   ✓ Column added');

    // Add comment
    await sql`
      COMMENT ON COLUMN teams.football_players_count IS 'Number of football players in the team squad'
    `;
    console.log('   ✓ Comment added\n');

    // Update existing teams with correct counts
    console.log('📝 Step 2: Updating existing teams with player counts...');
    const updateResult = await sql`
      UPDATE teams t
      SET football_players_count = (
        SELECT COUNT(*)
        FROM team_players tp
        WHERE tp.team_id = t.id
        AND tp.season_id = t.season_id
      )
      WHERE EXISTS (
        SELECT 1 FROM team_players tp WHERE tp.team_id = t.id
      )
    `;
    console.log(`   ✓ Updated ${updateResult.length || 0} teams\n`);

    // Verify the update
    console.log('📝 Step 3: Verifying results...');
    const teams = await sql`
      SELECT 
        id,
        name,
        season_id,
        football_players_count,
        football_budget,
        football_spent
      FROM teams
      ORDER BY season_id, name
    `;

    console.log(`\n✅ Migration completed successfully!`);
    console.log(`\n📊 Teams Summary (${teams.length} teams):`);
    console.log('─'.repeat(80));
    console.log('ID'.padEnd(20) + 'Name'.padEnd(25) + 'Season'.padEnd(10) + 'Players'.padEnd(10) + 'Budget');
    console.log('─'.repeat(80));
    
    for (const team of teams) {
      const idStr = (team.id || '').toString().substring(0, 18);
      const nameStr = (team.name || '').toString().substring(0, 23);
      const seasonStr = (team.season_id || '').toString().substring(0, 8);
      const playersStr = (team.football_players_count || 0).toString();
      const budgetStr = `£${team.football_budget || 0}`;
      
      console.log(
        idStr.padEnd(20) + 
        nameStr.padEnd(25) + 
        seasonStr.padEnd(10) + 
        playersStr.padEnd(10) + 
        budgetStr
      );
    }
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
addFootballPlayersCount()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
