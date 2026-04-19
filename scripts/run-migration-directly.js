require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NEON_DATABASE_URL);

async function runMigration() {
  console.log('Adding columns to player_history...\n');
  
  try {
    // Add columns one by one to see which ones fail
    const columns = [
      'position_group VARCHAR(50)',
      'overall_rating INTEGER',
      'nationality VARCHAR(100)',
      'age INTEGER',
      'playing_style VARCHAR(100)',
      'club VARCHAR(255)',
      'is_sold BOOLEAN DEFAULT true',
      'speed INTEGER',
      'acceleration INTEGER',
      'ball_control INTEGER',
      'dribbling INTEGER',
      'low_pass INTEGER',
      'lofted_pass INTEGER',
      'finishing INTEGER',
      'heading INTEGER',
      'physical_contact INTEGER',
      'stamina INTEGER',
      'defensive_awareness INTEGER',
      'ball_winning INTEGER',
      'aggression INTEGER',
      'gk_reflexes INTEGER',
      'gk_reach INTEGER',
      'gk_handling INTEGER',
      'weak_foot_usage INTEGER',
      'weak_foot_accuracy INTEGER',
      'form INTEGER',
      'injury_resistance INTEGER'
    ];
    
    for (const col of columns) {
      const colName = col.split(' ')[0];
      try {
        await sql.unsafe(`ALTER TABLE player_history ADD COLUMN IF NOT EXISTS ${col}`);
        console.log(`✅ Added ${colName}`);
      } catch (error) {
        console.log(`⚠️  ${colName}: ${error.message}`);
      }
    }
    
    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

runMigration().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
