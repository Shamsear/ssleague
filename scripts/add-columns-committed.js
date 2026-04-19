require('dotenv').config({ path: '.env.local' });
const { Pool } = require('@neondatabase/serverless');

async function addColumns() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  const client = await pool.connect();
  
  console.log('Adding columns to player_history table...\n');
  
  try {
    await client.query('BEGIN');
    
    const columns = [
      ['position_group', 'VARCHAR(50)'],
      ['overall_rating', 'INTEGER'],
      ['nationality', 'VARCHAR(100)'],
      ['age', 'INTEGER'],
      ['playing_style', 'VARCHAR(100)'],
      ['club', 'VARCHAR(255)'],
      ['is_sold', 'BOOLEAN DEFAULT true'],
      ['speed', 'INTEGER'],
      ['acceleration', 'INTEGER'],
      ['ball_control', 'INTEGER'],
      ['dribbling', 'INTEGER'],
      ['low_pass', 'INTEGER'],
      ['lofted_pass', 'INTEGER'],
      ['finishing', 'INTEGER'],
      ['heading', 'INTEGER'],
      ['physical_contact', 'INTEGER'],
      ['stamina', 'INTEGER'],
      ['defensive_awareness', 'INTEGER'],
      ['ball_winning', 'INTEGER'],
      ['aggression', 'INTEGER'],
      ['gk_reflexes', 'INTEGER'],
      ['gk_reach', 'INTEGER'],
      ['gk_handling', 'INTEGER'],
      ['weak_foot_usage', 'INTEGER'],
      ['weak_foot_accuracy', 'INTEGER'],
      ['form', 'INTEGER'],
      ['injury_resistance', 'INTEGER']
    ];
    
    for (const [name, type] of columns) {
      const query = `ALTER TABLE player_history ADD COLUMN IF NOT EXISTS ${name} ${type}`;
      await client.query(query);
      console.log(`✅ Added ${name}`);
    }
    
    await client.query('COMMIT');
    console.log('\n✅ All columns added and committed!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addColumns().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
