import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

async function addGoalsConcededColumn() {
  console.log('🔧 Adding goals_conceded column to player_seasons table...');
  
  try {
    // Check if column already exists
    const columnExists = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'player_seasons' 
      AND column_name = 'goals_conceded'
    `;
    
    if (columnExists.length > 0) {
      console.log('✅ Column goals_conceded already exists in player_seasons table');
      return;
    }
    
    // Add goals_conceded column
    await sql`
      ALTER TABLE player_seasons 
      ADD COLUMN goals_conceded INTEGER DEFAULT 0
    `;
    console.log('✅ Added goals_conceded column to player_seasons table');
    
    // Verify the column was added
    const columns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'player_seasons'
      AND column_name IN ('goals_scored', 'goals_conceded')
      ORDER BY ordinal_position
    `;
    
    console.log('\n📊 Goal-related columns in player_seasons:');
    columns.forEach(col => {
      const defaultVal = col.column_default ? `DEFAULT ${col.column_default}` : '';
      console.log(`   - ${col.column_name}: ${col.data_type} ${defaultVal}`.trim());
    });
    
    console.log('\n✅ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Update API queries to include goals_conceded');
    console.log('   2. Update frontend to display goals conceded stats');
    
  } catch (error) {
    console.error('❌ Error adding column:', error);
    throw error;
  }
}

addGoalsConcededColumn()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
