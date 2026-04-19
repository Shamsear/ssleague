require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NEON_DATABASE_URL);

async function backfillPlayerHistory() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         BACKFILL PLAYER_HISTORY FROM FOOTBALLPLAYERS      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Check how many records need backfilling
    const needsBackfill = await sql`
      SELECT COUNT(*) as count
      FROM player_history
      WHERE overall_rating IS NULL
    `;
    
    console.log(`Records needing backfill: ${needsBackfill[0].count}\n`);
    
    if (needsBackfill[0].count > 0) {
      console.log('Starting backfill from footballplayers table...\n');
      
      // Only use columns that exist in footballplayers table
      const result = await sql`
        UPDATE player_history ph
        SET 
          position_group = fp.position_group,
          overall_rating = fp.overall_rating,
          nationality = fp.nationality,
          age = fp.age,
          playing_style = fp.playing_style,
          club = fp.club,
          is_sold = fp.is_sold,
          speed = fp.speed,
          acceleration = fp.acceleration,
          ball_control = fp.ball_control,
          dribbling = fp.dribbling,
          low_pass = fp.low_pass,
          lofted_pass = fp.lofted_pass,
          finishing = fp.finishing,
          heading = fp.heading,
          physical_contact = fp.physical_contact,
          stamina = fp.stamina,
          defensive_awareness = fp.defensive_awareness,
          aggression = fp.aggression,
          gk_reflexes = fp.gk_reflexes,
          gk_reach = fp.gk_reach
        FROM footballplayers fp
        WHERE ph.player_id = fp.player_id
        AND ph.overall_rating IS NULL
      `;
      
      console.log(`✅ Backfilled data for matching records\n`);
      
      // Check remaining NULL records
      const stillNull = await sql`
        SELECT COUNT(*) as count
        FROM player_history
        WHERE overall_rating IS NULL
      `;
      
      console.log(`Records still NULL: ${stillNull[0].count}`);
      console.log('(These are likely historical players no longer in footballplayers table)\n');
      
      // Show sample of what was backfilled
      const sample = await sql`
        SELECT player_name, team_name, season_id, overall_rating, nationality, speed
        FROM player_history
        WHERE overall_rating IS NOT NULL
        LIMIT 5
      `;
      
      console.log('Sample backfilled records:');
      sample.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.player_name} (${p.team_name}) - S${p.season_id}`);
        console.log(`     Rating: ${p.overall_rating}, Nationality: ${p.nationality}, Speed: ${p.speed}`);
      });
      
    } else {
      console.log('✅ No records need backfilling\n');
    }
    
    console.log('\n✅ Backfill complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

backfillPlayerHistory().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
