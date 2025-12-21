const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.FANTASY_DATABASE_URL);

(async () => {
  try {
    console.log('Checking transfer_windows table...\n');
    
    const windows = await sql`
      SELECT 
        window_id,
        window_name,
        league_id,
        max_transfers_per_window,
        points_cost_per_transfer,
        transfer_window_start,
        transfer_window_end,
        is_active,
        opens_at,
        closes_at
      FROM transfer_windows
      WHERE league_id = 'SSPSLFLS16'
      ORDER BY opens_at DESC
      LIMIT 5
    `;
    
    if (windows.length === 0) {
      console.log('❌ No transfer windows found for league SSPSLFLS16');
    } else {
      console.log(`✅ Found ${windows.length} transfer window(s):\n`);
      windows.forEach((w, i) => {
        console.log(`Window ${i + 1}:`);
        console.log(`  ID: ${w.window_id}`);
        console.log(`  Name: ${w.window_name}`);
        console.log(`  Max Transfers: ${w.max_transfers_per_window}`);
        console.log(`  Points Cost: ${w.points_cost_per_transfer}`);
        console.log(`  Window Start: ${w.transfer_window_start}`);
        console.log(`  Window End: ${w.transfer_window_end}`);
        console.log(`  Is Active: ${w.is_active}`);
        console.log(`  Opens At: ${w.opens_at}`);
        console.log(`  Closes At: ${w.closes_at}`);
        console.log('');
      });
    }
    
    // Check table schema
    console.log('Table schema:');
    const schema = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'transfer_windows'
      ORDER BY ordinal_position
    `;
    
    schema.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
