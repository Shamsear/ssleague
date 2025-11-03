import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ No DATABASE_URL found');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function fixNeonBudgets() {
  console.log('🔧 Fixing Neon team budgets...\n');

  try {
    // Get all team spending from team_players (source of truth)
    const spendingResult = await sql`
      SELECT 
        team_id,
        season_id,
        SUM(purchase_price)::numeric as total_spent,
        COUNT(*) as player_count
      FROM team_players
      GROUP BY team_id, season_id
    `;

    console.log(`📊 Found ${spendingResult.length} team-season combinations with players\n`);

    for (const spending of spendingResult) {
      const { team_id, season_id, total_spent, player_count } = spending;
      
      console.log(`🔄 ${team_id} in ${season_id}:`);
      console.log(`   Spent: £${Number(total_spent).toLocaleString()}`);
      console.log(`   Players: ${player_count}`);

      // Update Neon teams table
      await sql`
        UPDATE teams
        SET 
          football_spent = ${total_spent},
          football_budget = football_budget + (${total_spent} - COALESCE(football_spent, 0)),
          updated_at = NOW()
        WHERE id = ${team_id}
      `;
      
      console.log(`   ✅ Updated Neon database\n`);
    }

    console.log('\n✅ Neon budget fix completed!');
    console.log('\n⚠️  NOTE: Please manually verify and update Firebase team_seasons if needed');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixNeonBudgets().then(() => {
  console.log('\nDone!');
  process.exit(0);
});
