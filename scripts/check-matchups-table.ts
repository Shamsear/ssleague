import { getTournamentDb } from '../lib/neon/tournament-config';

async function checkMatchupsTable() {
  const sql = getTournamentDb();
  
  console.log('🔍 Checking matchups table structure...\n');
  
  try {
    // Check if table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'matchups'
      );
    `;
    
    console.log('Table exists:', tableExists[0].exists);
    
    if (tableExists[0].exists) {
      // Get column information
      const columns = await sql`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = 'matchups'
        ORDER BY ordinal_position;
      `;
      
      console.log('\n📋 Matchups table columns:');
      console.table(columns);
      
      // Get sample row if any exist
      const sampleRows = await sql`
        SELECT * FROM matchups LIMIT 1;
      `;
      
      if (sampleRows.length > 0) {
        console.log('\n📊 Sample row:');
        console.log(sampleRows[0]);
      } else {
        console.log('\n⚠️ No rows in matchups table yet');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

checkMatchupsTable();
