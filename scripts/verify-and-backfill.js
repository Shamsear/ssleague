require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function verifyAndBackfill() {
  // Create fresh connection
  const sql = neon(process.env.NEON_DATABASE_URL);
  
  console.log('Checking player_history table structure...\n');
  
  const columns = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name='player_history' 
    AND column_name IN ('overall_rating', 'nationality', 'speed', 'finishing')
    ORDER BY column_name
  `;
  
  console.log('Found columns:', columns.map(c => c.column_name));
  
  if (columns.length === 0) {
    console.log('\n❌ Columns not found! Migration may have failed.');
    return;
  }
  
  console.log('\n✅ Columns exist! Proceeding with backfill...\n');
  
  // Check how many records need backfilling
  const needsBackfill = await sql`
    SELECT COUNT(*) as count
    FROM player_history
    WHERE overall_rating IS NULL
  `;
  
  console.log(`Records needing backfill: ${needsBackfill[0].count}\n`);
  
  if (needsBackfill[0].count > 0) {
    console.log('Starting backfill from footballplayers table...\n');
    
    const result = await sql`
      UPDATE player_history ph
      SET 
        position_group = fp.position_group,
        overall_rating = fp.overall_rating,
        nationality = fp.nationality,
        age = fp.age,
        playing_style = fp.playing_style,
        club = fp.team_name,
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
        ball_winning = fp.ball_winning,
        aggression = fp.aggression,
        gk_reflexes = fp.gk_reflexes,
        gk_reach = fp.gk_reach,
        gk_handling = fp.gk_handling,
        weak_foot_usage = fp.weak_foot_usage,
        weak_foot_accuracy = fp.weak_foot_accuracy,
        form = fp.form,
        injury_resistance = fp.injury_resistance
      FROM footballplayers fp
      WHERE ph.player_id = fp.player_id
      AND ph.overall_rating IS NULL
    `;
    
    console.log(`✅ Backfilled ${result.length} records\n`);
  } else {
    console.log('✅ No records need backfilling\n');
  }
  
  // Verify backfill
  const afterBackfill = await sql`
    SELECT COUNT(*) as count
    FROM player_history
    WHERE overall_rating IS NULL
  `;
  
  console.log(`Records still NULL after backfill: ${afterBackfill[0].count}\n`);
  console.log('✅ Complete!');
}

verifyAndBackfill().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
